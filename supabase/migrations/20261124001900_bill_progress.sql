-- Milestones in a bill's path, from the Library of Congress action codes in Bill Status, for
-- the status bar on bill pages and "this week in Congress". Each is the first date the
-- milestone happened; null means it hasn't.
alter table bills
  add column reported_date       date,   -- reported by a committee
  add column passed_house_date   date,   -- passed or agreed to in the House
  add column failed_house_date   date,
  add column passed_senate_date  date,
  add column failed_senate_date  date,
  add column presented_date      date,   -- presented to the President
  add column vetoed_date         date,
  add column became_law_date     date,
  add column law_number          text;   -- e.g. 'Public Law 119-21'

create index bills_became_law_idx on bills (became_law_date desc) where became_law_date is not null;
