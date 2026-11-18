// One browser session for a capture run: drives Chrome, remembers the rectangle of
// everything clicked or selected since the last screenshot, and saves masked
// captures and their boxes into the course repository.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync, appendFileSync, realpathSync, existsSync } from "node:fs";
import { join, dirname, sep } from "node:path";
import { checkProfileDir } from "./config.mjs";
import { decodePng, measureSelection, calibrateFromColumnA, normaliseA1 } from "./sheets.mjs";
import { findPrivateRects, drawMasks, clearMasks, mergeRects } from "./privacy.mjs";
import { chapterPaths, readSpec, writeSpec, updateShot, backupExisting, toBox, NAME_RE } from "./spec.mjs";

const SPEC_WIDTH = 1600; // prepare-raw.py scales full captures to this width
const FOCUS_KEEP = 800;  // ...and keeps narrower focused captures at their own size
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isMac = process.platform === "darwin";

export class CaptureSession {
  constructor(cfg) {
    this.cfg = cfg;
    this.context = null;
    this.browser = null;
    this.page = null;
    this.lab = null;
    this.pending = [];
    this.calib = new Map();
    this.log = [];
  }

  // ---------- browser ----------

  async ensure() {
    if (this.page && !this.page.isClosed()) return this.page;
    const { cfg } = this;
    if (cfg.mode === "cdp") {
      this.browser = await chromium.connectOverCDP(cfg.cdpUrl);
      this.context = this.browser.contexts()[0] || (await this.browser.newContext());
    } else {
      checkProfileDir(cfg);
      this.context = await chromium.launchPersistentContext(cfg.profileDir, {
        channel: cfg.channel || undefined,
        headless: cfg.headless,
        viewport: cfg.viewport,
        deviceScaleFactor: cfg.deviceScaleFactor,
        locale: cfg.locale || "en-GB",
        // Google refuses sign-in from browsers that announce automation.
        ignoreDefaultArgs: ["--enable-automation"],
        args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check"],
        acceptDownloads: false
      });
    }
    // New tabs (Save as Google Sheets, Open in new tab) become the active page.
    this.context.on("page", (p) => { this.page = p; this.prepare(p).catch(() => {}); });
    const existing = this.context.pages().filter((p) => p.url() === "about:blank");
    this.page = cfg.mode === "cdp" ? await this.context.newPage() : existing[0] || (await this.context.newPage());
    await this.prepare(this.page);
    return this.page;
  }

  async prepare(page) {
    const { width, height } = this.cfg.viewport;
    if (this.cfg.mode === "cdp") {
      const cdp = await this.context.newCDPSession(page);
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: this.cfg.deviceScaleFactor, mobile: false });
    } else {
      await page.setViewportSize({ width, height });
    }
    for (const origin of ["https://docs.google.com", "https://drive.google.com"])
      await this.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin }).catch(() => {});
  }

  async status() {
    const page = await this.ensure();
    const info = await page.evaluate(() => ({
      dpr: devicePixelRatio, w: innerWidth, h: innerHeight,
      signedIn: !!document.querySelector("a[aria-label^='Google Account'], [aria-label^='Google Account']"),
      signInButton: !![...document.querySelectorAll("a,button")].find((e) => /^sign in$/i.test(e.textContent.trim()))
    })).catch(() => ({}));
    const url = page.url();
    const warnings = [];
    if (info.dpr && info.dpr !== this.cfg.deviceScaleFactor) warnings.push(`Page zoom isn't 100% (devicePixelRatio ${info.dpr}). Press Ctrl+0 in the capture window.`);
    if (/accounts\.google\.com/.test(url)) warnings.push("Google is showing a sign-in or verification page. Ask Asraf to complete it in the capture window, then call wait_for.");
    return {
      url: redactUrl(url), title: await page.title().catch(() => ""), viewport: `${info.w}x${info.h}`, devicePixelRatio: info.dpr,
      signedIn: info.signedIn ? "yes" : info.signInButton ? "no" : "unknown", lab: this.lab && `${this.lab.course}/${this.lab.chapter}`,
      tabs: this.context.pages().length, pendingTargets: this.pending.length, warnings
    };
  }

  async close() {
    if (this.cfg.mode === "cdp") { await this.page?.close().catch(() => {}); await this.browser?.close().catch(() => {}); }
    else await this.context?.close().catch(() => {});
    this.page = this.context = this.browser = null;
  }

  // ---------- lab ----------

  startLab({ repo, course, chapter }) {
    const r = repo || this.cfg.repo;
    const paths = chapterPaths(r, course, chapter);
    if (!existsSync(paths.readme)) throw new Error(`No README at ${paths.readme}.`);
    this.lab = { repo: r, course, chapter, paths, stamp: new Date().toISOString().replace(/[:.]/g, "-") };
    if (!this.cfg.sampleFiles) this.cfg.sampleFiles = join(r, "shared", "sample-files");
    this.pending = [];
    return this.lab;
  }

  record(entry) {
    this.log.push({ at: new Date().toISOString(), ...entry });
    if (!this.lab) return;
    mkdirSync(this.cfg.runDir, { recursive: true });
    appendFileSync(join(this.cfg.runDir, `${this.lab.course}__${this.lab.chapter}__${this.lab.stamp}.jsonl`), JSON.stringify(this.log.at(-1)) + "\n");
  }

  remember(rect, label) {
    if (!rect) return;
    const r = roundRect(rect);
    if (!this.pending.some((p) => sameRect(p.rect, r))) this.pending.push({ rect: r, label });
  }

  // ---------- targets ----------
  //
  //   any Playwright selector    role=button[name="Share"], text=Summary, [aria-label="Add Sheet"]
  //   namebox                    the Sheets name box
  //   range:A1:H13               a Sheets cell or range (measured on screen)
  //   col-edge:J                 the boundary between column J's heading and the next
  //   rect:x0,y0,x1,y1           a rectangle in CSS px
  //   point:x,y                  a point in CSS px

  async resolve(target, { forClick = false } = {}) {
    const page = await this.ensure();
    const t = String(target).trim();
    let m;
    if ((m = t.match(/^rect:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)$/))) {
      const [x0, y0, x1, y1] = m.slice(1).map(Number);
      return { kind: "rect", rect: { x0, y0, x1, y1 }, point: [(x0 + x1) / 2, (y0 + y1) / 2], label: t };
    }
    if ((m = t.match(/^point:\s*([\d.]+),\s*([\d.]+)$/))) {
      const [x, y] = m.slice(1).map(Number);
      return { kind: "point", rect: { x0: x - 8, y0: y - 8, x1: x + 8, y1: y + 8 }, point: [x, y], label: t };
    }
    if ((m = t.match(/^range:(.+)$/i))) {
      const rect = await this.measureRange(m[1], { restore: !forClick });
      return { kind: "range", rect, point: [(rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2], label: t };
    }
    if ((m = t.match(/^col-edge:([A-Z]{1,3})$/i))) {
      const cell = await this.measureRange(`${m[1].toUpperCase()}1`, { restore: true });
      const cal = await this.calibration();
      const x = cell.x1, y0 = cal.columnA.y0, y1 = cal.columnA.y1;
      return { kind: "edge", rect: { x0: x - 7, y0, x1: x + 7, y1 }, point: [x, (y0 + y1) / 2], label: t };
    }
    const loc = t === "namebox" ? await this.nameBox() : page.locator(t).filter({ visible: true }).first();
    await loc.waitFor({ state: "visible", timeout: 10000 }).catch(() => { throw new Error(`Nothing visible matches ${t}. Try find() to list candidates.`); });
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const bb = await loc.boundingBox();
    if (!bb) throw new Error(`${t} has no on-screen box.`);
    const { name, inDialog } = await loc.evaluate((el) => ({
      name: (el.getAttribute("aria-label") || el.innerText || el.value || el.title || "").trim().split("\n")[0],
      inDialog: !!el.closest("[role=dialog], [role=alertdialog], dialog")
    })).catch(() => ({ name: "", inDialog: false }));
    return { kind: "element", loc, name, inDialog, rect: { x0: bb.x, y0: bb.y, x1: bb.x + bb.width, y1: bb.y + bb.height }, point: [bb.x + bb.width / 2, bb.y + bb.height / 2], label: t };
  }

  guard(res, allowUnsafe) {
    if (allowUnsafe || res.kind !== "element") return;
    const name = (res.name || "").toLowerCase();
    const hit = this.cfg.blockedControls.find((p) => new RegExp(p, "i").test(name)) ||
      (res.inDialog && this.cfg.blockedInDialog.find((p) => new RegExp(p, "i").test(name)));
    if (hit) throw new Error(`Refused: "${res.name}" sends, shares, publishes or deletes. Close the dialog with Escape or its Cancel/close button instead. (Only Asraf can lift this, case by case.)`);
  }

  // ---------- actions ----------

  async open(url) {
    const page = await this.ensure();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    this.record({ action: "open", url: redactUrl(url) });
    return this.status();
  }

  async click(target, { double = false, right = false, allowUnsafe = false, highlight = true } = {}) {
    const page = await this.ensure();
    if (/^range:/i.test(target)) {
      const rect = await this.selectRange(String(target).slice(6), { highlightNameBox: false });
      if (double) await page.mouse.dblclick((rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2);
      return { target, rect: roundRect(rect) };
    }
    const res = await this.resolve(target, { forClick: true });
    this.guard(res, allowUnsafe);
    const opts = { button: right ? "right" : "left", clickCount: double ? 2 : 1 };
    if (res.loc) await res.loc.click({ ...opts, timeout: 10000 });
    else await page.mouse.click(res.point[0], res.point[1], opts);
    if (highlight) this.remember(res.rect, target);
    this.record({ action: "click", target, rect: roundRect(res.rect) });
    await settle(page);
    return { target, name: res.name, rect: roundRect(res.rect) };
  }

  async hover(target) {
    const page = await this.ensure();
    const res = await this.resolve(target);
    await page.mouse.move(res.point[0], res.point[1], { steps: 5 });
    await sleep(400);
    this.record({ action: "hover", target });
    return { target, rect: roundRect(res.rect) };
  }

  async drag(from, { to, dx = 0, dy = 0, highlight = true } = {}) {
    const page = await this.ensure();
    const a = await this.resolve(from);
    const b = to ? (await this.resolve(to)).point : [a.point[0] + dx, a.point[1] + dy];
    await page.mouse.move(a.point[0], a.point[1], { steps: 5 });
    await sleep(250);
    await page.mouse.down();
    await page.mouse.move(b[0], b[1], { steps: 15 });
    await page.mouse.up();
    if (highlight) this.remember(a.rect, from);
    this.record({ action: "drag", from, to: b });
    await settle(page);
    return { from: roundRect(a.rect), to: b };
  }

  async type(text) {
    const page = await this.ensure();
    await page.keyboard.type(text, { delay: 25 });
    this.record({ action: "type", chars: text.length });
    await settle(page);
    return { typed: text.length };
  }

  async key(combo) {
    const page = await this.ensure();
    const keys = String(combo).replace(/\bCtrl\b/gi, "Control").replace(/\bMod\b/gi, isMac ? "Meta" : "Control")
      .replace(/\bCmd\b/gi, "Meta").replace(/\bOption\b/gi, "Alt").replace(/\bEsc\b/gi, "Escape");
    for (const k of keys.split(/\s+/).filter(Boolean)) await page.keyboard.press(k);
    this.record({ action: "key", combo });
    await settle(page);
    return { pressed: keys };
  }

  // Puts text on the clipboard and pastes it with Ctrl+V, so a tab-separated block
  // fills columns in Sheets exactly as a learner's paste would.
  async paste(text) {
    const page = await this.ensure();
    const ok = await page.evaluate(async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } }, text);
    if (ok) await page.keyboard.press(isMac ? "Meta+V" : "Control+V");
    else {
      // Fallback: a synthetic paste event carrying the text.
      await page.evaluate((t) => {
        const dt = new DataTransfer(); dt.setData("text/plain", t);
        (document.activeElement || document.body).dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
      }, text);
    }
    this.record({ action: "paste", chars: text.length, via: ok ? "clipboard" : "event" });
    await settle(page, 800);
    return { pasted: text.length, via: ok ? "clipboard" : "event" };
  }

  // Clicks a control that opens a file chooser and answers it with sample files, so
  // the operating system's dialog never appears.
  async upload(target, files) {
    const page = await this.ensure();
    const root = this.cfg.sampleFiles && realpathSync(this.cfg.sampleFiles);
    if (!root) throw new Error("No sample-files folder configured.");
    const paths = files.map((f) => {
      const p = realpathSync(existsSync(f) ? f : join(root, f));
      if (p !== root && !p.startsWith(root + sep)) throw new Error(`${f} is outside ${root}. Only the fictional sample files can be uploaded.`);
      return p;
    });
    const res = await this.resolve(target, { forClick: true });
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 15000 }),
      res.loc ? res.loc.click() : page.mouse.click(res.point[0], res.point[1])
    ]);
    await chooser.setFiles(paths);
    this.remember(res.rect, target);
    this.record({ action: "upload", files: paths.map((p) => p.slice(root.length + 1)) });
    await settle(page, 1500);
    return { uploaded: paths.map((p) => p.slice(root.length + 1)) };
  }

  // Waits for the page to reach a state, for example after Asraf finishes a
  // verification prompt. Conditions combine with AND.
  async waitFor({ urlIncludes, urlExcludes, selector, text, gone, timeoutS = 120 }) {
    const page = await this.ensure();
    const end = Date.now() + Math.min(timeoutS, 900) * 1000;
    for (;;) {
      const p = this.page;
      const url = p.url();
      let ok = true;
      if (urlIncludes && !url.includes(urlIncludes)) ok = false;
      if (urlExcludes && url.includes(urlExcludes)) ok = false;
      if (ok && selector) ok = await p.locator(selector).filter({ visible: true }).count().then((n) => n > 0).catch(() => false);
      if (ok && text) ok = await p.getByText(text, { exact: false }).filter({ visible: true }).count().then((n) => n > 0).catch(() => false);
      if (ok && gone) ok = await p.locator(gone).filter({ visible: true }).count().then((n) => n === 0).catch(() => true);
      if (ok) return { done: true, ...(await this.status()) };
      if (Date.now() > end) return { done: false, ...(await this.status()) };
      await sleep(1000);
    }
  }

  async tabs({ switchTo } = {}) {
    await this.ensure();
    const pages = this.context.pages();
    if (switchTo != null) {
      const p = typeof switchTo === "number" ? pages[switchTo] : pages.find((x) => x.url().includes(switchTo));
      if (!p) throw new Error(`No tab matches ${switchTo}.`);
      this.page = p; await p.bringToFront(); await this.prepare(p);
    }
    return Promise.all(pages.map(async (p, i) => ({ index: i, active: p === this.page, title: await p.title().catch(() => ""), url: redactUrl(p.url()) })));
  }

  async find(query, { limit = 15 } = {}) {
    const page = await this.ensure();
    const looksLikeSelector = /^(role=|text=|css=|xpath=|\[|#|\.|[a-z]+\[)/i.test(query);
    const loc = looksLikeSelector ? page.locator(query) : page.getByText(query).or(page.locator(`[aria-label*="${query.replace(/"/g, '\\"')}" i]`));
    const out = [];
    for (const el of (await loc.filter({ visible: true }).all()).slice(0, limit)) {
      const bb = await el.boundingBox().catch(() => null);
      const info = await el.evaluate((e) => ({ tag: e.tagName.toLowerCase(), role: e.getAttribute("role"), label: e.getAttribute("aria-label"), text: (e.innerText || "").trim().slice(0, 60), id: e.id, cls: (e.className && e.className.baseVal === undefined ? e.className : "").split(" ").slice(0, 3).join(".") })).catch(() => ({}));
      if (bb) out.push({ ...info, rect: roundRect({ x0: bb.x, y0: bb.y, x1: bb.x + bb.width, y1: bb.y + bb.height }) });
    }
    return out;
  }

  async ariaSnapshot(root = "body", max = 15000) {
    const page = await this.ensure();
    const s = await page.locator(root).first().ariaSnapshot({ timeout: 10000 });
    return s.length > max ? s.slice(0, max) + `\n... (${s.length - max} more characters; pass a narrower root)` : s;
  }

  // ---------- Google Sheets ----------

  async nameBox() {
    const page = await this.ensure();
    for (const sel of this.cfg.sheets.nameBox) {
      const loc = page.locator(sel).filter({ visible: true }).first();
      if (await loc.count()) return loc;
    }
    throw new Error("Can't find the Sheets name box. Is a spreadsheet open? (Selectors are in config sheets.nameBox.)");
  }

  async jump(a1) {
    const page = await this.ensure();
    const box = await this.nameBox();
    await box.click();
    await page.keyboard.press(isMac ? "Meta+A" : "Control+A");
    await page.keyboard.type(a1, { delay: 15 });
    await page.keyboard.press("Enter");
    await sleep(500);
    return box;
  }

  gridRegion() {
    const { width, height } = this.cfg.viewport;
    return [0, this._nameBoxBottom ?? 100, width, height - 30];
  }

  async snapshotPixels() {
    const page = await this.ensure();
    const img = decodePng(await page.screenshot({ caret: "hide" }));
    const scale = img.width / this.cfg.viewport.width;
    return { img, scale };
  }

  async calibration(force = false) {
    const page = await this.ensure();
    const key = page.url().split("#")[0];
    if (!force && this.calib.has(key)) return this.calib.get(key);
    const box = await this.nameBox();
    const before = await box.inputValue().catch(() => "");
    const bb = await box.boundingBox();
    this._nameBoxBottom = bb ? bb.y + bb.height : 100;
    await this.jump("A:A");
    const { img, scale } = await this.snapshotPixels();
    const region = this.gridRegion().map((v) => v * scale);
    const c = calibrateFromColumnA(img, region, this.cfg.sheets);
    if (before) await this.jump(before);
    if (!c) throw new Error("Couldn't find the column A heading after selecting A:A. Check the selection colours in config sheets.outline.");
    const cal = { headerY: c.headerY / scale, rowHeaderX: c.rowHeaderX / scale, columnA: scaleRect(c.columnA, 1 / scale) };
    this.calib.set(key, cal);
    return cal;
  }

  // Selects a range through the name box and returns its on-screen rectangle.
  async selectRange(a1, { highlightNameBox = true } = {}) {
    const addr = normaliseA1(a1);
    const cal = await this.calibration();
    const box = await this.jump(addr);
    const rect = await this.readSelection(cal, addr);
    const bb = await box.boundingBox();
    if (highlightNameBox && bb) this.remember({ x0: bb.x, y0: bb.y, x1: bb.x + bb.width, y1: bb.y + bb.height }, "namebox");
    this.remember(rect, `range:${addr}`);
    this.record({ action: "select_range", a1: addr, rect: roundRect(rect) });
    return rect;
  }

  async readSelection(cal, addr) {
    const { img, scale } = await this.snapshotPixels();
    const region = this.gridRegion().map((v) => v * scale);
    const calPx = { headerY: Math.round(cal.headerY * scale), rowHeaderX: Math.round(cal.rowHeaderX * scale) };
    const m = measureSelection(img, region, this.cfg.sheets, calPx);
    if (!m.rect) throw new Error(`Selected ${addr} but couldn't see the selection on screen. Take a screenshot to check, or pass a rect: target.`);
    this.lastMeasure = { addr, method: m.method, agree: m.agree };
    return scaleRect(m.rect, 1 / scale);
  }

  // The rectangle of a range, selecting it briefly and then putting the previous
  // selection back, so a screenshot can box a cell that isn't the current selection.
  async measureRange(a1, { restore = true } = {}) {
    const addr = normaliseA1(a1);
    const cal = await this.calibration();
    const box = await this.nameBox();
    const before = restore ? await box.inputValue().catch(() => "") : "";
    await this.jump(addr);
    const rect = await this.readSelection(cal, addr);
    if (restore && before && before !== addr) await this.jump(before);
    return rect;
  }

  // ---------- capture ----------

  async screenshot({ name, highlight, arrows = [], mask = [], focus = null, pad = 16, park, steps = {}, crop = null, preview = true }) {
    const page = await this.ensure();
    if (!this.lab) throw new Error("Call start_lab first, so captures go into the right chapter.");
    if (!NAME_RE.test(name)) throw new Error(`${name} doesn't look like a lesson image name such as c04-01-05-select-full-source-range.png.`);
    const warnings = [];

    // Leave the pointer somewhere harmless so no tooltip shows, unless a menu is open
    // (some Google submenus close when the pointer leaves them).
    const menuOpen = await page.locator("[role=menu]").filter({ visible: true }).count().catch(() => 0);
    if (park ?? !menuOpen) await page.mouse.move(this.cfg.viewport.width - 4, Math.round(this.cfg.viewport.height / 2));
    await sleep(300);

    // Boxes: by default everything clicked or selected since the last screenshot.
    const items = highlight === undefined ? ["pending"] : highlight;
    const rects = [];
    for (const it of items) {
      if (it === "pending") { for (const p of this.pending) rects.push({ rect: p.rect, label: p.label }); continue; }
      const spec = typeof it === "string" ? { target: it } : it;
      const r = spec.rect ? { x0: spec.rect[0], y0: spec.rect[1], x1: spec.rect[2], y1: spec.rect[3] } : (await this.resolve(spec.target)).rect;
      rects.push({ rect: roundRect(r), label: spec.target || "rect", step: spec.step, side: spec.side });
    }
    for (const r of rects) if (r.step == null && steps[r.label] != null) r.step = steps[r.label];
    const arrowRects = [];
    for (const a of arrows) {
      const from = Array.isArray(a.from) ? a.from : (await this.resolve(a.from)).point;
      const to = a.to ? (Array.isArray(a.to) ? a.to : (await this.resolve(a.to)).point) : [from[0] + (a.dx || 0), from[1] + (a.dy || 0)];
      const off = a.offset || [0, 0];
      arrowRects.push([from[0] + off[0], from[1] + off[1], to[0] + off[0], to[1] + off[1]]);
    }

    // Focused capture area: the focus target(s) plus padding, in CSS px.
    let clip = null;
    if (focus) {
      const targets = Array.isArray(focus) ? focus : [focus];
      let u = null;
      for (const f of targets) {
        const r = f === "highlights" ? unionRects(rects.map((x) => x.rect)) : (await this.resolve(f)).rect;
        u = u ? unionRects([u, r]) : r;
      }
      for (const a of arrowRects) u = unionRects([u, { x0: Math.min(a[0], a[2]), y0: Math.min(a[1], a[3]), x1: Math.max(a[0], a[2]), y1: Math.max(a[1], a[3]) }]);
      const { width, height } = this.cfg.viewport;
      clip = { x0: Math.max(0, Math.floor(u.x0 - pad)), y0: Math.max(0, Math.floor(u.y0 - pad)), x1: Math.min(width, Math.ceil(u.x1 + pad)), y1: Math.min(height, Math.ceil(u.y1 + pad)) };
    }

    // Masks.
    const found = await page.evaluate(findPrivateRects, { terms: this.cfg.privateTerms, extraSelectors: this.cfg.maskSelectors || [] });
    for (const m of mask) {
      const r = typeof m === "string" ? (await this.resolve(m)).rect : { x0: m[0], y0: m[1], x1: m[2], y1: m[3] };
      found.push({ ...r, why: "requested" });
    }
    const masks = mergeRects(found);
    for (const r of rects) if (masks.some((mk) => overlap(mk, r.rect))) warnings.push(`A privacy mask overlaps the box for ${r.label}; check the preview.`);
    await page.evaluate(drawMasks, { rects: masks, colour: this.cfg.maskColour });

    let buf, imgW, imgH, scale, finalW, finalH, origin = [0, 0], previewJpeg = null;
    try {
      if (clip) {
        const cdp = await this.context.newCDPSession(page);
        const fs = this.cfg.focusScale;
        const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false,
          clip: { x: clip.x0, y: clip.y0, width: clip.x1 - clip.x0, height: clip.y1 - clip.y0, scale: fs } });
        await cdp.detach().catch(() => {});
        buf = Buffer.from(shot.data, "base64");
        origin = [clip.x0, clip.y0];
      } else {
        buf = await page.screenshot({ caret: "hide" });
      }
      const img = decodePng(buf);
      imgW = img.width; imgH = img.height;
      // Spec boxes use the size prepare-raw.py will give this image.
      const cssW = clip ? clip.x1 - clip.x0 : this.cfg.viewport.width;
      finalW = imgW !== SPEC_WIDTH && imgW >= FOCUS_KEEP ? SPEC_WIDTH : imgW;
      finalH = Math.round(imgH * finalW / imgW);
      scale = finalW / cssW;
    } finally {
      // Preview for Claude: same masks plus the boxes, never written to the repository.
      if (preview) {
        await page.evaluate(({ boxes, arrows }) => {
          const host = document.getElementById("__capture_masks");
          for (const b of boxes) { const d = document.createElement("div"); d.style.cssText = `position:fixed;left:${b.x0 - 5}px;top:${b.y0 - 5}px;width:${b.x1 - b.x0 + 10}px;height:${b.y1 - b.y0 + 10}px;border:3px solid rgb(232,17,35);border-radius:8px;box-sizing:border-box`; host.appendChild(d); }
          for (const [x0, y0, x1, y1] of arrows) { const d = document.createElement("div"); const len = Math.hypot(x1 - x0, y1 - y0); d.style.cssText = `position:fixed;left:${x0}px;top:${y0 - 1.5}px;width:${len}px;height:3px;background:rgb(232,17,35);transform-origin:0 50%;transform:rotate(${Math.atan2(y1 - y0, x1 - x0)}rad)`; host.appendChild(d); }
        }, { boxes: rects.map((r) => r.rect), arrows: arrowRects }).catch(() => {});
        previewJpeg = await page.screenshot({ type: "jpeg", quality: 55, clip: clip ? { x: clip.x0, y: clip.y0, width: clip.x1 - clip.x0, height: clip.y1 - clip.y0 } : undefined }).catch(() => null);
      }
      await page.evaluate(clearMasks).catch(() => {});
    }

    // Save the retained source, backing up whatever it replaces.
    const { paths, repo, stamp } = this.lab;
    const file = join(paths.full, name);
    const backup = backupExisting(file, this.cfg.backupDir, repo, stamp);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, buf);

    // Boxes into the chapter spec.
    const boxes = rects.map((r) => toBox(r.rect, { scale, origin, step: r.step, side: r.side, width: finalW, height: finalH }));
    const arrowBoxes = arrowRects.map((a) => [a[0], a[1], a[2], a[3]].map((v, i) => Math.round((v - origin[i % 2]) * scale)));
    const spec = readSpec(paths.spec, this.lab.course, this.lab.chapter);
    const shot = updateShot(spec, name, { boxes, arrows: arrowBoxes, crop });
    writeSpec(paths.spec, spec);

    this.record({ action: "screenshot", name, focus: !!clip, boxes, arrows: arrowBoxes, masks: masks.length, backup: !!backup });
    this.pending = [];
    return {
      saved: file.slice(repo.length + 1), size: `${imgW}x${imgH}`, focused: !!clip, specBoxes: shot.boxes, arrows: shot.arrows || [],
      masks: masks.map((m) => m.why), backup, warnings, previewJpeg
    };
  }

  // A masked view of the screen for checking progress. Saves nothing unless file is
  // given (an absolute path, used by the evaluation script).
  async look({ file = null, type = "jpeg" } = {}) {
    const page = await this.ensure();
    const found = await page.evaluate(findPrivateRects, { terms: this.cfg.privateTerms, extraSelectors: this.cfg.maskSelectors || [] });
    await page.evaluate(drawMasks, { rects: mergeRects(found), colour: this.cfg.maskColour });
    try {
      const buf = await page.screenshot(type === "png" ? { caret: "hide" } : { type: "jpeg", quality: 60, caret: "hide" });
      if (file) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, buf); }
      return buf;
    } finally {
      await page.evaluate(clearMasks).catch(() => {});
    }
  }

  // A rectangle in CSS px without recording it, for planning boxes.
  async boxesFor(target) {
    const res = await this.resolve(target);
    return { target, rect: roundRect(res.rect), measuredBy: res.kind === "range" ? this.lastMeasure : res.kind };
  }

  clearPending() { const n = this.pending.length; this.pending = []; return n; }
}

// ---------- helpers ----------

async function settle(page, ms = 400) {
  await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
  await sleep(ms);
}
const roundRect = (r) => ({ x0: Math.round(r.x0), y0: Math.round(r.y0), x1: Math.round(r.x1), y1: Math.round(r.y1) });
const sameRect = (a, b) => Math.abs(a.x0 - b.x0) <= 2 && Math.abs(a.y0 - b.y0) <= 2 && Math.abs(a.x1 - b.x1) <= 2 && Math.abs(a.y1 - b.y1) <= 2;
const scaleRect = (r, s) => ({ x0: r.x0 * s, y0: r.y0 * s, x1: r.x1 * s, y1: r.y1 * s });
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
function unionRects(list) {
  const l = list.filter(Boolean);
  if (!l.length) throw new Error("Nothing to focus on: give focus a target, or highlight something first.");
  return { x0: Math.min(...l.map((r) => r.x0)), y0: Math.min(...l.map((r) => r.y0)), x1: Math.max(...l.map((r) => r.x1)), y1: Math.max(...l.map((r) => r.y1)) };
}
// File IDs and query strings never go back to the model or the log.
export function redactUrl(u) {
  return String(u).replace(/\/d\/[A-Za-z0-9_-]{10,}/g, "/d/<id>").replace(/\/folders\/[A-Za-z0-9_-]{10,}/g, "/folders/<id>").replace(/[?#].*$/, "");
}
