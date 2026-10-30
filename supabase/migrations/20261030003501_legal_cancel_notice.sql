-- The 48-hour cancellation rule (migration 3500): the Terms and the Return Policy say a member
-- must cancel at least 48 hours before the next billing date to stop that charge, that
-- cancelling later means one more monthly charge before the membership ends, and that
-- nothing is refunded (src/data/legalPages.json has the same change). The edit trigger keeps
-- the old versions; a page an editor has reworded since is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Your cancellation will take effect at the end of the current paid term.$lw$, $lw$To stop the next charge, cancel at least 48 hours before your next billing date: your cancellation then takes effect at the end of the current paid term. If you cancel less than 48 hours before your billing date, that charge still goes through and your cancellation takes effect at the end of the term it pays for. No refunds are given for any part of a term.$lw$)::jsonb
where sections::text like $lw$%Your cancellation will take effect at the end of the current paid term.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for.$lw$, $lw$until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for. Cancel at least 48 hours before your billing date to stop the next charge; cancelling later means one more monthly charge, and then the membership ends. No refunds.$lw$)::jsonb
where sections::text like $lw$%until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$You can cancel at any time from Account; your plan stays active until the end of the period you've paid for, and you won't be charged again.$lw$, $lw$You can cancel at any time from Account. Cancel at least 48 hours before your next billing date and your plan stays active until the end of the period you've paid for, and you won't be charged again. If you cancel less than 48 hours before your billing date, that charge still goes through (it isn't refunded) and your plan ends at the end of the month it pays for.$lw$)::jsonb
where sections::text like $lw$%You can cancel at any time from Account; your plan stays active until the end of the period you've paid for, and you won't be charged again.%$lw$;
