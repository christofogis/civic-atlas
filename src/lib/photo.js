// Official portraits fall back to one plain grey silhouette (public/img/no-photo.svg), the same size
// as a portrait, so a missing photo never changes the layout or singles anyone out.
export const NO_PHOTO = "/img/no-photo.svg";
export function noPhoto(e) {
  const img = e.currentTarget;
  if (!img.src.endsWith(NO_PHOTO)) { img.src = NO_PHOTO; img.alt = ""; }
}
