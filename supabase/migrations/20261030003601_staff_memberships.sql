-- Every member of staff gets a complimentary membership while they work here, not only
-- admins (migration 1800): Admin, Editor, Developer, Billing, Customer service, Blog and
-- Sales. The database still decides: subscriptions_set_complimentary() marks a membership
-- complimentary when its account holds any staff role, so it's Premium, active and never
-- billed. Granting a first role starts (or converts) it; removing the last role ends it
-- (the row is removed), so the account chooses a plan, and agrees to its renewal terms,
-- before anything could be charged. Moving between roles keeps it.
--
-- A Stripe subscription the account had keeps no hold on the row (stripe_subscription_id
-- is cleared); stripe-webhook cancels it in Stripe the next time Stripe writes about it,
-- and deletes any renewal invoice before it's charged, as it did for admins.

create or replace function private.subscriptions_set_complimentary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.complimentary := exists (select 1 from public.staff_roles where user_id = new.user_id);
  if new.complimentary then
    new.plan_id := 'premium';
    new.status := 'active';
    new.billing_day := null;
    new.cancel_at_period_end := false;
    new.current_period_end := null;
    new.cancel_at := null;
    new.gift_until := null;
    new.stripe_subscription_id := null;
  end if;
  return new;
end;
$$;

create or replace function private.sync_staff_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.subscriptions (user_id, plan_id, status)
    values (new.user_id, 'premium', 'active')
    on conflict (user_id) do update set updated_at = now();  -- the trigger above converts it
  elsif not exists (select 1 from public.staff_roles where user_id = old.user_id) then
    -- No longer on staff: the free membership ends and the account has no plan, so it
    -- chooses one (and agrees to its renewal terms) before anything could be charged.
    delete from public.subscriptions where user_id = old.user_id and complimentary;
  end if;
  return null;
end;
$$;
revoke execute on function private.sync_staff_membership() from public, anon, authenticated;

drop trigger if exists staff_roles_admin_granted on public.staff_roles;
drop trigger if exists staff_roles_admin_removed on public.staff_roles;
drop function if exists private.sync_admin_membership();

create trigger staff_roles_granted
  after insert on public.staff_roles
  for each row execute function private.sync_staff_membership();

create trigger staff_roles_removed
  after delete on public.staff_roles
  for each row execute function private.sync_staff_membership();

-- Staff there are now: their memberships become complimentary, and those with none get one.
update public.subscriptions s set updated_at = now()
 where not s.complimentary
   and exists (select 1 from public.staff_roles r where r.user_id = s.user_id);
insert into public.subscriptions (user_id, plan_id, status)
select distinct r.user_id, 'premium', 'active'::public.subscription_status
  from public.staff_roles r
 where not exists (select 1 from public.subscriptions s where s.user_id = r.user_id);
