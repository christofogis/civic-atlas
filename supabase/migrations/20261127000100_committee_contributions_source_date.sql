-- Committee contributions now come from the FEC bulk file of contributions from committees to
-- candidates (pas2), totaled per giving committee, instead of the 100 largest Schedule A rows.
-- source_date: the date the FEC last updated that file, shown on member pages as the
-- "through" date. Null on rows written by the earlier method.
alter table finance_committee_contributions add column source_date date;
