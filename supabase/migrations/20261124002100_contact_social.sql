-- Contact details per term (from congress-legislators, which records them on the current term)
-- and official social-media accounts per member. Links only: the site doesn't show posts.
alter table terms
  add column phone        text,
  add column address      text,
  add column contact_form text;

alter table members
  add column social_x         text,
  add column social_facebook  text,
  add column social_youtube   text,
  add column social_instagram text,
  add column social_mastodon  text,
  add column social_bluesky   text;
