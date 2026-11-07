-- Bedtime in the Kids reading report: the Privacy Policy and the Children's Privacy Notice say what's
-- kept (minutes in Bedtime listening and after bedtime) and who sees it. Same text as
-- src/data/legalPages.json, matched as stored; each change made once.

update public.legal_pages
set sections = replace(sections::text, $lw$"Its time: how long it reads and listens each day, in total and for each book (shown on the book's page), the books it finishes, its reading goals and pace, and any reading plan it makes (the day it chose to finish by and where it was when the plan started)."$lw$, $lw$"Its time: how long it reads and listens each day, in total and for each book (shown on the book's page), how much of that was in Bedtime listening or after its bedtime, the books it finishes, its reading goals and pace, and any reading plan it makes (the day it chose to finish by and where it was when the plan started)."$lw$)::jsonb
where slug = $lw$childrens-privacy$lw$
  and strpos(sections::text, $lw$"Its time: how long it reads and listens each day, in total and for each book (shown on the book's page), the books it finishes, its reading goals and pace, and any reading plan it makes (the day it chose to finish by and where it was when the plan started)."$lw$) > 0
  and strpos(sections::text, $lw$Its time: how long it reads and listens each day, in total and for each book (shown on the book's page), how much of that was in Bedtime listening or after its bedtime, the books it finishes, its reading goals and pace, and any reading plan it makes (the day it chose to finish by and where it was when the plan started).$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$"You do: Account → Family shows each Kids profile's last 7 days, its weekly goal, its book requests and its quiz scores."$lw$, $lw$"You do: Account → Family shows each Kids profile's last 7 days, its weekly goal, how many nights it kept its bedtime and its time in Bedtime listening, its book requests and its quiz scores."$lw$)::jsonb
where slug = $lw$childrens-privacy$lw$
  and strpos(sections::text, $lw$"You do: Account → Family shows each Kids profile's last 7 days, its weekly goal, its book requests and its quiz scores."$lw$) > 0
  and strpos(sections::text, $lw$You do: Account → Family shows each Kids profile's last 7 days, its weekly goal, how many nights it kept its bedtime and its time in Bedtime listening, its book requests and its quiz scores.$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$"If you turn it on, a weekly report of how your Kids profiles read: their names, reading and listening time, days read, books finished and any weekly goal."$lw$, $lw$"If you turn it on, a weekly report of how your Kids profiles read: their names, reading and listening time, days read, books finished, any weekly goal, and, for a profile with a bedtime, how many nights it was kept and its time in Bedtime listening."$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$"If you turn it on, a weekly report of how your Kids profiles read: their names, reading and listening time, days read, books finished and any weekly goal."$lw$) > 0
  and strpos(sections::text, $lw$If you turn it on, a weekly report of how your Kids profiles read: their names, reading and listening time, days read, books finished, any weekly goal, and, for a profile with a bedtime, how many nights it was kept and its time in Bedtime listening.$lw$) = 0;

