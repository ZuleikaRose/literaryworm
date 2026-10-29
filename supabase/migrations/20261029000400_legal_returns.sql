-- The Return Policy (from the app's built-in copy, src/data/legalPages.json), after the Acceptable Use Policy.
-- A fresh database already has it from the seed; this adds it to one seeded before it existed.

-- The pages after it move down one place first, so no two pages share a position.
update public.legal_pages p set position = v.position
from (values
  ($lw$copyright$lw$, 9),
  ($lw$disclaimer$lw$, 10),
  ($lw$help$lw$, 11),
  ($lw$status$lw$, 12)
) as v (slug, position)
where p.slug = v.slug;

insert into public.legal_pages (slug, position, title, summary, sections) values
  ($lw$returns$lw$, 8, $lw$Return Policy$lw$, $lw$How refunds work for LiteraryWorm memberships, and who to contact with questions.$lw$, $lw$[{"heading": "Refunds", "paragraphs": ["LiteraryWorm doesn't take payment yet: choosing a plan saves it to your account, but no one is charged, so there is nothing to refund at the moment.", "Once paid plans start, all sales are final and no refund will be issued. You can cancel at any time from Account; your plan stays active until the end of the period you've paid for, and you won't be charged again.", "This doesn't affect any rights you have under the law where you live."]}, {"heading": "Questions", "paragraphs": ["If you have any questions concerning our return policy, please contact us at support@literaryworm.com."]}]$lw$::jsonb)
on conflict (slug) do nothing;
