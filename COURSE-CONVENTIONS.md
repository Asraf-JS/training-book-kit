# Course conventions

The shared rules for Asraf's course repositories: Microsoft-Power-Automate, M365-Copilot-Workshop, Copilot-Chat-Basic-Workshop and any course that builds its book with this kit. Each course repository has a `CLAUDE.md` with what's specific to that course, and points here for everything below.

Course-specific rules in a course's `CLAUDE.md` win over this file.

---

## Who the courses are for

Corporate participants in Malaysia, most of them complete beginners with the product. The trainer is Asraf Jaafar Sidik, an independent Microsoft Certified Trainer. Every course repository is also a public GitHub Pages site that participants use during class, so a participant must be able to follow it without a GitHub account.

---

## Writing style

- British spelling: organisation, summarise, personalise, colour, centre.
- Plain, friendly second person. Mix short sentences with longer ones.
- **No em dashes or en dashes anywhere.** Use commas, colons or parentheses. Chapter titles use a hyphen: `04 - Compare the Quotations`. (Older files in M365-Copilot-Workshop still have em dashes; don't copy them into new writing.)
- No "not only X but also Y" and no "it's not X, it's Y" constructions.
- No hype: no "unlock your potential", "supercharge", "game-changer", "seamless".
- Bold only for UI labels and the occasional key term, never whole sentences.
- Steps are numbered and click by click, written for someone who has never used the product.
- "License" is used throughout for Microsoft licensing, to match Microsoft's own product language.
- Don't invent features, menu names or limits. If you're unsure whether something exists or what it's called, write the step generically and add an HTML comment, `<!-- VERIFY: what to check -->`, so it can be confirmed during screenshot capture.

---

## Scenarios and sample data

- Every company, person, address, phone number and registration number is fictional. Use Malaysian names and places that feel real (Petaling Jaya, Shah Alam, Cyberjaya, Johor Bahru, Kuala Lumpur).
- Use `.example` email domains for fictional companies, so no address can belong to a real business.
- Label sample documents as fictional training material. Don't present a tax rate as the official Malaysian SST rate.
- Answer keys never go in a public repository. Put them in `_trainer/` and add `_trainer/` to `.gitignore`.
- Generate sample files with a script kept in the repository (for example `_design/sample-files/`), so the files and the answer keys come from the same figures.

---

## Repository layout

Microsoft-Power-Automate is the reference layout. Copy it unless a course's `CLAUDE.md` says otherwise.

```
README.md                  Home page (also the site's index content)
index.md                   README.md with Jekyll front matter (layout: default, title: Home)
_config.yml                theme: jekyll-theme-minimal
_layouts/default.html      Sidebar layout; retitle it and change the base path and nav per course
logo.png                   Used by the layout
program-flow.png           Banner rendered from _design/program-flow.html
<Course>-Book.pdf          Built by book/
NN-chapter-name/
  README.md                Chapter notes
  copy-paste.md            Values to paste (Power Automate) or prompts.md (Copilot courses)
  images/                  Screenshots, named NN-MM-short-name.png
  sample-files/ + .zip     Where a chapter needs downloads
_design/                   Program flow source, render.mjs, screenshot prompt and shot scripts
book/                      book.config.json, front/introduction.md, package.json (depends on this kit)
.gitignore                 node_modules/, the browser profile folder, _trainer/
```

---

## Root README

In this order:

1. `# Course Title`, then one line saying what the site holds.
2. "You do not need a GitHub account to use anything on this page."
3. `**Version X.Y**, last updated D Month YYYY.`
4. Program Flow (the banner image).
5. How to Use This Site (notes page, values or prompts page, download all as ZIP, the course book PDF).
6. Course Scenario: a quoted scenario paragraph, then a Stage | What happens table.
7. Chapters table: `# | Chapter | Copy-paste (or Prompts) | What you will do | Time`, with a Day column for multi-day courses.
8. Sample Data, Before You Start, What to Learn Next, Need Help?
9. Footer: `*Last updated: Month YYYY | Trainer: Asraf*` and the copyright line.

---

## Chapter README skeleton

```
# 04 - Chapter Title

One short paragraph: where this chapter sits in the scenario.

> **Copy-paste values:** (or **Prompts:**) every value you need is in the steps, with a Copy button. The [copy-paste page](./copy-paste.md) has them all on one page too.

**Estimated time:** NN minutes

**Your result:** one line.

---

## What You Will Learn
## Before You Begin
## 4.1 Section Title in Title Case
## 4.2 ...
## Independent Practice
## Troubleshooting        (Symptom | What to check table)
## Lesson Summary         (with a one-line "Check yourself" question)
```

- Section headings use Title Case with the chapter number: `## 4.3 Check the Arithmetic`.
- Every screenshot is followed by an italic caption line:
  ```
  ![What the screen shows](./images/04-03-comparison-table.png)

  *One or two sentences on what to notice.*
  ```
- Callouts are blockquotes that start with a bold label. The book colours them by label: **Tip** and **Good habit** (teal), **Try it** (purple), **Key point**, **Important** and **Why it matters** (orange), **Warning**, **Stop** and **Caution** (red), anything else, such as **Note** or **If you don't see this** (blue).
- Values the participant types go in fenced `text` blocks, which get a Copy button on the site.
- Link to other chapters with relative links (`../04-compare-the-quotations/`).

---

## Prompts pages (Copilot courses)

Based on M365-Copilot-Workshop:

- `# NN - Chapter Title: Prompts`, then one line on what the prompts are for.
- Sections are `## Part 1: Short name` (a colon, never a dash).
- Under each Part: `**Session:** new chat / same chat | **Grounding:** web / uploaded files / ...`
- Each prompt in its own plain code block, so it gets a Copy button.
- Placeholders in square brackets, such as `[today's date]` or `[your department]`, with a note to replace them.
- Prompts follow GCSE: **G**oal, **C**ontext, **S**ource, **E**xpectations.

---

## Screenshots

- Never create placeholder or fake images. Reference the planned filename in the README and leave an empty `images/` folder with a `.gitkeep` until it's captured.
- Names: `NN-MM-short-name.png`, matching the chapter number.
- Capture with Codex and Playwright on Asraf's Windows machine, following `_design/screenshot-prompt.md`: headless Edge, a persistent browser profile that git ignores, viewport 1600x900, deviceScaleFactor 1, the account avatar masked.
- Clean captures are copied to `_design/shots/raw/`. Red boxes and step numbers are drawn from `_design/shots/annotations.json` with this kit's `annotate-shots` (`cd book && npm run annotate`).
- Codex records every UI difference in `_design/shots/NOTES.md`. Claude then updates the notes to match and removes the VERIFY comments they answer.
- `node _design/check-screenshots.mjs` lists the screenshots each chapter still needs.

---

## Program flow banner

`_design/program-flow.html` renders to `program-flow.png` with `cd _design && npm install && npm run render`. Two foundation cards on the left, one card per project chapter on a timeline, optional chapters drawn dashed. The same steps go in `programFlow` in `book/book.config.json`.

---

## Book

`book/` holds only `package.json`, `book.config.json` and `front/introduction.md`. Build with `cd book && npm install && npm run build`; the PDF goes to the repository root. Rebuild after any change to a README, a prompts or copy-paste page, or the screenshots. See this kit's README for every config option.

---

## Git and review

- Asraf reviews and merges in GitHub Desktop. Work on a branch and open a pull request. Never push to `main`.
- Once a branch's pull request is merged, start follow-up work on a new branch from the latest `main`.
- Keep the course's `CLAUDE.md` "Where things stand" section current in the same pull request as the work it describes, so the next session starts from the right place.
