-- Didn't finish: a fourth library status beside the brief's three.
-- Rereads need nothing new: each read's finish day is already in reading_days.finished_books.
-- (ADD VALUE can't be used in the transaction that adds it; nothing here uses it.)

alter type public.reading_status add value if not exists 'did_not_finish';
