-- Says out loud what RLS already does by default: browser roles can never touch
-- rate limit rows. Only the SECURITY DEFINER check_rate_limit function writes them.
create policy "No browser access to rate limits"
  on private.rate_limits as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);
