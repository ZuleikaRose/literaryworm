-- What's new: the COPPA entry (6832) also names the children's privacy FAQ on Home and Pricing. src/data/changelog.json has the same.

update public.changelog_entries
set body = $lw$Adding a Kids profile now needs a card payment on the account first, such as your membership's first payment. It's how we confirm a parent's consent, as the US children's privacy law (COPPA) asks, and it costs nothing extra. The Children's Privacy Notice now explains COPPA, how we verify consent, that we never share a child's information, how long we keep it and how we keep it safe. The FAQ on Home and Pricing answers it too.$lw$
where title = $lw$Kids profiles: consent confirmed by a card payment$lw$ and released_on = '2026-11-10';
