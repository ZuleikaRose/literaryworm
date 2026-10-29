-- Admin accounts are never billed.
--
-- An admin's membership is complimentary: Premium, always active, with no
-- billing day, no renewal and no Stripe subscription, so nothing can be charged
-- for it, now or once payment is added. The database decides this, not the
-- browser or the functions: a trigger sets subscriptions.complimentary from
-- staff_roles on every write, so no one can mark their own membership
-- complimentary and an admin's can't be turned into a paid one.
--
-- Granting the admin role starts (or converts) the membership; removing it ends
-- a complimentary membership (the row is removed), so the account has to choose
-- a plan, and agree to its renewal terms, before anything could be charged.

alter table public.subscriptions
  add column complimentary boolean not null default false;

-- A complimentary membership has no billing day and no renewal consent to record.
alter table public.subscriptions
  alter column billing_day drop not null,
  alter column renewal_terms_accepted_at drop not null;

-- Keeps every write consistent with the account's roles (runs before the checks below).
create function private.subscriptions_set_complimentary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.complimentary := exists (
    select 1 from public.staff_roles where user_id = new.user_id and role = 'admin'
  );
  if new.complimentary then
    new.plan_id := 'premium';
    new.status := 'active';
    new.billing_day := null;
    new.cancel_at_period_end := false;
    new.current_period_end := null;
    new.stripe_subscription_id := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.subscriptions_set_complimentary() from public, anon, authenticated;

create trigger subscriptions_set_complimentary
  before insert or update on public.subscriptions
  for each row execute function private.subscriptions_set_complimentary();

alter table public.subscriptions
  add constraint subscriptions_paid_needs_billing
    check (complimentary or (billing_day is not null and renewal_terms_accepted_at is not null)),
  add constraint subscriptions_complimentary_never_billed
    check (not complimentary or (billing_day is null and status = 'active' and not cancel_at_period_end
                                 and current_period_end is null and stripe_subscription_id is null));

-- Granting or removing the admin role starts or ends the complimentary membership.
create function private.sync_admin_membership()
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
  else
    -- No longer an admin: the free membership ends and the account has no plan, so it
    -- chooses one (and agrees to its renewal terms) before anything could be charged.
    delete from public.subscriptions where user_id = old.user_id and complimentary;
  end if;
  return null;
end;
$$;
revoke execute on function private.sync_admin_membership() from public, anon, authenticated;

create trigger staff_roles_admin_granted
  after insert on public.staff_roles
  for each row when (new.role = 'admin')
  execute function private.sync_admin_membership();

create trigger staff_roles_admin_removed
  after delete on public.staff_roles
  for each row when (old.role = 'admin')
  execute function private.sync_admin_membership();

-- Members may see that their membership is complimentary.
grant select (complimentary) on public.subscriptions to authenticated;

-- The admins there are now: their memberships become complimentary.
update public.subscriptions s set updated_at = now()
 where exists (select 1 from public.staff_roles r where r.user_id = s.user_id and r.role = 'admin');
insert into public.subscriptions (user_id, plan_id, status)
select r.user_id, 'premium', 'active' from public.staff_roles r where r.role = 'admin'
on conflict (user_id) do nothing;
