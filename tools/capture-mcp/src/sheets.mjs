// Google Sheets draws its grid on a canvas, so cells have no DOM rectangles.
// After a range is selected with the name box, these functions find it on screen
// from the screenshot pixels: the blue selection outline, cross-checked against
// the highlighted column and row headings.
import { PNG } from "pngjs";

export function decodePng(buf) {
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: png.data };
}

const px = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};

export function isOutline([r, g, b], t) {
  return b >= t.minBlue && b - r >= t.blueOverRed && b - g >= t.blueOverGreen && r <= t.maxRed;
}

export function isHeaderHighlight([r, g, b], t) {
  return b >= t.minBlue && r <= t.maxRed && b - r >= t.blueOverRed && g <= b;
}

// A selected heading is light blue, or solid blue when its whole row or column is selected.
export const isSelectedHeading = (c, cfg) => isHeaderHighlight(c, cfg.header) || isOutline(c, cfg.outline);

// The solid blue heading of a fully selected column, found as the tallest band of
// rows that each hold a long horizontal run of selection blue. The 1-2 px outline
// that touches the heading only adds short runs, so it doesn't distort the result.
// Used to calibrate where the heading strips are.
export function findSolidBlock(img, region, t, { minRun = 15, gap = 10 } = {}) {
  const [rx0, ry0, rx1, ry1] = clampRegion(img, region);
  const rows = [];
  for (let y = ry0; y < ry1; y++) {
    let best = null, start = -1, last = -1;
    for (let x = rx0; x < rx1; x++) {
      if (!isOutline(px(img, x, y), t)) continue;
      if (start < 0 || x - last > gap + 1) start = x;
      last = x;
      if (!best || last + 1 - start > best[1] - best[0]) best = [start, last + 1];
    }
    rows.push(best && best[1] - best[0] >= minRun ? best : null);
  }
  let top = null;
  for (let i = 0; i < rows.length; ) {
    if (!rows[i]) { i++; continue; }
    let j = i;
    while (j + 1 < rows.length && rows[j + 1] && rows[j + 1][0] < rows[j][1] && rows[i][0] < rows[j + 1][1]) j++;
    const band = rows.slice(i, j + 1);
    if (band.length >= 10 && (!top || band.length > top.band.length)) top = { i, band };
    i = j + 1;
  }
  if (!top) return null;
  const med = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
  const x0 = med(top.band.map((r) => r[0])), x1 = med(top.band.map((r) => r[1]));
  return { x0, y0: ry0 + top.i, x1, y1: ry0 + top.i + top.band.length, area: (x1 - x0) * top.band.length };
}

// With column A selected (A:A), its solid heading gives the heading strips:
// scan the column headings just inside its top edge (above the letter) and the
// row headings just left of column A (beside the numbers).
export function calibrateFromColumnA(img, region, cfg) {
  const block = findSolidBlock(img, region, cfg.outline);
  if (!block) return null;
  return { headerY: block.y0 + 3, rowHeaderX: block.x0 - 5, columnA: block, gridTop: block.y1 };
}

// Finds the selection outline inside region [x0, y0, x1, y1] (inclusive-exclusive).
// Returns { x0, y0, x1, y1 } in image pixels, or null.
export function findSelectionOutline(img, region, t) {
  const [rx0, ry0, rx1, ry1] = clampRegion(img, region);
  const w = rx1 - rx0, h = ry1 - ry0;
  if (w <= 0 || h <= 0) return null;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (isOutline(px(img, rx0 + x, ry0 + y), t)) mask[y * w + x] = 1;

  // Connected components (8-connected); the outline is one loop, the largest box.
  const label = new Int32Array(w * h);
  let best = null, next = 1;
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || label[i]) continue;
    let bx0 = w, by0 = h, bx1 = -1, by1 = -1, count = 0;
    label[i] = next; stack.push(i);
    while (stack.length) {
      const j = stack.pop(), jx = j % w, jy = (j / w) | 0;
      count++;
      if (jx < bx0) bx0 = jx; if (jx > bx1) bx1 = jx;
      if (jy < by0) by0 = jy; if (jy > by1) by1 = jy;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = jx + dx, ny = jy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const k = ny * w + nx;
          if (mask[k] && !label[k]) { label[k] = next; stack.push(k); }
        }
    }
    const area = (bx1 - bx0 + 1) * (by1 - by0 + 1);
    // An outline is mostly perimeter: few pixels for its area, and at least 8 px a side.
    const perim = 2 * ((bx1 - bx0 + 1) + (by1 - by0 + 1));
    // A filled block of blue (a dark header row, a button) is solid, so it fails count <= perim * 3.
    const looksLikeOutline = bx1 - bx0 >= 8 && by1 - by0 >= 8 && count >= perim * 0.6 && count <= perim * 3;
    if (looksLikeOutline && (!best || area > best.area)) best = { id: next, x0: bx0, y0: by0, x1: bx1, y1: by1, area };
    next++;
  }
  if (!best) return null;

  // Trim the fill handle (the small square on the bottom-right corner) and any
  // stray pixels: an outline edge runs along most of the opposite side.
  const filled = (x, y) => label[y * w + x] === best.id;
  const colShare = (x, ya, yb) => { let n = 0; for (let y = ya; y <= yb; y++) n += filled(x, y); return n / (yb - ya + 1); };
  const rowShare = (y, xa, xb) => { let n = 0; for (let x = xa; x <= xb; x++) n += filled(x, y); return n / (xb - xa + 1); };
  let { x0, y0, x1, y1 } = best;
  for (let i = 0; i < 12 && x1 > x0 && colShare(x1, y0, y1) < 0.5; i++) x1--;
  for (let i = 0; i < 12 && y1 > y0 && rowShare(y1, x0, x1) < 0.5; i++) y1--;
  for (let i = 0; i < 12 && x0 < x1 && colShare(x0, y0, y1) < 0.5; i++) x0++;
  for (let i = 0; i < 12 && y0 < y1 && rowShare(y0, x0, x1) < 0.5; i++) y0++;
  return { x0: x0 + rx0, y0: y0 + ry0, x1: x1 + rx0 + 1, y1: y1 + ry0 + 1 };
}

// Longest run of highlighted heading pixels along a line, allowing small gaps for
// the separators between headings and the letters or numbers printed on them.
// Returns [start, end) or null.
export function headerRun(img, { axis, at, from, to }, cfg, gap = 14) {
  let best = null, start = -1, last = -1;
  for (let p = from; p < to; p++) {
    const c = axis === "x" ? px(img, p, at) : px(img, at, p);
    if (isSelectedHeading(c, cfg)) {
      if (start < 0 || p - last > gap + 1) start = p;
      last = p;
      if (!best || last + 1 - start > best[1] - best[0]) best = [start, last + 1];
    }
  }
  return best && best[1] - best[0] >= 6 ? best : null;
}

// Combines the headings with the outline when the heading strips are known.
// calib: { headerY, rowHeaderX } from calibrateFromColumnA.
export function measureSelection(img, region, cfg, calib) {
  const outline = findSelectionOutline(img, region, cfg.outline);
  let headers = null;
  if (calib && calib.headerY != null && calib.rowHeaderX != null) {
    const [rx0, ry0, rx1, ry1] = clampRegion(img, region);
    // Column headings sit to the right of the row headings; row headings below the column headings.
    const xr = headerRun(img, { axis: "x", at: calib.headerY, from: Math.max(rx0, calib.rowHeaderX + 6), to: rx1 }, cfg);
    const yr = headerRun(img, { axis: "y", at: calib.rowHeaderX, from: Math.max(ry0, calib.headerY + 12), to: ry1 }, cfg);
    if (xr && yr) headers = { x0: xr[0], y0: yr[0], x1: xr[1], y1: yr[1] };
  }
  const agree = outline && headers &&
    Math.abs(outline.x0 - headers.x0) <= 6 && Math.abs(outline.x1 - headers.x1) <= 6 &&
    Math.abs(outline.y0 - headers.y0) <= 6 && Math.abs(outline.y1 - headers.y1) <= 6;
  // Headings land exactly on cell boundaries and ignore blue text in the grid, so they win.
  const rect = headers || outline;
  return { rect, outline, headers, agree: !!agree, method: headers ? "headers" : outline ? "outline" : null };
}

function clampRegion(img, [x0, y0, x1, y1]) {
  return [Math.max(0, Math.round(x0)), Math.max(0, Math.round(y0)), Math.min(img.width, Math.round(x1)), Math.min(img.height, Math.round(y1))];
}

// "A1", "A1:H13", "2:2", "C:C", "Tasks!A1:B2" -> a cleaned name-box address.
export function normaliseA1(a1) {
  const s = String(a1).trim();
  if (!/^(('[^']+'|[^!\s']+)!)?(\$?[A-Z]{1,3}\$?\d+(:\$?[A-Z]{1,3}\$?\d+)?|\$?[A-Z]{1,3}:\$?[A-Z]{1,3}|\$?\d+:\$?\d+)$/i.test(s))
    throw new Error(`"${a1}" isn't a cell, range, row or column address such as A1, A1:H13, 2:2 or C:C.`);
  const bang = s.lastIndexOf("!");
  return bang < 0 ? s.toUpperCase() : s.slice(0, bang + 1) + s.slice(bang + 1).toUpperCase();
}
