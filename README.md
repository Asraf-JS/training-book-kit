# Training book kit

Shared build kit for Asraf's series of participant books. It turns a course's Markdown into a print-ready A4 PDF with a cover, contents, chapters and back cover, all in one consistent design.

Every book in the series uses this kit, so a change here (the layout, a palette, the About the author page) reaches every book on its next build.

## What's in the kit

| Path | What it is |
|------|-----------|
| `bin/build-book.mjs` | The `build-book` command. Converts the Markdown with marked, lays out pages with paged.js and prints the PDF with Chromium |
| `theme/series.css` | The shared layout for every book |
| `theme/palettes/` | One colour file per product: `copilot.css`, `power-automate.css` |
| `front/about-the-author.md` | The About the author page, shared by every book |

Fonts (Inter and JetBrains Mono) come from npm packages and are embedded in the PDF.

## What each course keeps

Each course repository has a `book/` folder with only the files specific to that course:

```
book/
  package.json          depends on this kit
  book.config.json      title, cover text, palette, chapters, program flow
  front/introduction.md the course's "Before you begin" chapter
```

`book/package.json`:

```json
{
  "name": "my-course-book",
  "private": true,
  "scripts": { "build": "build-book" },
  "dependencies": {
    "training-book-kit": "github:Asraf-JS/training-book-kit"
  }
}
```

## Build a book

You need [Node.js](https://nodejs.org/) 20 or later.

```
cd book
npm install
npx playwright install chromium
npm run build
```

The PDF is written to the path in `output` in `book.config.json`.

To pick up changes made to the kit since you last installed it:

```
npm update training-book-kit
```

## book.config.json

See the [Microsoft 365 Copilot Workshop](https://github.com/Asraf-JS/M365-Copilot-Workshop/blob/main/book/book.config.json) for a complete example. The main fields:

| Field | What it does |
|-------|-------------|
| `palette` | A palette name from `theme/palettes` (for example `copilot`), or a path to the course's own `.css` file |
| `kicker`, `titleLines`, `subtitle`, `blurb`, `coverIcons` | Cover text and graphic. In `titleLines`, an object like `{ "highlight": "365 Copilot" }` prints that line in the palette's gradient |
| `runningTitle` | The book title in page headers |
| `edition`, `year`, `version`, `author`, `authorShort`, `credential`, `trademark` | Cover footer and imprint page |
| `repoUrl` | The course repository. Links to sample files point here |
| `output` | Where to write the PDF, relative to `book/` |
| `front` | Pages between the imprint and the contents. Use `kit:front/about-the-author.md` for the shared author page |
| `intro` | The introduction chapter. Put `{{program-flow}}` on its own line where the program flow page should go |
| `chapters` | One entry per chapter: `notes` (the topic's README) and optional `exercises` (its prompts) |
| `programFlow` | The program flow page: `foundations`, then `steps` with app, icon, colour, stage, description and output |
| `backCover` | Back cover text |
| `repoRoot` | Optional. The course repository root, relative to `book/`. Defaults to `..` |

A file path that starts with `kit:` is read from this kit. Any other path is relative to the course's `book/` folder.

Cover and program flow icons can be any of `chat`, `doc`, `check`, `spark`, `play`, `plus`, `lines` and `nodes`, or a single letter such as `W` or `X`.

## How the Markdown is converted

- Each chapter's notes come first, followed by its exercises under "Hands-on exercises".
- The topic number is dropped from the heading ("03 — Copilot Chat" becomes Chapter 3, "Copilot Chat").
- Website-only lines are removed: "Prompts to Try" links and Back/Next navigation.
- An image followed by an italic line becomes a figure with a caption. An image titled `"landscape"` gets its own page, turned sideways.
- Callouts are coloured by their opening bold label: Tip and Good habit are teal, Try it is purple, Key point and Why it matters are orange, and everything else (Note, License note) is blue.
- Links to other pages of the site become plain text. Links to files point to the course repository on GitHub.

## Adding a product palette

Copy `theme/palettes/copilot.css`, rename it after the product, and change the colour values. Keep every variable name, since `series.css` uses all of them.
