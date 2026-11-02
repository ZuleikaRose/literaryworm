-- Voice control in car mode: the Privacy Policy, Children's Privacy Notice, Help and Accessibility Policy say who hears
-- the words (the browser's speech service) and that Kids profiles don't get it (src/data/legalPages.json has the same).
-- Each paragraph is added once; a page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$other device and playing on a speaker or TV. If your browser asks, choose Block."$lw$, $lw$other device and playing on a speaker or TV. If your browser asks, choose Block.", "Voice control in car mode: off until you turn it on, and not offered to Kids profiles. While car mode is open and on screen, your browser listens through the microphone and its own speech service turns what you say into words (Google's in Chrome and Edge, Apple's in Safari), under that company's terms. The app only reads the words for a command: we never get the sound, and we keep nothing."$lw$)::jsonb, updated_at = now()
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$other device and playing on a speaker or TV. If your browser asks, choose Block."$lw$) > 0
  and strpos(sections::text, $lw$Voice control in car mode:$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$usly…) and take chapter quizzes. These are written by Claude, made by Anthropic."$lw$, $lw$usly…) and take chapter quizzes. These are written by Claude, made by Anthropic.", "Kids profiles aren't offered voice control in car mode, because what's said would go to the browser's speech service (Google's or Apple's). Car mode's buttons work as usual."$lw$)::jsonb, updated_at = now()
where slug = $lw$childrens-privacy$lw$
  and strpos(sections::text, $lw$usly…) and take chapter quizzes. These are written by Claude, made by Anthropic."$lw$) > 0
  and strpos(sections::text, $lw$Kids profiles aren't offered voice control$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$s you heard of a LibriVox recording. Anyone with the link can play that stretch."$lw$, $lw$s you heard of a LibriVox recording. Anyone with the link can play that stretch.", "Car mode (in the player and the mini-player's More) fills a phone or tablet with big buttons and keeps the screen on. Voice control there, off until you turn it on, lets you say Play, Pause, Back, Forward, Next chapter, Previous chapter or Exit car mode, with a length if you like (back 30 seconds). Your browser's speech service hears the words. Not on Kids profiles."$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$s you heard of a LibriVox recording. Anyone with the link can play that stretch."$lw$) > 0
  and strpos(sections::text, $lw$Voice control there, off until you turn it on$lw$) = 0;

update public.legal_pages
set sections = replace(sections::text, $lw$screen and headphones. The player's read-along transcript follows the narration."$lw$, $lw$screen and headphones. The player's read-along transcript follows the narration.", "In car mode, the buttons fill a phone or tablet screen at every size and way up, and voice control (off until you turn it on, not on Kids profiles) lets you play, pause, skip and change chapter by saying so."$lw$)::jsonb, updated_at = now()
where slug = $lw$accessibility$lw$
  and strpos(sections::text, $lw$screen and headphones. The player's read-along transcript follows the narration."$lw$) > 0
  and strpos(sections::text, $lw$In car mode, the buttons fill$lw$) = 0;
