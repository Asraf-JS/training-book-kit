#!/usr/bin/env node
// Runs the course repository's screenshot pipeline for one chapter after a capture run:
// prepare-raw.py, seed lesson images that don't exist yet, annotate-shots, optimise.py.
//
//   node bin/pipeline.mjs <course-repo> <course>/<chapter>
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, copyFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [repoArg, chapterPath] = process.argv.slice(2);
if (!repoArg || !chapterPath) { console.error("Usage: node bin/pipeline.mjs <course-repo> <course>/<chapter>"); process.exit(1); }
const repo = resolve(repoArg);
const run = (cmd, args) => {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: repo, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${cmd} failed`);
};
const python = ["python3", "python", "py"].find((p) => spawnSync(p, ["--version"]).status === 0);
if (!python) throw new Error("Python 3 with Pillow is needed for prepare-raw.py and optimise.py.");

run(python, ["_design/shots/prepare-raw.py", chapterPath]);

// annotate-shots only overwrites images that exist, so copy new ones in first.
const specPath = join(repo, "_design/shots", `${chapterPath}.json`);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const images = join(repo, chapterPath, "images");
mkdirSync(images, { recursive: true });
for (const name of Object.keys(spec.shots)) {
  const raw = join(repo, "_design/shots/raw", chapterPath, name);
  if (existsSync(raw) && !existsSync(join(images, name))) { copyFileSync(raw, join(images, name)); console.log(`  new image ${name}`); }
}

// Prefer the course's pinned kit, so boxes look the same as the rest of the course.
const pinned = join(repo, "node_modules/training-book-kit/bin/annotate-shots.mjs");
const local = resolve(dirname(fileURLToPath(import.meta.url)), "../../../bin/annotate-shots.mjs");
run("node", [existsSync(pinned) ? pinned : local, specPath]);
run(python, ["_design/shots/optimise.py", chapterPath]);
