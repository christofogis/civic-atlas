-- AI-written plain-language summaries of each section of a bill's latest official text.
-- Written ahead of time by scripts/ingest/section-summaries.mjs (Anthropic Batch API), never on a
-- page view. Each row is for one section of one text version, so a new version of a bill gets new
-- summaries and the old ones stay tied to the text they describe.
--
-- Nothing is public until it has been reviewed: the browser can read only rows with
-- published = true. The site labels every summary as AI-generated and links it to the section's
-- official text; CRS summaries stay first wherever they exist.
create table bill_section_summaries (
  congress     smallint not null,
  bill_type    text not null,
  number       integer not null,
  version_code text not null,
  section_key  text not null,        -- lib/billtext.js key: headings within their titles, lowercased
  path         jsonb not null,       -- the titles the section sits in, as printed
  header       text not null,        -- the section's heading, as printed
  words        integer not null,     -- length of the section's text
  summary_en   text not null,
  summary_es   text not null,
  model        text not null,
  batch_id     text,
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (congress, bill_type, number, version_code, section_key),
  foreign key (congress, bill_type, number, version_code) references bill_text_versions on delete cascade
);

-- Batches sent to the Batch API and not yet collected. A batch can take hours, so a run sends one
-- and a later run collects it; items maps each request id back to its bill section.
create table ai_batches (
  id          text primary key,
  job         text not null,
  model       text not null,
  items       jsonb not null,
  status      text not null default 'sent',   -- sent, collected, failed
  created_at  timestamptz not null default now(),
  collected_at timestamptz,
  counts      jsonb
);

alter table bill_section_summaries enable row level security;
alter table ai_batches enable row level security;
create policy "public read when published" on bill_section_summaries for select using (published);
-- ai_batches: no policy, so only the service role (ingest jobs) can read or write it.
