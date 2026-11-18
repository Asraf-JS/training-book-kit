#!/usr/bin/env node
// The evaluation task: open a Google Sheet, select A1:H13 with the name box, save a
// masked screenshot and report the selection's on-screen rectangle.
//
//   node bin/eval-sheets.mjs <sheet-url> [out.png] [range]
import { join } from "node:path";
import { loadConfig } from "../src/config.mjs";
import { CaptureSession } from "../src/session.mjs";

const [url, outArg, range = "A1:H13"] = process.argv.slice(2);
if (!url) { console.error("Usage: node bin/eval-sheets.mjs <sheet-url> [out.png] [range]"); process.exit(1); }
const cfg = loadConfig();
const out = outArg || join(cfg.home, "eval", "sheets-eval.png");
const s = new CaptureSession(cfg);
try {
  const st = await s.open(url);
  console.log("status", JSON.stringify(st));
  if (st.signedIn !== "yes") console.log("Not signed in? Run node bin/chrome.mjs login first.");
  const cal = await s.calibration();
  console.log("calibration", JSON.stringify(cal));
  const rect = await s.selectRange(range);
  console.log(`${range} on screen (CSS px):`, JSON.stringify(rect), "measured by", JSON.stringify(s.lastMeasure));
  await s.look({ file: out, type: "png" });
  console.log("masked screenshot:", out);
} finally {
  await s.close();
}
