-- Each AI section summary is checked against the section text by a second request before it can be
-- published. status: unchecked (just written), passed, flagged (to be rewritten once with the
-- problems named), held (failed twice; never published, the section shows its text only).
alter table bill_section_summaries
  add column status      text not null default 'unchecked' check (status in ('unchecked', 'passed', 'flagged', 'held')),
  add column attempts    smallint not null default 1,
  add column check_notes jsonb,          -- the checker's list of statements the text doesn't support
  add column check_model text;

-- Only summaries that passed the check can be published.
alter table bill_section_summaries add constraint published_only_if_passed check (not published or status = 'passed');
