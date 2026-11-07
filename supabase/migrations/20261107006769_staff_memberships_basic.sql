-- Staff memberships by role: admins keep a complimentary Premium membership; every other staff
-- role (Editor, Developer, Billing, Customer service, Blog, Sales) now comes with a complimentary
-- Basic one. Still decided only by the database: subscriptions_set_complimentary() picks the plan
-- from the account's roles each time the row is written, and sync_staff_membership() touches the
-- row whenever a role is granted or removed, so gaining or losing the admin role moves the plan.
-- Moving down to Basic sets aside the newest profiles past Basic's room (the existing trigger).

create or replace function private.subscriptions_set_complimentary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.complimentary := exists (select 1 from public.staff_roles where user_id = new.user_id);
  if new.complimentary then
    new.plan_id := case
      when exists (select 1 from public.staff_roles where user_id = new.user_id and role = 'admin') then 'premium'
      else 'basic'
    end;
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
    values (new.user_id, 'basic', 'active')
    on conflict (user_id) do update set updated_at = now();  -- the trigger above picks the plan
  elsif not exists (select 1 from public.staff_roles where user_id = old.user_id) then
    -- No longer on staff: the free membership ends and the account has no plan, so it
    -- chooses one (and agrees to its renewal terms) before anything could be charged.
    delete from public.subscriptions where user_id = old.user_id and complimentary;
  else
    -- Still on staff with other roles: the plan is decided again (losing admin moves it to Basic).
    update public.subscriptions set updated_at = now() where user_id = old.user_id and complimentary;
  end if;
  return null;
end;
$$;
revoke execute on function private.sync_staff_membership() from public, anon, authenticated;

-- Staff there are now: each membership's plan is decided again from its roles.
update public.subscriptions set updated_at = now() where complimentary;
