// End-to-end checks against a fake Sheets page: name-box selection, measured ranges,
// boxes written to the spec, focused captures, privacy masks and the safety guard.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadConfig } from "../src/config.mjs";
import { CaptureSession } from "../src/session.mjs";
import { decodePng } from "../src/sheets.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "capture-test-"));
const repo = join(tmp, "repo");
const course = "04-sheets-foundation-intermediate", chapter = "01-workbook-basics";
let s, geo;

before(async () => {
  mkdirSync(join(repo, course, chapter, "images"), { recursive: true });
  writeFileSync(join(repo, course, chapter, "README.md"), "# 01 - Test\n");
  mkdirSync(join(repo, "shared", "sample-files"), { recursive: true });
  writeFileSync(join(repo, "shared", "sample-files", "Tasks.csv"), "TaskID\nT001\n");
  const cfg = loadConfig({ repo, profileDir: join(tmp, "profile"), runDir: join(tmp, "runs"), backupDir: join(tmp, "backups"), channel: null, headless: true, privateTerms: ["Test Trainer"] });
  s = new CaptureSession(cfg);
  await s.open(pathToFileURL(join(here, "fixtures", "fake-sheets.html")).href);
  geo = await s.page.evaluate(() => window.geometry);
  s.startLab({ course, chapter });
});
after(async () => { await s?.close(); });

const near = (a, b, tol = 3) => Math.abs(a - b) <= tol;
const cellRect = (c0, r0, c1, r1) => ({
  x0: geo.colX[c0], x1: geo.colX[c1 + 1],
  y0: geo.top + geo.HEAD_H + r0 * geo.ROW_H, y1: geo.top + geo.HEAD_H + (r1 + 1) * geo.ROW_H
});
function assertRect(got, want, label) {
  for (const k of ["x0", "y0", "x1", "y1"]) assert.ok(near(got[k], want[k]), `${label} ${k}: got ${got[k]}, want ${want[k]}`);
}

test("selects ranges through the name box and measures them on the canvas", async () => {
  assertRect(await s.selectRange("A1:H13"), cellRect(0, 0, 7, 12), "A1:H13");
  assertRect(await s.selectRange("D5"), cellRect(3, 4, 3, 4), "D5");
  assertRect(await s.selectRange("2:2"), { ...cellRect(0, 1, 12, 1), x1: Math.min(geo.colX.at(-1), 1600) }, "2:2");
  const col = await s.selectRange("C:C");
  assert.ok(near(col.x0, geo.colX[2]) && near(col.x1, geo.colX[3]), `C:C x ${col.x0}-${col.x1}`);
  assert.equal(s.lastMeasure.method, "headers");
});

test("measures another cell and puts the selection back", async () => {
  await s.selectRange("D5");
  s.clearPending();
  const a5 = (await s.boxesFor("range:A5")).rect;
  assertRect(a5, cellRect(0, 4, 0, 4), "A5");
  assert.equal(await (await s.nameBox()).inputValue(), "D5");
});

test("a screenshot saves the full window and writes the pending boxes to the spec", async () => {
  s.clearPending();
  await s.selectRange("A1:H13");
  const r = await s.screenshot({ name: "c04-01-05-select-full-source-range.png" });
  const file = join(repo, "_design/screenshots/full", course, chapter, "c04-01-05-select-full-source-range.png");
  assert.ok(existsSync(file));
  const img = decodePng(readFileSync(file));
  assert.equal(img.width, 1600);
  assert.equal(img.height, 870);
  const spec = JSON.parse(readFileSync(join(repo, "_design/shots", course, `${chapter}.json`), "utf8"));
  assert.equal(spec.raw, `../raw/${course}/${chapter}`);
  const boxes = spec.shots["c04-01-05-select-full-source-range.png"].boxes;
  assert.equal(boxes.length, 2, "name box and range");
  const want = cellRect(0, 0, 7, 12);
  assert.ok(near(boxes[1][0], want.x0) && near(boxes[1][3], want.y1), JSON.stringify(boxes));
  assert.ok(r.previewJpeg && r.previewJpeg.length > 1000);
  assert.ok(readFileSync(join(repo, "_design/shots", course, `${chapter}.json`), "utf8").endsWith("}\n"));
});

test("masks cover the account button, the email, the URL and private names", async () => {
  await s.screenshot({ name: "c04-01-99-mask-check.png", highlight: [] });
  const img = decodePng(readFileSync(join(repo, "_design/screenshots/full", course, chapter, "c04-01-99-mask-check.png")));
  const at = (x, y) => { const i = (y * img.width + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
  const acct = await s.page.locator("#acct").boundingBox();
  assert.deepEqual(at(Math.round(acct.x + acct.width / 2), Math.round(acct.y + acct.height / 2)), [0xe8, 0xea, 0xed], "avatar masked");
  // The note line holds the email and URL; no dark text pixels should survive on it.
  const note = await s.page.locator("#note").boundingBox();
  let dark = 0;
  for (let x = Math.ceil(note.x) + 60; x < note.x + note.width - 2; x++) for (let y = Math.ceil(note.y) + 2; y < note.y + note.height - 2; y++) if (at(x, y)[0] < 100) dark++;
  assert.ok(dark < 30, `unmasked text pixels on the note: ${dark}`);
  // The page itself is left clean afterwards.
  assert.equal(await s.page.locator("#__capture_masks").count(), 0);
});

test("a focused capture keeps its own size and boxes are in its pixels", async () => {
  s.clearPending();
  await s.click("[aria-label='Add Sheet']");
  const add = await s.page.locator("#add").boundingBox();
  const r = await s.screenshot({ name: "c04-01-10a-add-sheet-button.png", focus: "highlights", pad: 20 });
  assert.ok(r.focused);
  const [w, h] = r.size.split("x").map(Number);
  assert.ok(w < 800, `focused width ${w}`);
  const box = r.specBoxes[0];
  // The button sits 20 px in from the clip edge (or less at the screen edge), at 2x.
  assert.ok(near(box[2] - box[0], add.width * 2, 3), `box width ${box[2] - box[0]} vs ${add.width * 2}`);
  assert.ok(box[3] <= h && box[2] <= w);
});

test("a column edge resolves to the boundary between two headings", async () => {
  const e = await s.boxesFor("col-edge:J");
  assert.ok(near((e.rect.x0 + e.rect.x1) / 2, geo.colX[10]), `edge at ${(e.rect.x0 + e.rect.x1) / 2}, want ${geo.colX[10]}`);
  assert.ok(e.rect.y1 <= geo.top + geo.HEAD_H + 2);
});

test("replacing a capture backs up the old file outside the repository", async () => {
  const r = await s.screenshot({ name: "c04-01-05-select-full-source-range.png", highlight: [] });
  assert.ok(r.backup && existsSync(r.backup) && !r.backup.startsWith(repo));
});

test("refuses controls that send or share", async () => {
  await s.click("#share", { highlight: false });
  await assert.rejects(s.click("#send"), /Refused/);
  assert.equal(await s.page.evaluate(() => window.sent), undefined);
  await s.click("#cancel", { highlight: false });
});

test("uploads only from the sample files folder", async () => {
  await assert.rejects(s.upload("#add", ["/etc/passwd"]), /outside/);
});
