#!/usr/bin/env node
// Prints the capture plan for a lab README.
//
//   node bin/lab-plan.mjs <course-repo> <course>/<chapter> [--summary]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { planLab } from "../src/lab-plan.mjs";

const [repo, chapterPath, flag] = process.argv.slice(2);
if (!repo || !chapterPath) {
  console.error("Usage: node bin/lab-plan.mjs <course-repo> <course>/<chapter> [--summary]");
  process.exit(1);
}
const plan = planLab(readFileSync(join(repo, chapterPath, "README.md"), "utf8"), { fullDir: join(repo, "_design/screenshots/full", chapterPath) });
if (flag !== "--summary") { console.log(JSON.stringify(plan, null, 1)); process.exit(0); }
console.log(`${plan.title}: ${plan.imageCount} images`);
for (const s of plan.sections) {
  console.log(`\n${s.id ? s.id + " " : ""}${s.title}`);
  for (const st of s.steps) {
    const extra = [st.copy.length && `${st.copy.length} copy block`, st.tables.length && "typed table"].filter(Boolean).join(", ");
    console.log(`  ${st.n}. ${st.text.slice(0, 90)}${st.text.length > 90 ? "..." : ""}${extra ? ` [${extra}]` : ""}`);
    for (const im of s.images.filter((x) => x.afterStep === st.n)) console.log(`       -> ${im.name}${im.focused ? " (focused)" : ""}`);
  }
  for (const im of s.images.filter((x) => x.afterStep === 0)) console.log(`  -> ${im.name}${im.focused ? " (focused)" : ""}`);
}
