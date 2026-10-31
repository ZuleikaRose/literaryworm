-- Eight highlight colours instead of four: orange, purple, teal and red join
-- yellow, green, blue and pink. Existing highlights keep their colour.

alter type public.highlight_color add value if not exists 'orange';
alter type public.highlight_color add value if not exists 'purple';
alter type public.highlight_color add value if not exists 'teal';
alter type public.highlight_color add value if not exists 'red';
