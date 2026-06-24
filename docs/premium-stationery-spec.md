# Caligraphia — Premium Stationery Asset Spec

A production brief for designing **sellable** stationery (paper, stamps, envelopes,
wax seals) that drops straight into the app. Every size here is taken from the
actual rendering code, so assets built to spec will line up pixel-for-pixel.

> **Core principle:** the handwriting is the hero. Every surface is a *background*
> that handwriting strokes are drawn on top of. Premium designs must stay legible
> — keep the writing area light and calm; put the drama in borders, corners, and
> texture.

---

## 1. The surfaces & exact sizes

The app renders each surface at a fixed pixel size and draws normalized (0–1)
handwriting strokes over it. Design at these **exact** pixel dimensions.

| Surface | Screen size (px) | Aspect | Where it's used |
|---|---|---|---|
| **Letter page** | **2400 × 3200** | 3:4 portrait | The main writing sheet. Multi-page letters stack these. |
| **Postcard** | **1600 × 1100** | ~16:11 landscape | Postcards + photo-postcard backs. |
| **Round-robin section** | **2400 × 1100** | ~24:11 | Collaborative passed-around strips. |
| **Postscript / comment** | **1200 × 420** | ~20:7 | Short replies under a letter. |
| **Envelope** | SVG, viewBox **500 × 420** | vector | Interactive — see §4. |
| **Wax seal** | SVG, ~**60 × 60** units | vector | Emblem pressed in wax — see §5. |
| **Postage stamp** | image (see §3) | ~0.81 | Already a collectible system. |

Color space: **sRGB** (embed the profile). These are screen-exact — DPI is
irrelevant for the app. For *physically mailed* pieces you'll also want 300-DPI
print masters; see §6.

---

## 2. Paper / writing surfaces  ⭐ best first product

Today the app's papers (Blank, Ruled, Graph, Watercolor, Vellum, Midnight) are
drawn procedurally in code. The engine **also** already supports using an
arbitrary **image as the canvas background** (it powers photo-postcards), so an
image-based premium paper is essentially a drop-in background layer.

### Sizes
- **Letter paper:** `2400 × 3200 px`
- **Postcard paper:** `1600 × 1100 px`
- Format: **PNG** (or high-quality JPG if there's no transparency). Full quality, **no scaling** — export at exact pixels.

### Design rules (so handwriting stays readable)
- **Keep the writing field light.** Aim for ≥ ~85% luminance across the central
  writing area so dark ink reads. Save bold/dark elements for the outer ~8%
  (≈ 190 px inset on a letter) — borders, corners, a header crest.
- **Safe writing zone:** treat the inner area (inset ≈ 190 px on letters, ≈ 90 px
  on postcards) as "calm." No busy texture or dark color there.
- **Postcard postmark zone:** the app stamps a circular **postmark in the
  top-left** of every postcard (≈ 105 px radius, centered near x≈170, y≈170).
  Keep that corner simple so the postmark reads.
- **Dark / "Midnight" variants:** on dark paper the app expects **light ink**.
  A premium dark paper should be genuinely dark (luminance < ~20%) and pair with
  a note that the writer should pick a light ink color.
- **Premium ≠ loud.** Subtle laid/fiber texture, a faint deckle edge, a watercolor
  wash, a letterpress-style border, foil-look corners — these read "expensive"
  while staying light. Avoid full-bleed busy patterns behind the text.

### Sell as coordinated "sets"
A set is far more valuable than one sheet. A good pack:
> 6 letter papers + 6 matching postcard papers + 1 envelope liner + 1 wax-seal
> emblem + a 4–6 design stamp series, all in one visual theme (e.g. "Botanical
> Spring", "Art Deco Nights", "Nautical").

---

## 3. Postage stamps  ⭐ most drop-in (the system already exists)

The app already has a real collectible stamp system:
`StampDesign { imageUrl, tier, series, season, totalMinted, currentlyMinted }`,
with per-user owned `Stamp`s. New stamps are just **artwork + metadata**.

### Sizes
- **Stamp artwork:** `1000 × 1240 px` (postage ratio ≈ 0.806), **PNG with
  transparency**, sRGB.
- Bleed a few px of transparency around the art, or bake a classic **perforated
  edge** into the PNG (white scalloped border on transparent).
- Keep a clear denomination/series corner if you want a "value" mark.

### Metadata that drives collectibility
- **series / season:** e.g. `"Winter 2026"` — ship 4–6 designs per series.
- **tier:** common / uncommon / rare (rarer = lower mint count).
- **totalMinted:** the scarcity lever. A "rare" of 50 feels special; a "common"
  of 5000 is everyday postage.

These can be **sold as packs** (buy the "Winter 2026" series) or awarded. The
display + minting plumbing is already built.

---

## 4. Envelopes

Rendered as an **SVG** (`viewBox 0 0 500 420`). Anatomy (in viewBox units):
- **Body:** rounded rect at `x28 y180`, `444 × 216`.
- **Mouth shadow:** a thin band across the top of the body.
- **Flap:** triangle rising from the body top to the seal point.
- **Letter peeking out:** rect `x64 y20`, `372 × 170`.
- **Stamp slot:** top-right, ≈ `44 × 54` units.
- **Wax-seal target:** center of the mouth.

### Sell as
- **Envelope colorways / patterns:** new SVG templates (recommended — crispest),
  *or* a `1500 × 1260 px` PNG (3× the viewBox) if raster.
- **Liner patterns:** the decorative inside-the-flap pattern (the classy detail).
  Provide as a tileable SVG/PNG.
- **Paper-stock textures:** the envelope's outer "paper" (kraft, cotton, linen).

Keep the **stamp slot** (top-right) and **seal target** (center mouth) zones
clear of busy art.

---

## 5. Wax seals

A small **SVG emblem** pressed into wax (drawn at ~26 px radius inside a ~60 unit
box). The app tints the wax color and positions it.

### Sell as
- **Emblems / monograms:** SVG, transparent background, designed to read at
  ~60 px. Single-color or two-tone (the app applies the wax color underneath).
- **Wax colors:** named hex swatches (e.g., "Oxblood `#7a1f1f`", "Forest
  `#28432f`", "Gold `#b08d2e`").

---

## 6. Print masters (only if you'll physically mail pieces — see print-and-mail.md)

Screen sizes are for the app. For real mail you want **300-DPI masters with
bleed**:

| Piece | Trim | 300 DPI + 0.125" bleed |
|---|---|---|
| **US Letter** | 8.5 × 11 in | **2625 × 3375 px** (trim 2550 × 3300) |
| **Postcard** | 6 × 4 in | **1875 × 1275 px** (trim 1800 × 1200) |
| **A6 postcard** | 148 × 105 mm | **1819 × 1311 px** |

Keep all text/important art inside a **0.25" safe margin** from the trim.
(The app's screen renders — 2400×3200 letter, 1600×1100 postcard — are close to
these ratios but not print-exact; mailed pieces should use a print-targeted
render, which is a small engineering task.)

---

## 7. Delivery format — what to hand back

```
my-pack-botanical-spring/
  pack.json
  paper-letter-fern.png            2400×3200
  paper-letter-rose.png            2400×3200
  paper-postcard-fern.png          1600×1100
  envelope-linen.svg
  envelope-liner-fern.svg
  seal-monogram-leaf.svg
  stamp-spring2026-tulip.png       1000×1240
  stamp-spring2026-bee.png         1000×1240
```

### `pack.json` manifest
```json
{
  "name": "Botanical Spring",
  "designer": "Your Name",
  "version": "1.0",
  "items": [
    { "type": "paper",    "surface": "letter",   "slug": "fern",  "file": "paper-letter-fern.png" },
    { "type": "paper",    "surface": "postcard", "slug": "fern",  "file": "paper-postcard-fern.png" },
    { "type": "envelope", "slug": "linen",       "file": "envelope-linen.svg" },
    { "type": "seal",     "slug": "leaf",        "file": "seal-monogram-leaf.svg" },
    { "type": "stamp",    "series": "Spring 2026", "tier": "rare", "totalMinted": 100,
      "slug": "tulip", "file": "stamp-spring2026-tulip.png" }
  ]
}
```

### Production checklist
- [ ] Exact pixel sizes, **no scaling**.
- [ ] sRGB, profile embedded.
- [ ] Papers: writing zone light (≥85% luminance), drama in the margins.
- [ ] Postcards: keep the **top-left postmark** corner calm.
- [ ] Stamps: transparent PNG, ~0.806 ratio, optional perforation edge.
- [ ] Envelopes/seals: SVG, stamp-slot + seal zones clear.
- [ ] Named per the convention above + a `pack.json`.

---

## 8. What's already built vs. what I'd need to wire up

| Asset | App readiness | To make it sellable end-to-end |
|---|---|---|
| **Stamps** | ✅ Image + tier/series/mint system exists | Upload artwork + metadata; (optional) a "buy a pack" purchase flow. |
| **Paper (image)** | 🟡 Background-image render exists (from photo-postcards) | Add a small `PaperDesign` registry + a palette entry so sold papers are selectable. ~half a day. |
| **Envelopes** | 🟡 Procedural SVG | Add an envelope-template registry to load sold SVG designs. |
| **Wax seals** | 🟡 Procedural SVG | Add a seal-emblem registry. |

When you've got a pack made, tell me which category to wire first (stamps and
paper are the quickest wins) and I'll build the registry + a "premium pack"
unlock/purchase path.
