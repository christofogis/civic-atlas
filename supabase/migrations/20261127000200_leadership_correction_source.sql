-- Set when a leadership role reflects our own correction to congress-legislators (from
-- data/corrections/leadership.json): the official page the correction rests on. Null otherwise.
alter table leadership_roles add column correction_source text;
