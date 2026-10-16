---
name: interactive-training-animations
description: Review software-training instructions and existing screenshots or screen recordings, decide which steps need motion, and build lightweight, accessible cursor-driven HTML animations for GitHub Pages training manuals. Use for ribbon/menu clicks, navigation, drag-and-drop, Ctrl/Shift-click selections, hover, double-click, and right-click. Preserve static screenshots for print.
---

# Interactive Training Animations

## Purpose

Improve participant-facing software training manuals by showing **how** to perform interactions that are difficult to communicate in still images. The normal output is an HTML/CSS/JavaScript animation using authentic screenshots, not a generated GIF or simulated replacement UI. The site must remain fast for roughly 400 monthly learners on GitHub Pages.

Treat animation as an enhancement to the instructional step. Never turn every screenshot into an animation by default.

## Respect the existing course system

1. Read the current repository's `CLAUDE.md` or `AGENTS.md` and course-specific rules before making changes. Course-specific rules take precedence.
2. For Asraf-JS course repositories, follow `Asraf-JS/training-book-kit/COURSE-CONVENTIONS.md`. Retain the existing numbered, click-by-click instructions, British spelling, accessible chapter navigation, lightbox and printed book behaviour. Do not use em dashes or en dashes in participant text.
3. Keep clean screenshot sources in `_design/shots/raw/` when the repository uses that system. Preserve the original annotated chapter screenshots and the `annotate-shots` workflow. Do not overwrite originals with animations.
4. Do not change site styling, course content, PDF production, or other chapters unless necessary for the requested step.
5. For GitHub changes, create a branch and a pull request. Do not push directly to `main`. Ask for approval before changes that materially alter what learners are taught, or before deploying to a public site when the user has not authorised it.

## First: classify each step

Review the **actual instruction, preceding and following steps, and available media**. Return a short proposal before batch conversion. Choose:

| Mode | Use when | Example |
| --- | --- | --- |
| `static` | Motion adds little; explanation, entry of long text, checkpoint, final result | Confirm a table has six rows |
| `highlight` | Learner needs to locate or verify something but not see movement | Locate the Subject Filter field |
| `animated` | Learner must see where to move/click, menu changes, drag direction, key modifier, or hover result | Open Insert > Table; Ctrl+click several objects |

Only animate the smallest useful action. Prefer one click or continuous interaction per animation. A short related menu path can be one animation if it is clearer than splitting it.

Candidate actions: `click`, `double-click`, `right-click`, `hover`, `menu-path`, `scroll-then-click`, `drag-drop`, `drag-fill`, `ctrl-click`, `shift-click`, `range-drag`, `keyboard-mouse-combo`.

Do not assume that every item classified `animated` can be built from the available screenshots. Mark missing or ambiguous before/after states as `needs-capture`.

## Verify sources and instructional truth

- Use only genuine provided screenshots or video frames of the application being taught. Do not generate replacement software UI, invent buttons, fabricate dialog states, or guess the resulting screen.
- Prefer *clean* captures from the same application version, window size, browser zoom, data and account. An already annotated screenshot may be displayed, but its red boxes and step numbers must not move independently or be misrepresented as part of the UI.
- Inspect source dimensions and the visible control. Identify hotspots using the screenshot's **native pixel coordinates**. Record those coordinates and screenshot paths in a step manifest.
- A single screenshot may support a cursor moving and clicking, with an honest held end state. A before/after transition needs two verified matching screenshots. Do not show a UI change that the available images cannot support.
- If screenshots are mismatched, blurred, cropped so the target is missing, or depict a different UI state, stop for that step, report the issue and request new capture.
- If working from a recording, identify actual start/end times and prefer the real clip when reconstruction would misrepresent the interaction. Keep provenance as `recorded` or `simulated` in the manifest.

## Interaction animation rules

1. **Single click:** Start cursor away from the target, move smoothly, pause briefly, show a restrained click pulse, then show the verified resulting state if available.
2. **Menus and navigation:** Show the initial target, click, menu/ribbon appearing, move to the next target and select it. Never invent intermediate menu states.
3. **Drag-and-drop / fill handle:** Show cursor at the source, `mouse-down` or grip cue, held movement to the exact destination, release and verified result. Optionally show a subtle source/destination highlight. Cursor motion alone does not prove that an object was dragged.
4. **Ctrl+click / Shift+click:** Show an on-screen `Ctrl` or `Shift` key indicator in its held state *before and during* the relevant click(s), then release it. Show each selection state only if supported by screenshots. Use `Command` instead only for a verified macOS workflow.
5. **Right-click:** Display the context-menu result from a real screenshot, not an invented menu.
6. **Double-click:** Two visible click pulses, close enough to imply a double-click.
7. **Hover:** Move and rest over the hotspot, then reveal the actual documented hover effect.
8. **Scroll-then-click:** Show a clear scroll transition when required; avoid confusing sudden jumps.
9. Typical target duration is 2 to 6 seconds per micro-step, longer only where an additional state or menu needs reading time. Loop only when helpful, with a visible pause/replay control.
10. Explanations and subtitles remain real selectable HTML text, not baked into a moving screenshot. Avoid flashy transitions and unnecessary zoom.

## Technical implementation

- Use responsive vanilla HTML/CSS/JavaScript or the site's existing front-end stack. Do not add a large animation framework for a simple cursor interaction.
- Position the cursor, pulse and hotspots in one **shared screenshot coordinate system**. Base dimensions on `img.naturalWidth` and `img.naturalHeight`, then map to the displayed image size. If cropping or zooming, apply the same coordinate transform to background and overlays. Never hard-code coordinates for one screen size and hope they work on mobile.
- Ensure click targets refer to the actual visible UI controls. Use image readiness events before starting animations.
- Separate reusable runtime from per-step metadata. Ideally one shared `site/step-animation.js` and `site/step-animation.css`, plus small step manifests rather than duplicated HTML/JS per step.
- Use relative paths for site-owned assets and respect the GitHub Pages repository base path. Avoid hotlinking `raw.githubusercontent.com` in production manuals.
- Default to screenshots plus simulated cursor. Use MP4/WebM for actual recorded clips when needed. GIF is an optional export, not a default.
- Lazy-load off-screen images and animations. Cache reusable assets; optimise screenshots to WebP or PNG after checking legibility. Do not duplicate the same source image for every step.
- Honor `prefers-reduced-motion`: show a static final/before screenshot and clear written directions rather than forced animation. Provide Pause, Replay, and keyboard-focusable controls; do not autoplay motion indefinitely without controls.
- Ensure overlays do not block existing lightbox, navigation, copy buttons or course interactions.
- Printable PDF/book view must use one meaningful static screenshot and caption. Do not rely on motion to communicate required instructions.

## Suggested per-step metadata

Use the existing site's data model if available. Otherwise, use a small JSON-like manifest with native pixel coordinates. Example values are **illustrative**, not validated positions in any repository:

```json
{
  "id": "02-02-05-insert-tab",
  "chapter": "02-prepare-workspace",
  "instruction": "Select the Insert tab.",
  "mode": "animated",
  "interaction": "click",
  "media": {
    "before": "images/02-02-workbook-rows.png",
    "after": "images/02-05-insert-tab.png"
  },
  "sourceType": "simulated",
  "canvas": [1600, 900],
  "cursorStart": [450, 320],
  "targets": [{"label": "Insert", "point": [140, 64]}],
  "timingMs": {"move": 1000, "clickPause": 160, "resultHold": 1500},
  "review": "pending"
}
```

Only change `review` to `verified` after confirming exact positions, compatible screenshots and the finished animation. If there is no verifiable after screenshot, omit `after` and label the result honestly instead of inventing a state change.

## Workflow per request

1. **Discover:** Identify the target course, chapter and site layout. Read instructions, screenshots, course conventions, screenshot annotation configuration and any existing animation components.
2. **Audit:** Classify a representative set of steps as `static`, `highlight`, `animated`, or `needs-capture`. Present the choices and reasoning succinctly. Respect the requested scope and confirm uncertain targets.
3. **Prototype:** Build one minimal animation against real screenshot assets and inspect it visually.
4. **Implement:** Reuse the shared runtime to create additional approved animations. Keep original text and static screenshots available as fallbacks.
5. **Verify:** Open in a browser using a local preview where possible, and test at desktop and narrow mobile widths. Check exact hotspots, transitions, key badges, drag paths, focus, reduced motion, replay, image loading and printed output.
6. **Measure:** Report combined transferred bytes for HTML/CSS/JS plus media, and estimate `(bytes transferred per learner) × (monthly learners) × (average views per learner)`. State assumptions. Consider caching and avoid claiming a guaranteed bandwidth figure.
7. **Deliver:** Include changed files, classification table, preview or screenshots, measured sizes, any unverified steps and how to run/review the work. For GitHub, open a branch/PR rather than directly modifying `main`.

## Acceptance checks

- Every animated hotspot is visually aligned with the correct UI control.
- The animation conveys a real action and does not falsely imply a UI result.
- Drag destinations, intermediate selections and keyboard modifiers are correct.
- Desktop and mobile show the same correct interaction; zoom/crop does not drift.
- Pause/replay work; reduced-motion users get readable instructions and a static fallback.
- PDF output still includes useful still screenshots and captions.
- No visual regression to existing chapters or shared layout.
- Network/media size is reported; no GIF/video assets are introduced without need.

## First proof-of-concept

Start with `Asraf-JS/Microsoft-Power-Automate`, Chapter 2, Section 2.2, Step 5, where the learner clicks **Insert** and then **Table** in Excel for the web. Reference the existing `02-prepare-workspace/images/02-02-workbook-rows.png` and `02-05-insert-tab.png`. These are distinct annotated frames, so first inspect whether clean source frames exist and whether their visual states are compatible. Demonstrate the **Insert** click; only animate the **Table** click and result if a verified resulting frame is available. Do not assume the current experimental standalone HTML is production-ready.