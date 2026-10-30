-- Member lookup for customer service: a staff member with the customer_service role (or an
-- admin), signed in with two-step sign-in when they use it, looks up one account by its email
-- to answer a question such as "why did my audiobook stop?". It returns only what support
-- needs: the plan and billing state, how many profiles, this month's listening against the
-- plan, and the devices holding offline places. Never the member's library, reading, notes,
-- searches or Stripe ids, and nothing it can change. Every lookup is recorded in
-- support_lookups (admins can read it), and each staff member may make 60 an hour.

create table public.support_lookups (
  id           bigint generated always as identity primary key,
  staff_id     uuid references auth.users (id) on delete set null,
  member_id    uuid references auth.users (id) on delete set null,
  looked_up_at timestamptz not null default now()
);
-- Indexes for staff_id and member_id (foreign keys) are in the 4201 and 4202 migrations.

alter table public.support_lookups enable row level security;

create policy "Admins read the lookup record" on public.support_lookups for select to authenticated
  using ((select public.has_staff_role('admin')));
create policy "Two-step sign-in when turned on" on public.support_lookups as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- Rows are written only by support_member_lookup().
revoke all on public.support_lookups from anon, authenticated;
grant select on public.support_lookups to authenticated;

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

-- The record is kept for a year (daily at 03:45 UTC).
select cron.schedule('support-lookups-cleanup', '45 3 * * *',
  $job$delete from public.support_lookups where looked_up_at < now() - interval '1 year'$job$);
