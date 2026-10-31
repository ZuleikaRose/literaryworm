-- Twelve highlight colours instead of eight: lime, indigo, brown and grey join yellow, green, blue,
-- pink, orange, purple, teal and red. Existing highlights keep their colour.

alter type public.highlight_color add value if not exists 'lime';
alter type public.highlight_color add value if not exists 'indigo';
alter type public.highlight_color add value if not exists 'brown';
alter type public.highlight_color add value if not exists 'gray';
