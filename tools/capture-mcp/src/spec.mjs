// Where captures and box specs go in a course repository, and how the spec is updated.
//
//   <repo>/_design/screenshots/full/<course>/<chapter>/<name>.png   retained, masked source
//   <repo>/_design/shots/<course>/<chapter>.json                    boxes, arrows, crop
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";

export const NAME_RE = /^c\d{2}-\d{2}-\d{2}[a-z]?-[a-z0-9-]+\.png$/;

export function chapterPaths(repo, course, chapter) {
  if (!repo) throw new Error("No course repository set. Call start_lab with repo, or set repo in the config file.");
  if (!/^\d{2}-[a-z0-9-]+$/.test(course) || !/^\d{2}-[a-z0-9-]+$/.test(chapter))
    throw new Error(`Course and chapter are folder names such as 04-sheets-foundation-intermediate and 01-workbook-basics (got ${course}/${chapter}).`);
  return {
    readme: join(repo, course, chapter, "README.md"),
    images: join(repo, course, chapter, "images"),
    full: join(repo, "_design", "screenshots", "full", course, chapter),
    spec: join(repo, "_design", "shots", course, `${chapter}.json`),
    raw: join(repo, "_design", "shots", "raw", course, chapter)
  };
}

export function readSpec(specPath, course, chapter) {
  if (existsSync(specPath)) return JSON.parse(readFileSync(specPath, "utf8"));
  return { raw: `../raw/${course}/${chapter}`, repoRoot: `../../../${course}`, shots: {} };
}

// Same layout as the hand-written specs: one-space indent and a trailing newline.
export function writeSpec(specPath, spec) {
  mkdirSync(dirname(specPath), { recursive: true });
  writeFileSync(specPath, JSON.stringify(spec, null, 1) + "\n");
}

// Replaces the boxes and arrows for one shot. A crop already in the spec is kept
// unless a new one is given, because crops are framing decisions made by hand.
export function updateShot(spec, name, { boxes, arrows, crop }) {
  const prev = spec.shots[name] || {};
  const shot = {};
  shot.boxes = boxes || [];
  if (arrows && arrows.length) shot.arrows = arrows;
  if (crop) shot.crop = crop;
  else if (prev.crop) shot.crop = prev.crop;
  spec.shots[name] = shot;
  return shot;
}

// Copies a retained source to the backup folder (outside the repository) before it is
// replaced, so an original is never lost even if it was never committed.
export function backupExisting(file, backupRoot, repo, stamp) {
  if (!existsSync(file)) return null;
  const rel = file.startsWith(repo) ? file.slice(repo.length + 1) : basename(file);
  const dest = join(backupRoot, basename(repo), stamp, rel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(file, dest);
  return dest;
}

// [x0, y0, x1, y1] rectangle in CSS px -> a spec box in image px, with an optional
// step number and badge side, clamped to the image.
export function toBox(r, { scale = 1, origin = [0, 0], step, side, width, height } = {}) {
  const clamp = (v, max) => Math.max(0, Math.min(max ?? Infinity, Math.round(v)));
  const b = [
    clamp((r.x0 - origin[0]) * scale, width), clamp((r.y0 - origin[1]) * scale, height),
    clamp((r.x1 - origin[0]) * scale, width), clamp((r.y1 - origin[1]) * scale, height)
  ];
  // annotate-shots only places a badge (and so only reads a side) for a numbered box.
  if (step != null) { b.push(step); if (side) b.push(side); }
  return b;
}
