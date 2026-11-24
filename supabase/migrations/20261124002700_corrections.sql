-- Public log of errors found in the site's data or calculations and what was done about them.
-- Written by the maintainer (service role or dashboard), never by visitors; visitor reports
-- stay private in error_reports.
create table corrections (
  id              bigint generated always as identity primary key,
  fixed_on        date not null,
  area            text not null,     -- e.g. 'Votes', 'Lobbying', 'Campaign finance'
  what_was_wrong  text not null,
  what_changed    text not null,
  pages           text               -- example page affected, e.g. '/member/P000145'
);
create index corrections_fixed_idx on corrections (fixed_on desc);
alter table corrections enable row level security;
create policy "public read" on corrections for select using (true);

insert into corrections (fixed_on, area, what_was_wrong, what_changed, pages) values
('2026-11-24', 'Votes',
 'Roll-call votes from 2023 and 2024 (the 118th Congress) were missing, although the site said its coverage started in 2023. Attendance and party-line figures for that Congress were not shown.',
 'All 1,241 House and 691 Senate roll calls from the 118th Congress were added and the figures recalculated.', '/member/S000033#votes'),
('2026-11-24', 'Votes',
 '173 Senate votes on amendments, motions to table and budget waivers were not linked to the bill they concerned, so they had no issue and did not appear on bill pages.',
 'Each is now linked to its bill using the amended document listed in the Senate''s record.', '/bill/119/hr/1'),
('2026-11-24', 'Bills',
 'Bill pages showed the long official title even when a bill had a short title (for example "To amend title 38..." instead of the bill''s name).',
 'Short titles are now read from the Library of Congress record for about 30,000 bills.', '/bills');
