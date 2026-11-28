-- A second, simpler AI version of a bill's summary ("Explain it simply" / "Explícalo fácil"): two or
-- three short sentences in everyday words (about a 5th-grade reading level), in English and Spanish.
-- Written by scripts/ingest/bill-simple-summaries.mjs (Anthropic Batch API), never on a page view,
-- and only from the bill's CRS summary, the same source and hash as bill_plain_summaries. Only bills
-- that already have a published plain summary get one; the site shows it as a swap inside that summary.
--
-- Its own table, so the published plain summaries are not touched when this one is written, redone or
-- held. Same review flow: every version is checked against the CRS summary by a second request; a
-- flagged one is rewritten once; one flagged twice is held and never shown.
create table bill_simple_summaries (
  congress     smallint not null,
  bill_type    text not null,
  number       integer not null,
  source       text not null default 'crs' check (source in ('crs')),
  source_hash  text not null,        -- sha256 (hex) of bills.crs_summary exactly as stored when written
  source_chars integer not null,
  text_en      text not null,
  text_es      text not null,
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
  constraint texts_not_empty check (length(btrim(text_en)) > 0 and length(btrim(text_es)) > 0)
);

alter table bill_simple_summaries enable row level security;
-- Shown only once it passed the check, and only while it still describes the CRS summary the site
-- shows (a new CRS summary hides it at once, as with bill_plain_summaries).
create policy "public read when published and current" on bill_simple_summaries for select using (
  published and exists (
    select 1 from bills b
    where b.congress = bill_simple_summaries.congress and b.bill_type = bill_simple_summaries.bill_type
      and b.number = bill_simple_summaries.number
      and encode(sha256(convert_to(b.crs_summary, 'UTF8')), 'hex') = bill_simple_summaries.source_hash
  )
);
