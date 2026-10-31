-- Privacy Policy: passkeys added after the two-step code are noted, so logging in with one skips the code
-- (migration 6530; src/data/legalPages.json has the same). A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$You can rename or remove passkeys in Account → Sign-in, and Download my data lists them.$lw$, $lw$You can rename or remove passkeys in Account → Sign-in, and Download my data lists them. If you use two-step sign-in, we also note which passkeys were added after you entered your code, so logging in with one of them doesn't ask for the code again.$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$You can rename or remove passkeys in Account → Sign-in, and Download my data lists them.$lw$) > 0
  and strpos(sections::text, $lw$we also note which passkeys$lw$) = 0;
