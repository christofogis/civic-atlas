-- Votes can be on bills we haven't ingested yet, or on nominations and amendments that
-- aren't bills at all, so the bill reference is informational (joined with LEFT JOIN),
-- not a hard foreign key.
alter table votes drop constraint if exists votes_bill_congress_bill_type_bill_number_fkey;

-- Verbatim descriptions from the clerk / Senate:
--   description:   House <vote-desc>, Senate <vote_title>
--   document_name: what was voted on as the source names it, e.g. 'H R 30', 'PN12-5', 'S.Amdt. 1'
alter table votes add column description text;
alter table votes add column document_name text;
