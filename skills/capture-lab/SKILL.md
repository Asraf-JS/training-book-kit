---
name: capture-lab
description: Run one lab chapter from its README in a real, signed-in Chrome with the capture MCP server, taking every screenshot the README references under its exact file name and writing the red boxes into the chapter's _design/shots JSON spec. Use when Asraf asks to capture, recapture or refresh a lab's screenshots in Google Workspace (Drive, Docs, Sheets, Slides, NotebookLM, Gemini panels).
---

# Capture a Lab

The `capture` MCP server (training-book-kit `tools/capture-mcp/`, set up as its README explains) drives a visible Chrome that's signed in to Asraf's dedicated training account. You follow the lab's numbered steps as a learner would, and take each screenshot straight after the step it sits under. The tool saves the masked full-window PNG under `_design/screenshots/full/<course>/<chapter>/` and writes the boxes into `_design/shots/<course>/<chapter>.json`, so annotate-shots draws them without anyone guessing coordinates.

## Rules that never bend

- Only the training account, and only the fictional files in `shared/sample-files`. If `status` or `look` shows any other account, stop and tell Asraf.
- Work only inside a fresh practice folder for this run (name it as the lab says; if one by that name already exists, add ` (capture YYYY-MM-DD)` rather than reuse or delete it).
- Never share, change sharing, publish to the web, send email or invitations, or delete anything outside the practice folder. Open Share and Publish dialogs to capture them, then close them with **Escape** or their close/Cancel button. The tool refuses Send, Publish and dialog Share/Done buttons; don't try to get round it, and never pass `allow_unsafe` unless Asraf has said so for that exact click.
- Keep every full-window capture uncropped. Crops belong in the spec's `crop`, chosen by hand later.
- Work on a branch in the course repository and open a pull request. Don't merge until Asraf says "merge it".

## Before you start

1. `start_lab` with the course and chapter folder names. Read the plan it returns: each image has `afterStep` (capture straight after that numbered step in its section) and `focused` (a small focused capture of one control).
2. `status`. You want `signedIn: "yes"`, `viewport: "1600x870"`, `devicePixelRatio: 1` and no warnings. If it isn't signed in, stop and ask Asraf to run `node bin/chrome.mjs login` (see the tool README).
3. Read the course's `_design/shots/README.md` annotation rules and look at two or three existing lesson images for the chapter, so new boxes follow the same habits (which controls get boxed, step numbers or plain boxes).

## Working through the steps

For each numbered step: do exactly what the README says, with the controls it names. Prefer the learner's own route (the menu or button in the step) over shortcuts, because the screenshots must match the words.

- **Clicking:** `click` with a selector. Use `find` or `aria_snapshot` to get a reliable one; good forms are `role=button[name="New"]`, `role=menuitem[name="Save as Google Sheets"]`, `[aria-label="Add Sheet"]` and `text=Summary`. Every click is remembered as a box for the next screenshot. Pass `highlight: false` for clicks that only set things up (closing a tip, dismissing a banner), or call `clear_boxes` before the click that matters.
- **Sheets cells and ranges:** never click the canvas by guesswork. `select_range` types into the name box exactly as the lab tells learners to, and measures the selection; it remembers both the name box and the range as boxes. To box another cell without moving the selection (the TaskID on the same row, say), add `{"target": "range:A5"}` to the screenshot's `highlight`.
- **Column edges:** `hover` on `col-edge:J` shows the resize bar; `drag` from `col-edge:J` with `dx` widens the column.
- **Typed text:** `type` for short values, `key` for Enter, Tab and shortcuts. For a copy block in the README, use `paste` with the block's text exactly as written (tabs and all), after clicking the cell the step names.
- **Typed tables** (`<div data-no-copy></div>` before a table): type them cell by cell with `type` and `key Tab` / `key Enter`, as the learner would.
- **Uploads:** `upload` with the button or menu item that opens the file chooser and the sample file's name. No operating-system dialog appears. In Drive, open **New** first, then upload with `role=menuitem[name="File upload"]` (check the name with `find`). In Sheets, prefer **File > Import > Upload** over anything that needs an OS dialog.
- **Check as you go:** `look` returns a masked picture of the window. Use it after anything that loads, opens a new tab or might show a banner. `tabs` switches tabs; the newest tab becomes active by itself.

## Taking the screenshots

When you reach an image in the plan:

1. Make sure the screen shows only work completed by that step, with no stray tooltip, banner or half-open menu (unless the image is of the menu).
2. `screenshot` with the README's exact file name. By default its boxes are everything clicked or selected since the last screenshot. Set `highlight` yourself when the image needs something else: for example `["pending", {"target": "range:A5"}]`, or `[]` for no boxes.
3. Step numbers: the Docs and Sheets Foundation labs use plain boxes. Only add `step` (or `steps`) where the existing images for that chapter do.
4. **Focused captures** (`focused: true`, such as a tab arrow, a column edge or the **+** button): pass `focus` (a target, or `"highlights"`) and a small `pad`. The tool saves it at 2x and keeps it under 800 px so prepare-raw leaves its size alone. For a drag, add an arrow: `arrows: [{"from": "col-edge:J", "dx": 50, "offset": [10, 30]}]`.
5. Check the preview that comes back. It has the masks and boxes drawn. If a box is wrong, fix the screen or the highlight list and take it again (the old file is backed up outside the repository each time). If a mask covers something learners need, or something private is visible, stop and tell Asraf rather than saving it.

## When you can't automate a step

Stop and ask Asraf to do that one action in the capture window, then call `wait_for` with something that will be true afterwards (`url_excludes: "accounts.google.com"`, a selector, or text) and carry on. Typical cases:

- Google asks to verify it's you, shows a CAPTCHA, or wants consent for a new app or feature.
- A Gemini or NotebookLM welcome screen asks to accept terms.
- An operating-system dialog the tool can't answer (most uploads don't need one).

Say clearly what to click and why, and don't do anything else in the browser until `wait_for` returns `done: true`.

## After the run

1. Close the browser with `close`.
2. From the course repository: `node <kit>/tools/capture-mcp/bin/pipeline.mjs . <course>/<chapter>` (prepare-raw, new images seeded, annotate-shots, optimise).
3. Look at every finished image in the chapter's `images/` folder. Then run the course checks and site build (`npm run check`, `npm run build:site`).
4. `node <kit>/tools/capture-mcp/bin/compare.mjs . <course>/<chapter> --ref main` writes a side-by-side review page of old and new images. Publish it as an artifact for Asraf to review.
5. Commit the full sources, the spec and the lesson images on a branch, update the course `CLAUDE.md` if its screenshot status changed, and open a pull request. Record anything the README says that the real screen didn't match, so the notes can be fixed.
