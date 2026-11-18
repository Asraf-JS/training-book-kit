#!/usr/bin/env node
// Builds a review page with the old (from git) and new lesson images side by side,
// in README order, with each image's caption.
//
//   node bin/compare.mjs <course-repo> <course>/<chapter> [--ref main] [--out review.html]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { planLab } from "../src/lab-plan.mjs";
import { loadConfig } from "../src/config.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const [repoArg, chapterPath] = args;
if (!repoArg || !chapterPath) { console.error("Usage: node bin/compare.mjs <course-repo> <course>/<chapter> [--ref main] [--out file.html]"); process.exit(1); }
const repo = resolve(repoArg);
const ref = opt("--ref", "main");
const out = resolve(opt("--out", join(loadConfig().home, "review", `${chapterPath.replace("/", "__")}.html`)));

const plan = planLab(readFileSync(join(repo, chapterPath, "README.md"), "utf8"));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dataUri = (buf) => buf ? `data:image/png;base64,${buf.toString("base64")}` : null;
const rows = [];
for (const s of plan.sections) for (const im of s.images) {
  const rel = `${chapterPath}/images/${im.name}`;
  const old = spawnSync("git", ["show", `${ref}:${rel}`], { cwd: repo, maxBuffer: 64 << 20 });
  const oldBuf = old.status === 0 ? old.stdout : null;
  const newBuf = existsSync(join(repo, rel)) ? readFileSync(join(repo, rel)) : null;
  const cell = (b, label) => b ? `<figure><img src="${dataUri(b)}" alt="${esc(label)}"><figcaption>${label}</figcaption></figure>` : `<figure class="none"><p>No ${label.toLowerCase()} image</p></figure>`;
  rows.push(`<section><h2>${esc(s.id || "")} step ${im.afterStep}: <code>${esc(im.name)}</code></h2><p class="cap">${esc(im.caption)}</p><div class="pair">${cell(oldBuf, "Old")}${cell(newBuf, "New")}</div></section>`);
}
const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Screenshot Review</title>
<style>
:root{--bg:#f6f7fb;--fg:#1b1f2a;--muted:#5a6275;--card:#fff;--line:#d9dde7}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#12151c;--fg:#e8ebf2;--muted:#a3abbd;--card:#1b2030;--line:#2c3346}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;padding:16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:0 0 4px}.cap{color:var(--muted);margin:0 0 8px}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin:0 0 16px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media (max-width:800px){.pair{grid-template-columns:1fr}}
figure{margin:0}img{width:100%;height:auto;border:1px solid var(--line);border-radius:6px;background:#fff}
figcaption{font-size:13px;color:var(--muted)}.none{display:grid;place-items:center;border:1px dashed var(--line);border-radius:6px;min-height:120px;color:var(--muted)}
</style></head><body><h1>${esc(plan.title)}</h1><p class="cap">${plan.imageCount} images. Old: <code>${esc(ref)}</code>. New: working tree.</p>${rows.join("\n")}</body></html>`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(out);
