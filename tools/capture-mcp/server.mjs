#!/usr/bin/env node
// capture-mcp: an MCP server that lets Claude drive a signed-in Chrome through a
// lab and save masked screenshots and their red-box specs into a course repository.
// See README.md for setup.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./src/config.mjs";
import { CaptureSession } from "./src/session.mjs";
import { planLab } from "./src/lab-plan.mjs";
import { readFileSync } from "node:fs";

const cfg = loadConfig();
const session = new CaptureSession(cfg);
const server = new McpServer({ name: "capture", version: "0.1.0" });

const text = (obj) => ({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 1) }] });
const wrap = (fn) => async (args) => {
  try { return await fn(args || {}); }
  catch (e) { return { isError: true, content: [{ type: "text", text: String(e.message || e) }] }; }
};

const TARGET_HELP = "A Playwright selector (role=button[name=\"Share\"], text=Summary, [aria-label=\"Add Sheet\"]), " +
  "or namebox, range:A1:H13 (a Sheets cell or range), col-edge:J (the J|K heading boundary), rect:x0,y0,x1,y1 or point:x,y in CSS px.";
const target = z.string().describe(TARGET_HELP);

server.registerTool("start_lab", {
  description: "Choose the chapter that captures and box specs are written into. Call first. Returns the lab plan: sections, numbered steps, copy blocks and each image with the step it follows.",
  inputSchema: { course: z.string().describe("e.g. 04-sheets-foundation-intermediate"), chapter: z.string().describe("e.g. 01-workbook-basics"), repo: z.string().optional().describe("Course repository path; defaults to repo in the config file") }
}, wrap(async ({ course, chapter, repo }) => {
  const lab = session.startLab({ repo, course, chapter });
  const plan = planLab(readFileSync(lab.paths.readme, "utf8"), { fullDir: lab.paths.full });
  return text({ lab: `${course}/${chapter}`, spec: lab.paths.spec.slice(lab.repo.length + 1), ...plan });
}));

server.registerTool("status", {
  description: "Where the browser is, whether it looks signed in, the viewport and zoom, and any warning (for example Google asking to verify).",
  inputSchema: {}
}, wrap(async () => text(await session.status())));

server.registerTool("look", {
  description: "A masked picture of the capture window, to check where things are between steps. Saves nothing.",
  inputSchema: {}
}, wrap(async () => ({ content: [{ type: "image", data: (await session.look()).toString("base64"), mimeType: "image/jpeg" }, { type: "text", text: JSON.stringify(await session.status()) }] })));

server.registerTool("open", {
  description: "Open a URL in the capture tab.",
  inputSchema: { url: z.string() }
}, wrap(async ({ url }) => text(await session.open(url))));

server.registerTool("click", {
  description: "Click a target. Its on-screen rectangle is remembered and becomes a red box on the next screenshot unless highlight is false. Controls that send, share, publish or delete are refused.",
  inputSchema: {
    target, double: z.boolean().optional(), right: z.boolean().optional(),
    highlight: z.boolean().optional().describe("Default true"),
    allow_unsafe: z.boolean().optional().describe("Never set this unless Asraf has said so for this exact click")
  }
}, wrap(async ({ target, double, right, highlight, allow_unsafe }) => text(await session.click(target, { double, right, highlight: highlight ?? true, allowUnsafe: allow_unsafe }))));

server.registerTool("hover", {
  description: "Move the pointer over a target, for example a column edge so the resize bar shows.",
  inputSchema: { target }
}, wrap(async ({ target }) => text(await session.hover(target))));

server.registerTool("drag", {
  description: "Drag from a target to another target, or by dx/dy CSS px (for example col-edge:J with dx 120 to widen column J).",
  inputSchema: { from: target, to: target.optional(), dx: z.number().optional(), dy: z.number().optional(), highlight: z.boolean().optional() }
}, wrap(async ({ from, to, dx, dy, highlight }) => text(await session.drag(from, { to, dx, dy, highlight: highlight ?? true }))));

server.registerTool("type", {
  description: "Type text at the keyboard focus, as a learner would.",
  inputSchema: { text: z.string() }
}, wrap(async ({ text: t }) => text(await session.type(t))));

server.registerTool("key", {
  description: "Press keys: Enter, Escape, Tab, Ctrl+V, Ctrl+Shift+PageDown, Alt+ArrowDown. Several presses separated by spaces. Mod means Ctrl (Cmd on a Mac).",
  inputSchema: { combo: z.string() }
}, wrap(async ({ combo }) => text(await session.key(combo))));

server.registerTool("paste", {
  description: "Put text on the clipboard and press Ctrl+V. Use it for the lab's copy blocks: tab-separated lines fill Sheets columns.",
  inputSchema: { text: z.string() }
}, wrap(async ({ text: t }) => text(await session.paste(t))));

server.registerTool("select_range", {
  description: "Google Sheets: type an address into the name box (A1:H13, D5, 2:2, C:C), press Enter and measure the selection on the canvas. The name box and the range are remembered as boxes.",
  inputSchema: { a1: z.string() }
}, wrap(async ({ a1 }) => {
  const rect = await session.selectRange(a1);
  return text({ a1, rect, measuredBy: session.lastMeasure });
}));

server.registerTool("upload", {
  description: "Click a control that opens a file chooser (Drive's File upload, Sheets' Import > Upload > Browse) and answer it with files from shared/sample-files. No operating-system dialog appears.",
  inputSchema: { target, files: z.array(z.string()).describe("File names inside shared/sample-files, e.g. [\"TaskRegister.xlsx\"]") }
}, wrap(async ({ target, files }) => text(await session.upload(target, files))));

server.registerTool("wait_for", {
  description: "Wait until the page reaches a state (all given conditions). Use after asking Asraf to finish a sign-in, verification or consent step in the capture window, or for an upload to complete.",
  inputSchema: {
    url_includes: z.string().optional(), url_excludes: z.string().optional(), selector: z.string().optional(),
    text: z.string().optional(), gone: z.string().optional().describe("Selector that must disappear"),
    timeout_s: z.number().optional().describe("Default 120, at most 900")
  }
}, wrap(async (a) => text(await session.waitFor({ urlIncludes: a.url_includes, urlExcludes: a.url_excludes, selector: a.selector, text: a.text, gone: a.gone, timeoutS: a.timeout_s }))));

server.registerTool("tabs", {
  description: "List browser tabs, or switch to one by index or by part of its URL.",
  inputSchema: { switch_to: z.union([z.number(), z.string()]).optional() }
}, wrap(async ({ switch_to }) => text(await session.tabs({ switchTo: switch_to }))));

server.registerTool("find", {
  description: "List visible elements matching some text, an aria-label fragment or a selector, with their rectangles. Use it to pick a reliable target.",
  inputSchema: { query: z.string(), limit: z.number().optional() }
}, wrap(async ({ query, limit }) => text(await session.find(query, { limit }))));

server.registerTool("aria_snapshot", {
  description: "Accessibility tree of the page (or of root), to find roles and names for role= selectors.",
  inputSchema: { root: z.string().optional() }
}, wrap(async ({ root }) => text(await session.ariaSnapshot(root))));

server.registerTool("boxes_for", {
  description: "The on-screen rectangle of a target in CSS px, without clicking or remembering it. For range: targets the selection is measured and then put back.",
  inputSchema: { target }
}, wrap(async ({ target }) => text(await session.boxesFor(target))));

server.registerTool("clear_boxes", {
  description: "Forget the remembered boxes, for example after clicks that only set up the screen.",
  inputSchema: {}
}, wrap(async () => text({ cleared: session.clearPending() })));

const highlightItem = z.union([
  z.string().describe("\"pending\" (everything clicked or selected since the last screenshot) or a target"),
  z.object({ target: z.string().optional(), rect: z.array(z.number()).length(4).optional(), step: z.number().optional(), side: z.enum(["right", "left", "above", "below"]).optional() })
]);
server.registerTool("screenshot", {
  description: "Save a masked full-window capture under the README's image name in _design/screenshots/full/<course>/<chapter>/, and write its boxes (and arrows) into _design/shots/<course>/<chapter>.json in 1600 px coordinates. With focus, save a small focused capture at 2x instead. Returns a preview with the boxes drawn, so check it.",
  inputSchema: {
    name: z.string().describe("Exact file name from the README, e.g. c04-01-05-select-full-source-range.png"),
    highlight: z.array(highlightItem).optional().describe("Default [\"pending\"]. Pass [] for no boxes."),
    arrows: z.array(z.object({ from: z.union([z.string(), z.array(z.number()).length(2)]), to: z.union([z.string(), z.array(z.number()).length(2)]).optional(), dx: z.number().optional(), dy: z.number().optional(), offset: z.array(z.number()).length(2).optional() })).optional(),
    mask: z.array(z.union([z.string(), z.array(z.number()).length(4)])).optional().describe("Extra areas to mask, beyond the automatic ones"),
    focus: z.union([z.string(), z.array(z.string())]).optional().describe("Target(s) for a focused capture, or \"highlights\" for the area around the boxes"),
    pad: z.number().optional().describe("Padding around a focused capture, CSS px (default 16)"),
    steps: z.record(z.string(), z.number()).optional().describe("Step numbers by target label, e.g. {\"namebox\": 1}"),
    park: z.boolean().optional().describe("Move the pointer away first (default: yes unless a menu is open)")
  }
}, wrap(async (a) => {
  const r = await session.screenshot(a);
  const { previewJpeg, ...rest } = r;
  const content = [{ type: "text", text: JSON.stringify(rest, null, 1) }];
  if (previewJpeg) content.push({ type: "image", data: previewJpeg.toString("base64"), mimeType: "image/jpeg" });
  return { content };
}));

server.registerTool("calibrate", {
  description: "Google Sheets: find the heading strips again (selects A:A briefly). Use after zooming, hiding the formula bar or switching to a sheet with frozen panes if ranges measure wrongly.",
  inputSchema: {}
}, wrap(async () => text(await session.calibration(true))));

server.registerTool("close", {
  description: "Close the capture browser (the profile and its sign-in are kept).",
  inputSchema: {}
}, wrap(async () => { await session.close(); return text("closed"); }));

process.on("SIGINT", async () => { await session.close(); process.exit(0); });
await server.connect(new StdioServerTransport());
