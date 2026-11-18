// Privacy masks, drawn as grey blocks over the page before every capture and
// removed afterwards. The saved PNG is masked; nothing unmasked touches the disk.
//
// Found automatically: the Google account button (its label carries the name and
// email), any visible email address, real URLs and long file IDs in visible text or
// input boxes, and every term in config.privateTerms (the training account's name,
// the owner name in the Share dialog). Canvas text (the Sheets grid, the Docs page)
// can't be read, which is fine because it only ever holds the fictional sample data.

// Runs in the page. Returns rectangles (CSS px) of everything private on screen.
export function findPrivateRects({ terms, extraSelectors }) {
  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const URL_RE = /\bhttps?:\/\/[^\s"'<>]+|\b(?:docs|drive|sheets|notebooklm|gemini)\.google\.com\/[^\s"'<>]*/i;
  const FILE_ID = /\b[A-Za-z0-9_-]{28,}\b/;
  const lowered = (terms || []).filter(Boolean).map((t) => t.toLowerCase());
  const hasTerm = (s) => lowered.some((t) => s.toLowerCase().includes(t));
  const isPrivate = (s) => !!s && (EMAIL.test(s) || URL_RE.test(s) || FILE_ID.test(s) || hasTerm(s));
  const out = [];
  const vw = innerWidth, vh = innerHeight;
  const add = (r, why) => {
    if (!r || r.width < 1 || r.height < 1) return;
    if (r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) return;
    out.push({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, why });
  };
  const visible = (el) => {
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && +s.opacity !== 0;
  };

  // The account button and avatar: Google labels it "Google Account: Name (email)".
  const avatarSel = [
    "a[aria-label^='Google Account']", "[aria-label^='Google Account']", "img.gbii", "img.gb_P",
    "[data-ogsr-up] a", ...(extraSelectors || [])
  ];
  for (const sel of avatarSel) for (const el of document.querySelectorAll(sel)) if (visible(el)) add(el.getBoundingClientRect(), "account");

  // Any element whose label or tooltip carries an email, URL or private term (avatars in
  // the Share dialog and the collaborator list use these).
  for (const el of document.querySelectorAll("[aria-label],[title],[data-tooltip],img[alt]")) {
    const label = [el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("data-tooltip"), el.getAttribute("alt")].join(" ");
    if (isPrivate(label) && visible(el)) {
      const r = el.getBoundingClientRect();
      // Skip page-sized containers whose label happens to include a name.
      if (r.width * r.height < vw * vh * 0.05) add(r, "label");
    }
  }

  // Visible text, word by word so only the private part is covered.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.nodeValue;
    if (!text || !text.trim() || !n.parentElement || !visible(n.parentElement)) continue;
    const patterns = [EMAIL, URL_RE, FILE_ID, ...lowered.map((t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))];
    for (const p of patterns) {
      const re = new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g");
      for (const m of text.matchAll(re)) {
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        for (const r of range.getClientRects()) add(r, "text");
      }
    }
  }

  // Input boxes (a link field in the Share dialog, a search box) show their value, not text nodes.
  for (const el of document.querySelectorAll("input, textarea")) {
    if (isPrivate(el.value) && visible(el)) add(el.getBoundingClientRect(), "input");
  }
  return out;
}

// Runs in the page: draws the masks. Returns how many were drawn.
export function drawMasks({ rects, colour }) {
  let host = document.getElementById("__capture_masks");
  if (!host) {
    host = document.createElement("div");
    host.id = "__capture_masks";
    host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
    document.documentElement.appendChild(host);
  }
  for (const r of rects) {
    const d = document.createElement("div");
    d.style.cssText = `position:fixed;left:${r.x0 - 2}px;top:${r.y0 - 2}px;width:${r.x1 - r.x0 + 4}px;height:${r.y1 - r.y0 + 4}px;background:${colour};border-radius:3px`;
    host.appendChild(d);
  }
  return rects.length;
}

export function clearMasks() {
  document.getElementById("__capture_masks")?.remove();
}

// Merges overlapping rectangles so the masks look like tidy blocks.
export function mergeRects(rects, gap = 4) {
  const list = rects.map((r) => ({ ...r }));
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.x0 <= b.x1 + gap && b.x0 <= a.x1 + gap && a.y0 <= b.y1 + gap && b.y0 <= a.y1 + gap) {
          list[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), why: a.why === b.why ? a.why : `${a.why}+${b.why}` };
          list.splice(j, 1);
          changed = true;
          break outer;
        }
      }
  }
  return list;
}
