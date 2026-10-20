# Asraf JS brand

The single source for how Asraf Jaafar Sidik's training materials look and sound: course sites, trainer decks, books and anything new. When a colour, font or rule changes, change it here first, then in the courses that use it.

Asraf Jaafar Sidik is an independent Microsoft Certified Trainer (MCT) in Malaysia. His course sites live at asraf-js.github.io.

---

## Logo

An "AS" monogram: black angular strokes (a triangle "A" flowing into an "S") with a small cyan dash at the bottom left.

| File | Use it on |
|------|-----------|
| `brand/logo.png` | The original: black mark on a white square. Course site sidebars and anywhere with a white background |
| `brand/logo-dark.png` | Transparent, black mark. Light slides and pale backgrounds |
| `brand/logo-light.png` | Transparent, white mark. Dark slides and dark backgrounds |

All three keep the cyan dash. Don't stretch the logo, put it in a coloured circle or box, or add effects. Each course copies `logo.png` to its repository root, and the trainer deck uses the two transparent versions.

---

## Colours

| Colour | Hex | What it's for |
|--------|-----|---------------|
| Navy | `#1E2761` | Main brand colour. Headings on light backgrounds, dark panels |
| Deep navy | `#0D1236` | Base of dark title and closing slides |
| Purple | `#6B5DD3` | Primary accent: numbers, icons, key phrases |
| Teal | `#028090` | Secondary accent: links, labels, buttons |
| Cyan | `#00EEFC` | From the logo. Dark backgrounds only (chapter numbers, small labels), never as text on white |
| Text | `#1A1A2E` | Body text |
| Grey | `#616161` | Secondary text, captions, footers |
| Near-white | `#F8F9FC` | Page and slide backgrounds |
| Light panel | `#F5F5F5` | Flat panels |
| Rule | `#E0E0E0` | Thin divider lines |
| Teal cloud | `#F1F7F8`, highlight `#D6ECEE`, text `#027080` | Light side panels, such as the course site sidebar |

Status colours, only when needed: green `#107C10`, red `#D13438`, orange `#D83B01`.

The course book PDFs are the exception. They use a palette per product (`theme/palettes/copilot.css`, `theme/palettes/power-automate.css`), so a Copilot book looks like Copilot and a Power Automate book like Power Automate.

---

## Fonts

- **Segoe UI** throughout: Semibold for headings, Regular for body text, Light for large numbers and stats.
- Sentence case for titles. Left-aligned text. No all-caps headings.
- Segoe UI ships with Windows and Office. Where it isn't available (browser-only tools, the book builder), use the closest system sans-serif.

---

## Design style

The look follows Microsoft's own course decks and Copilot marketing (Fluent): plenty of white space, one or two accents per page or slide, flat and calm.

- **Icons:** thin outline icons in purple. No filled circles behind them.
- **Numbers:** plain large numerals in purple, not numbers inside circles.
- **Cards:** white with small rounded corners and a soft shadow, or flat light-grey panels. Thin grey rules separate rows.
- **Screenshots:** float on a soft teal-to-purple gradient panel with a subtle shadow.
- **Abstract art:** soft mesh-gradient glows with flowing "silk ribbon" strands in navy, purple, teal and cyan. The art stays in corners and along edges, never behind text.

Slide types:

| Slide | Look |
|-------|------|
| Title and closing | Deep navy with purple and teal glows, two ribbons rising from the bottom right, white text, a cyan label, the white logo |
| Title, light version | Near-white with soft teal and purple glows, the same ribbons, a navy title, a teal label, the black logo |
| Section divider | Navy fading to purple with a cyan-to-violet ribbon; the chapter number in cyan, the title in white |
| Content | Near-white with a small ribbon in one corner or along one edge, varied from slide to slide |
| Key message | Pale lavender with a wide ribbon along the bottom; the message in large purple text |

Avoid: accent stripes or coloured bars along an edge, underlines under titles, emoji, stock-photo clichés, rainbow gradients, and the generic "AI" look of navy and teal with circles everywhere.

The reference implementation is the Copilot Chat Basic trainer deck: `_design/deck/build-deck.cjs` (theme, layouts, slide types) and `_design/deck/make-backgrounds.py` (the abstract art), in Asraf-JS/Copilot-Chat-Basic-Workshop. Copy them for a new course's deck.

---

## Course sites

- Colours come from the `:root` variables at the top of each course's `_layouts/default.html`: navy `#1E2761`, teal `#028090`, purple `#6B5DD3`.
- The sidebar is **teal cloud** in light mode (`#F1F7F8`, current chapter `#D6ECEE` with `#027080` text) and stays dark in dark mode.
- Every site includes the kit's `site/` snippets (see `COURSE-CONVENTIONS.md`).

---

## Writing style

`COURSE-CONVENTIONS.md` has the full rules. In short:

- British spelling (organisation, summarise, colour).
- No em dashes or en dashes anywhere. Use commas, colons or parentheses.
- Plain, friendly second person. Short sentences. No hype or filler.
- Bold only for the names of buttons and menus the reader clicks.
- No "not only X but also Y" or "it's not X, it's Y".
- Sign-off line: "Asraf Jaafar Sidik | Microsoft Certified Trainer".

---

## Prompt for Claude chat

Paste this at the start of a chat, with `brand/logo.png` attached, to have Claude work in the brand. Keep it in step with the sections above.

```
You're helping me, Asraf Jaafar Sidik, an independent Microsoft Certified Trainer (MCT) in Malaysia, create materials in my personal brand. Apply everything below unless I say otherwise. My logo is attached.

LOGO
- An "AS" monogram: black angular strokes (a triangle "A" flowing into an "S") with a small cyan dash at the bottom left.
- On light backgrounds use it in black. On dark backgrounds use it in white. Keep the cyan dash in both.
- Never stretch it, put it in a coloured circle or box, or add effects.

COLOURS (hex, and what each is for)
- Navy #1E2761: main brand colour, headings on light backgrounds, dark panels
- Deep navy #0D1236: base of dark title and closing slides
- Purple #6B5DD3: primary accent, numbers, icons, key phrases
- Teal #028090: secondary accent, links, labels, buttons
- Cyan #00EEFC: from the logo. Use only on dark backgrounds (chapter numbers, small labels). Never as text on white.
- Text #1A1A2E, secondary text grey #616161, near-white background #F8F9FC, light panel #F5F5F5, thin rules #E0E0E0
- Soft teal tint #F1F7F8 (with #D6ECEE for highlights) for light side panels
- Status colours only when needed: green #107C10, red #D13438, orange #D83B01

TYPOGRAPHY
- Segoe UI throughout. Segoe UI Semibold for headings, Segoe UI for body text, Segoe UI Light for large numbers and stats.
- Sentence case for titles. Left-aligned text. No all-caps headings.

DESIGN STYLE
- Inspired by Microsoft's own course decks and Copilot marketing (Fluent): plenty of white space, one or two accents per slide, flat and calm.
- Icons: thin outline icons in purple. No filled circles behind icons.
- Numbers: plain large numerals in purple, not numbers inside circles.
- Cards: white with small rounded corners and a soft shadow, or flat light-grey panels. Thin grey rules to separate rows.
- Abstract art: soft mesh-gradient glows plus flowing "silk ribbon" strands in navy, purple, teal and cyan. Keep art in corners and along edges, never behind text.
  - Title slides: deep navy with purple and teal glows and two ribbons rising from the bottom right; white text, cyan small label. (A light version: near-white with soft teal and purple glows, navy title, teal label, black logo.)
  - Section dividers: navy fading to purple with a cyan-to-violet ribbon; chapter number in cyan, title in white.
  - Content slides: near-white with a small ribbon in one corner or along one edge. Vary the corner from slide to slide.
  - Key-message slides: pale lavender with a wide ribbon along the bottom; the message in large purple text.
- Screenshots: float them on a soft teal-to-purple gradient panel with a subtle shadow.
- Avoid: accent stripes or coloured bars along slide edges, underlines under titles, emoji, stock-photo clichés, rainbow gradients, generic "AI" navy-and-teal look with circles everywhere.

WRITING STYLE
- British spelling (organisation, summarise, colour).
- No em dashes or en dashes anywhere. Use commas, colons or parentheses.
- Plain, friendly second person ("you"). Short sentences. No hype or filler.
- Bold only for names of buttons and menus the reader clicks.
- Don't write "not only X but also Y" or "it's not X, it's Y".

SIGN-OFF AND DETAILS
- Name line: "Asraf Jaafar Sidik | Microsoft Certified Trainer".
- Course sites live at asraf-js.github.io (for example asraf-js.github.io/Copilot-Chat-Basic-Workshop).

If something in my request conflicts with this brand, follow my request and tell me briefly what you changed.
```
