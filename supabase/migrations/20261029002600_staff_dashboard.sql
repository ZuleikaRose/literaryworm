-- The staff dashboard (new request): how LiteraryWorm is doing, for billing
-- staff and admins.
--
-- Totals only: no names, emails or ids leave this function, and nothing is
-- stored. It reads across every account, so it's SECURITY DEFINER and checks
-- the role itself (has_staff_role() also needs the two-step code when it's on).
-- Monthly revenue is what active paid memberships cost a month at list price,
-- before promo codes; complimentary memberships are counted but never priced.

create function public.staff_dashboard()
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
               'complimentary', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.complimentary)
             ) order by p.sort_order), '[]'::jsonb)
        from public.plans p
    ),
    'monthly_revenue_cents', (
      select coalesce(sum(p.price_cents), 0)
        from public.subscriptions s join public.plans p on p.id = s.plan_id
       where s.status = 'active' and not s.complimentary
    ),
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
