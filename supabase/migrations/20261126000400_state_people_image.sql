-- The official photo link Open States lists for each state official (usually on the legislature's or
-- office's own website). Stored as a link only; the image stays on the official site.
alter table state_people add column image_url text;
