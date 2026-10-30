-- Yearly billing: each plan can be paid monthly or yearly, at ten times the monthly price (two
-- months free). Stripe holds the prices (lookup keys literaryworm_<plan>_yearly); the
-- stripe-webhook function writes subscriptions.billing_interval from the subscription's price.
-- A yearly membership renews on the date it started, can't be paused, and can't move its billing
-- day; with under 48 hours' notice a cancellation ends it a year on (the Terms say so).
-- The staff dashboard counts a twelfth of a yearly price in monthly revenue, and member lookup
-- shows the interval.

alter table public.plans
  add column yearly_price_cents integer check (yearly_price_cents > 0);
update public.plans set yearly_price_cents = price_cents * 10 where id in ('basic', 'standard', 'premium');
alter table public.plans alter column yearly_price_cents set not null;

alter table public.subscriptions
  add column billing_interval text not null default 'month' check (billing_interval in ('month', 'year'));
grant select (billing_interval) on public.subscriptions to authenticated;

create or replace function public.staff_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_staff_role('billing') then
    raise exception 'Only billing staff and admins can see the dashboard' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'generated_at', now(),
    'accounts', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'new_30_days', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
      'profiles', (select count(*) from public.reader_profiles),
      'kids_profiles', (select count(*) from public.reader_profiles where age_rating = 'kids')
    ),
    -- Sign-ups a week, oldest first: the last 12 weeks, this week included.
    'weekly_sign_ups', (
      select jsonb_agg(jsonb_build_object('week', w.week, 'count', (
               select count(*) from public.profiles p
                where p.created_at >= w.week and p.created_at < w.week + interval '7 days'))
             order by w.week)
        from (select generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '7 days')::date as week) w
    ),
    'memberships', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'plan', p.id, 'name', p.name, 'price_cents', p.price_cents, 'currency', p.currency,
               'active', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'active' and not s.complimentary),
               'paused', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'paused'),
               'past_due', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'past_due'),
               'cancelled', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'cancelled'),
               'cancelling', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'active' and s.cancel_at_period_end),
               'complimentary', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.complimentary),
               'yearly_price_cents', p.yearly_price_cents
             ) order by p.sort_order), '[]'::jsonb)
        from public.plans p
    ),
    -- A yearly membership counts a twelfth of its price each month.
    'monthly_revenue_cents', (
      select coalesce(sum(case when s.billing_interval = 'year' then round(p.yearly_price_cents / 12.0) else p.price_cents end), 0)::bigint
        from public.subscriptions s join public.plans p on p.id = s.plan_id
       where s.status = 'active' and not s.complimentary
    ),
    'yearly_memberships', (select count(*) from public.subscriptions s where s.billing_interval = 'year' and s.status = 'active' and not s.complimentary),
    'reading', jsonb_build_object(
      'active_readers_7_days', (select count(distinct profile_id) from public.reading_days where day >= current_date - 6 and minutes > 0),
      'minutes_30_days', (select coalesce(sum(minutes), 0) from public.reading_days where day >= current_date - 29),
      'listening_minutes_30_days', (select coalesce(sum(listening_minutes), 0) from public.reading_days where day >= current_date - 29),
      'books_finished_30_days', (select coalesce(sum(books_finished), 0) from public.reading_days where day >= current_date - 29)
    ),
    'clubs', jsonb_build_object(
      'running', (select count(*) from public.book_clubs where finishes_on >= current_date),
      'posts_30_days', (select count(*) from public.club_posts where created_at >= now() - interval '30 days')
    ),
    'stripe_events_to_review', (select count(*) from public.stripe_events where needs_review)
  );
end;
$$;
revoke execute on function public.staff_dashboard() from public, anon;
grant execute on function public.staff_dashboard() to authenticated;

create or replace function public.support_member_lookup(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff  uuid := (select auth.uid());
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_member auth.users%rowtype;
  v_sub    public.subscriptions%rowtype;
  v_plan   public.plans%rowtype;
  v_from   date := date_trunc('month', now() at time zone 'utc')::date;
begin
  if v_staff is null or not public.has_staff_role('customer_service') or not public.second_step_done() then
    raise exception 'Only customer service staff and admins can look up members' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_email) not between 3 and 254 or v_email !~ '^[^@\s]+@[^@\s]+$' then
    raise exception 'Enter the member''s email address' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.support_lookups where staff_id = v_staff and looked_up_at > now() - interval '1 hour') >= 60 then
    return jsonb_build_object('status', 'too_many');
  end if;

  select * into v_member from auth.users where lower(email) = v_email limit 1;
  if v_member.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  insert into public.support_lookups (staff_id, member_id) values (v_staff, v_member.id);

  select * into v_sub from public.subscriptions where user_id = v_member.id;
  select * into v_plan from public.plans where id = coalesce(v_sub.plan_id, 'basic');

  return jsonb_build_object(
    'status', 'ok',
    'member', jsonb_build_object(
      'name', (select display_name from public.profiles where id = v_member.id),
      'email', v_member.email,
      'joined_at', v_member.created_at,
      'email_confirmed', v_member.email_confirmed_at is not null,
      'two_step', exists (select 1 from auth.mfa_factors f where f.user_id = v_member.id and f.status = 'verified'),
      'staff', exists (select 1 from public.staff_roles r where r.user_id = v_member.id),
      'plan_id', v_sub.plan_id,
      'plan_name', case when v_sub.plan_id is null then null else v_plan.name end,
      'status', v_sub.status,
      'billing_interval', v_sub.billing_interval,
      'billing_day', v_sub.billing_day,
      'next_billing_at', v_sub.current_period_end,
      'cancel_at', coalesce(v_sub.cancel_at, case when v_sub.cancel_at_period_end then v_sub.current_period_end end),
      'gift_until', v_sub.gift_until,
      'complimentary', coalesce(v_sub.complimentary, false),
      'card_on_file', v_sub.stripe_subscription_id is not null,
      'profiles', (select count(*) from public.reader_profiles p where p.account_id = v_member.id),
      'kids_profiles', (select count(*) from public.reader_profiles p where p.account_id = v_member.id and p.age_rating = 'kids'),
      'max_profiles', v_plan.max_profiles,
      'listening_minutes', coalesce((
        select sum(d.listening_minutes) from public.reading_days d where d.user_id = v_member.id and d.day >= v_from
      ), 0),
      'audio_hours', v_plan.audio_hours,
      'download_devices', v_plan.download_devices,
      'offline_devices', coalesce((
        select jsonb_agg(jsonb_build_object('label', o.label, 'last_seen_at', o.last_seen_at) order by o.last_seen_at desc)
        from public.offline_devices o where o.user_id = v_member.id
      ), '[]'::jsonb),
      'devices_open_today', (select count(*) from public.listening_devices l where l.user_id = v_member.id and l.last_seen_at > now() - interval '1 day')
    )
  );
end;
$$;

revoke execute on function public.support_member_lookup(text) from public, anon;
grant execute on function public.support_member_lookup(text) to authenticated;

