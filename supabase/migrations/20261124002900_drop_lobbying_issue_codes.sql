-- Space: the database reached 401 MB of the free plan's 500 MB. issue_codes on each lobbying
-- mention took 15 MB and nothing on the site reads it (the issue area of a report is on
-- LDA.gov, one click away). Space is reclaimed by a VACUUM FULL run after this migration.
alter table lobbying_bill_mentions drop column issue_codes;
