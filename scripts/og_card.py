"""Draw public/og/site.png: the plain link-preview card (1200x630) for pages without a portrait.

Text only, no people, no party colors. Run from the repo root after `npm install` (it uses the
site's own font, Public Sans, from node_modules):  python3 scripts/og_card.py
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
ACCENT, INK, MUTED, BG = "#0e5a4b", "#1a1f1d", "#4a5350", "#ffffff"
FONTS = "node_modules/@fontsource/public-sans/files/public-sans-latin-{}-normal.woff"

bold = lambda size: ImageFont.truetype(FONTS.format(700), size)
regular = lambda size: ImageFont.truetype(FONTS.format(400), size)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 16], fill=ACCENT)
d.text((80, 150), "Civic Atlas", font=bold(104), fill=ACCENT)
d.text((80, 300), "Who represents you, and what they did:", font=regular(46), fill=INK)
d.text((80, 362), "votes, bills, committees and campaign money,", font=regular(46), fill=INK)
d.text((80, 424), "from official records.", font=regular(46), fill=INK)
d.line([80, 530, W - 80, 530], fill="#d5dcd9", width=2)
d.text((80, 552), "Congress · state officials · Orange County, CA", font=regular(30), fill=MUTED)
img.save("public/og/site.png", optimize=True)
