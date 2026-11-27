-- AI-written plain-language summaries of a whole bill: one short sentence (the lead) and up to
-- four short points, in English and Spanish. Written ahead of time by
-- scripts/ingest/bill-summaries.mjs (Anthropic Batch API), never on a page view, and only from the
-- bill's CRS summary (bills.crs_summary, the latest version CRS has published).
--
-- Same review flow as bill_section_summaries: every summary is checked against the CRS summary by
-- a second request; a flagged one is rewritten once; one flagged twice is held and never shown.
-- The site labels every summary as AI-generated and links the CRS summary and official text.
create table bill_plain_summaries (
  congress     smallint not null,
  bill_type    text not null,
  number       integer not null,
  source       text not null default 'crs' check (source in ('crs')),
  source_hash  text not null,        -- sha256 (hex) of bills.crs_summary exactly as stored when summarized
  source_chars integer not null,
  lead_en      text not null,
  lead_es      text not null,
  points_en    jsonb not null default '[]',
  points_es    jsonb not null default '[]',
  model        text not null,
  batch_id     text,
  status       text not null default 'unchecked' check (status in ('unchecked', 'passed', 'flagged', 'held')),
  attempts     smallint not null default 1,
  check_notes  jsonb,                -- the checker's list of problems
  check_model  text,
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (congress, bill_type, number),
  foreign key (congress, bill_type, number) references bills on delete cascade,
  constraint published_only_if_passed check (not published or status = 'passed'),
  constraint points_match check (jsonb_typeof(points_en) = 'array' and jsonb_typeof(points_es) = 'array'
    and jsonb_array_length(points_en) = jsonb_array_length(points_es) and jsonb_array_length(points_en) <= 4)
);

alter table bill_plain_summaries enable row level security;
-- The browser sees a summary only once it passed the check, and only while it still describes the
-- CRS summary the site shows: when the bills job stores a new CRS summary, the old plain summary
-- disappears at once (the daily job then writes a new one), instead of waiting for that job.
create policy "public read when published and current" on bill_plain_summaries for select using (
  published and exists (
    select 1 from bills b
    where b.congress = bill_plain_summaries.congress and b.bill_type = bill_plain_summaries.bill_type
      and b.number = bill_plain_summaries.number
      and encode(sha256(convert_to(b.crs_summary, 'UTF8')), 'hex') = bill_plain_summaries.source_hash
  )
);
