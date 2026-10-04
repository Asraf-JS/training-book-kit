#!/usr/bin/env node
// annotate-shots: draws red highlight boxes and step numbers on course screenshots.
//
//   npx annotate-shots path/to/annotations.json [file.png ...]
//
// The spec keeps clean captures apart from the annotated images, so boxes can be
// moved and redrawn at any time without recapturing:
//
//   {
//     "raw": "raw",                 clean captures, relative to this file
//     "repoRoot": "../..",          course repository root, relative to this file
//     "shots": {
//       "03-02-trigger.png": {
//         "boxes": [[x0, y0, x1, y1, 2], [x0, y0, x1, y1]],
//         "crop": [x0, y0, x1, y1]    optional
//       }
//     }
//   }
//
// Coordinates are pixels in the clean capture. The fifth number in a box is the
// step it belongs to, drawn in a circle beside the box; leave it out for a plain
// box. The finished image is written over <repoRoot>/*/images/<file>.
//
// Style matches the series: a 3px red (232, 17, 35) rounded box with 5px padding,
// and a white circle with a red outline and red number.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const specPath = resolve(process.argv[2] || "annotations.json");
if (!existsSync(specPath)) {
  console.error(`No annotations file at ${specPath}.`);
  process.exit(1);
}
const only = new Set(process.argv.slice(3));
const here = dirname(specPath);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const rawDir = resolve(here, spec.raw || "raw");
const repoRoot = resolve(here, spec.repoRoot || "..");

// Inter Bold from the kit's own font package, so numbers look the same everywhere.
const kitDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(resolve(kitDir, "package.json"));
const interFile = resolve(dirname(req.resolve("@fontsource/inter/package.json")), "files/inter-latin-700-normal.woff2");
const interB64 = readFileSync(interFile).toString("base64");

// Finds where a screenshot is published: any images folder one level below the repo root.
function target(name) {
  for (const d of readdirSync(repoRoot, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith(".") || d.name === "node_modules") continue;
    const p = join(repoRoot, d.name, "images", name);
    if (existsSync(p)) return p;
  }
  return null;
}

const launch = existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {};
const browser = await chromium.launch(launch).catch(() => chromium.launch());
const page = await browser.newPage();
await page.setContent("<canvas></canvas>");
await page.evaluate(async (b64) => {
  const font = new FontFace("Inter", `url(data:font/woff2;base64,${b64})`, { weight: "700" });
  document.fonts.add(await font.load());
}, interB64);

let done = 0;
for (const [name, shot] of Object.entries(spec.shots || {})) {
  if (only.size && !only.has(name)) continue;
  const raw = join(rawDir, name);
  const out = target(name);
  if (!existsSync(raw)) { console.warn(`  missing clean capture: ${relative(repoRoot, raw)}`); continue; }
  if (!out) { console.warn(`  no images folder contains ${name}`); continue; }

  // Warn when two padded boxes touch: the red outlines would run into each other.
  const bx = shot.boxes || [];
  for (let i = 0; i < bx.length; i++)
    for (let j = i + 1; j < bx.length; j++) {
      const [a, b] = [bx[i], bx[j]], p = 2 * 5 + 2;
      if (a[0] < b[2] + p && b[0] < a[2] + p && a[1] < b[3] + p && b[1] < a[3] + p)
        console.warn(`  ${name}: boxes ${i + 1} and ${j + 1} overlap`);
    }

  const png = await page.evaluate(async ({ src, boxes, crop }) => {
    const RED = "rgb(232, 17, 35)", PAD = 5, WIDTH = 3, RADIUS = 8, R = 15;
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    g.lineWidth = WIDTH; g.strokeStyle = RED;
    const placed = [];
    const numbered = new Set();
    const rects = boxes.map(([x0, y0, x1, y1]) => [x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD]);
    // A badge spot is free if its circle stays on the image and clear of every box and badge.
    const free = (cx, cy) =>
      cx - R >= 0 && cy - R >= 0 && cx + R <= c.width && cy + R <= c.height &&
      !rects.some(([a, b, c2, d]) => cx + R > a - 2 && cx - R < c2 + 2 && cy + R > b - 2 && cy - R < d + 2) &&
      !placed.some(([px, py]) => Math.hypot(cx - px, cy - py) < 2 * R + 4);
    for (const b of boxes) {
      const [x0, y0, x1, y1, n] = b;
      const r = [x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD];
      g.beginPath(); g.roundRect(r[0], r[1], r[2] - r[0], r[3] - r[1], RADIUS); g.stroke();
      // Each step number appears once per screenshot, on its first box.
      if (!n || numbered.has(n)) continue;
      numbered.add(n);
      const gap = R + 8, midX = (r[0] + r[2]) / 2, midY = (r[1] + r[3]) / 2;
      // Right of the box first, then left, above, below; then nudge further out.
      const spots = [];
      for (const k of [1, 2, 3]) {
        const d = gap + (k - 1) * (2 * R + 4);
        spots.push([r[2] + d, midY], [r[0] - d, midY], [midX, r[1] - d], [midX, r[3] + d],
                   [r[2] + d, r[1]], [r[2] + d, r[3]]);
      }
      const [cx, cy] = spots.find(([x, y]) => free(x, y)) || spots[0];
      placed.push([cx, cy]);
      g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI);
      g.fillStyle = "#fff"; g.fill(); g.stroke();
      g.fillStyle = RED; g.font = "700 17px Inter"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(n), cx, cy + 1);
    }
    let outC = c;
    if (crop) {
      outC = document.createElement("canvas");
      outC.width = crop[2] - crop[0]; outC.height = crop[3] - crop[1];
      outC.getContext("2d").drawImage(c, crop[0], crop[1], outC.width, outC.height, 0, 0, outC.width, outC.height);
    }
    return outC.toDataURL("image/png").split(",")[1];
  }, { src: `data:image/png;base64,${readFileSync(raw).toString("base64")}`, boxes: shot.boxes || [], crop: shot.crop || null });

  writeFileSync(out, Buffer.from(png, "base64"));
  console.log(`  ${relative(repoRoot, out)}`);
  done++;
}
await browser.close();
console.log(`Annotated ${done} screenshot(s).`);
