# capture-mcp

A small MCP server that lets Claude run a lab in a real, signed-in Chrome and take the screenshots itself. It follows the README's steps, saves each capture under the exact file name the README uses, and writes the red boxes into the chapter's `_design/shots` JSON spec, measured from what it actually clicked or selected. No more guessing coordinates.

It writes into the layout the course repositories already use:

| What | Where |
|---|---|
| Full-window capture, masked, uncropped | `_design/screenshots/full/<course>/<chapter>/<name>.png` |
| Boxes and arrows, in 1600 px coordinates | `_design/shots/<course>/<chapter>.json` |
| Backup of any capture it replaces | `%LOCALAPPDATA%\capture-mcp\backups\` (outside every repository) |

Then the usual pipeline (prepare-raw, annotate-shots, optimise) turns them into lesson images. `bin/pipeline.mjs` runs all three for you.

## Why a custom server

I tried the options in order of simplicity against one task: open a Google Sheet, select A1:H13 with the name box, take a screenshot and report where the selection is on screen.

- **Claude in Chrome** stays signed in, but its screenshots come back to Claude as pictures. It can't save a PNG under a chosen name, fix the window size or mask anything.
- **Computer use** sees the whole desktop, scaled down. There are no element rectangles and no files.
- **The Playwright MCP server** has a persistent profile, a fixed viewport and file screenshots. But it has nothing for the Sheets grid (a canvas, so cells aren't page elements), no masking, and no way to write the box spec. Every box would be hand-written JavaScript again.
- **Plain Playwright** with a persistent profile does all of it, so this server wraps it.

For the Sheets grid, it types the address into the name box (as learners do), then finds the selection on screen from the highlighted column and row headings, with the blue selection outline as a fallback. That lands exactly on cell boundaries for a cell, a range, a whole row (`2:2`) or a whole column (`C:C`).

## What you need

- Google Chrome
- Node.js 20 or later
- Python 3 with Pillow (the course pipeline already needs it)
- A clone of this kit and of the course repository

## Set up (once)

1. Install the server's packages:

   ```text
   cd training-book-kit\tools\capture-mcp
   npm install
   ```

2. Create the config file at `%LOCALAPPDATA%\capture-mcp\config.json` (on a Mac or Linux, `~/.capture-mcp/config.json`). Copy `config.example.json` and change `repo` to your Google-Workspace folder. Put the training account's display name in `privateTerms`, so it's masked wherever it appears as text. This file lives outside every repository, so its contents never get committed.

3. Sign in to the training account, once:

   ```text
   node bin\chrome.mjs login
   ```

   This opens an ordinary Chrome window with a dedicated profile at `%LOCALAPPDATA%\capture-mcp\profile`. Sign in with **the training account only**, and close every window it opened. The sign-in stays in that profile. The server refuses to use a profile folder that sits inside a git repository, because the profile holds Google's cookies.

   Chrome is started by itself here, not by Playwright. Google often refuses a sign-in from a browser under automation ("This browser or app may not be secure"), but it's happy with a profile that signed in normally.

4. Check it works. Make a practice copy of any fictional sheet in the training account's Drive, then:

   ```text
   node bin\eval-sheets.mjs "<the sheet's link>"
   ```

   It should say `signedIn: "yes"`, print the A1:H13 rectangle and save a masked screenshot to `%LOCALAPPDATA%\capture-mcp\eval\`. Open that PNG: the avatar should be a grey block.

5. Add the server to Claude Code:

   ```text
   claude mcp add capture --scope user -- node C:\path\to\training-book-kit\tools\capture-mcp\server.mjs
   ```

6. Copy `training-book-kit\skills\capture-lab` into `%USERPROFILE%\.claude\skills\`, as you did for `write-lab-chapter`. It tells Claude how to run a lab with these tools.

## Start a capture run

Open Claude Code in the Google-Workspace folder and ask, for example:

> Use the capture-lab skill to recapture 04-sheets-foundation-intermediate/01-workbook-basics in a fresh practice folder.

Claude creates a branch, starts the lab with `start_lab` and works through the steps in a visible Chrome window, 1600 x 870, at 100% zoom. Leave that window alone while it works; watching is fine. After the run it builds the lesson images, runs `npm run check` and `npm run build:site`, makes a side-by-side review page of old and new images, and opens a pull request.

## When Google asks you to verify

Now and then Google will show a "Verify it's you" page, a CAPTCHA or a consent screen, usually after a password change or on a new network. Claude can't and shouldn't answer these. It stops and tells you what's on screen.

1. Do the verification in the capture window itself (the Chrome window Claude is driving).
2. Don't click anything else. Claude is waiting for the page to move on (`wait_for`) and carries on by itself once it does.
3. If the window says you're signed out, close it, run `node bin\chrome.mjs login` again, then ask Claude to continue from the step it stopped at.

Claude also stops for any step it can't automate safely. Uploads don't need you: the server answers Chrome's file chooser with files from `shared/sample-files`, so no Windows dialog appears.

## Another way to connect: your own Chrome window

If Google keeps refusing the Playwright-started window, start Chrome yourself and let the server connect to it:

```text
node bin\chrome.mjs cdp
```

Then set `"mode": "cdp"` in the config. The server opens its own tab in that window and leaves your other tabs alone. It uses the same dedicated profile, never your everyday one.

## The tools

| Tool | What it does |
|---|---|
| `start_lab` | Picks the chapter and returns the lab plan: steps, copy blocks and each image with the step it follows |
| `status`, `look` | Where the browser is, whether it's signed in, and a masked picture of the window |
| `open`, `click`, `hover`, `drag`, `type`, `key`, `paste` | Drive the browser. `paste` puts a copy block on the clipboard and presses Ctrl+V |
| `select_range` | Types an address into the Sheets name box and measures the selection |
| `upload` | Answers a file chooser with sample files |
| `wait_for` | Waits for a URL, element or text, for example after you finish a verification |
| `find`, `aria_snapshot`, `boxes_for` | Find reliable targets and their rectangles |
| `screenshot` | Saves the masked capture and writes its boxes to the spec. With `focus`, a small 2x capture of one control |
| `tabs`, `calibrate`, `clear_boxes`, `close` | Housekeeping |

Targets are Playwright selectors (`role=button[name="New"]`, `text=Summary`, `[aria-label="Add Sheet"]`) or one of these: `namebox`, `range:A1:H13`, `col-edge:J` (the border between the J and K headings), `rect:x0,y0,x1,y1` and `point:x,y`.

## Privacy and safety

Before every capture the server covers, in grey:

- the Google account button and avatar
- any email address, real URL or long file ID in the page's text, labels or input boxes
- every term in `privateTerms` (the training account's name, which is also the owner name in the Share dialog)

The masks are drawn into the page before the screenshot is taken, so nothing unmasked is ever written to disk. Text inside the Sheets grid and the Docs page is drawn on a canvas and can't be checked, which is fine because it only ever holds the fictional sample data. Claude also gets a preview of each capture with the masks and boxes drawn, and the skill tells it to stop if anything private shows.

The server refuses to click controls that send, share, publish or delete (Send, Publish, Move to bin, Delete forever, and Share, Done or Save inside a dialog), so the Share and Publish dialogs can be opened and captured but not saved. Uploads only accept files from `shared/sample-files`. URLs and file IDs are stripped from what the server reports back and from its run log.

## Troubleshooting

| Problem | What to try |
|---|---|
| `status` warns the zoom isn't 100% | Click the capture window and press Ctrl+0 |
| A range measures wrongly, or "couldn't see the selection" | Call `calibrate`. If Google has changed its selection colours, adjust `sheets.outline` and `sheets.header` in the config |
| "Can't find the Sheets name box" | Google may have renamed it. Run `find` with `Name box` and add the working selector to `sheets.nameBox` in the config |
| Google says the browser may not be secure | Sign in with `node bin\chrome.mjs login` instead, or use the `cdp` mode above |

## Tests

```text
npm test
```

The tests drive a fake Sheets page (`test/fixtures/fake-sheets.html`) with a canvas grid, a name box and Google's selection colours. They check range measurement, boxes in the spec, focused captures, masks, backups and the safety guard. They don't touch Google.
