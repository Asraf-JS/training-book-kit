// Reads a lab README into a plan Claude can follow: sections, numbered steps, the
// copy blocks and typed tables that belong to each step, and every image with the
// step it sits under (the moment to capture it).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { decodePng } from "./sheets.mjs";

export function planLab(md, { fullDir } = {}) {
  const lines = md.split(/\r?\n/);
  const title = (lines.find((l) => /^# /.test(l)) || "").replace(/^# /, "");
  const sections = [];
  let sec = { id: null, title: "Before the steps", steps: [], images: [], checks: [] };
  sections.push(sec);
  let step = null, noCopyNext = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m;
    if ((m = l.match(/^##\s+(\d+(?:\.\d+)*)\s+(.*)$/)) || (m = l.match(/^##\s+()(.*)$/))) {
      sec = { id: m[1] || null, title: m[2].trim(), steps: [], images: [], checks: [] };
      sections.push(sec);
      step = null;
      continue;
    }
    if ((m = l.match(/^(\d+)\.\s+(.*)$/))) {
      step = { n: +m[1], text: m[2].trim(), copy: [], tables: [] };
      sec.steps.push(step);
      continue;
    }
    if (/^```/.test(l)) {
      const body = [];
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) body.push(lines[i]);
      (step ? step.copy : (sec.copy ||= [])).push(body.join("\n"));
      continue;
    }
    if (/data-no-copy/.test(l)) { noCopyNext = true; continue; }
    if (/^\|/.test(l)) {
      const rows = [];
      for (; i < lines.length && /^\|/.test(lines[i]); i++) {
        const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
      }
      i--;
      // A table straight after data-no-copy holds values the learner types by hand.
      if (noCopyNext && step) step.tables.push({ typed: true, rows });
      else (sec.tables ||= []).push({ rows });
      noCopyNext = false;
      continue;
    }
    if ((m = l.match(/^!\[([^\]]*)\]\(\.\/images\/([^)]+)\)/))) {
      let caption = "";
      for (let j = i + 1; j < lines.length && j <= i + 3; j++) {
        const c = lines[j].trim();
        if (!c) continue;
        if (/^\*[^*].*\*$/.test(c)) caption = c.slice(1, -1);
        break;
      }
      const img = { name: m[2], alt: m[1], caption, afterStep: step ? step.n : 0, stepText: step ? step.text : null };
      img.focused = /^c\d{2}-\d{2}-\d{2}[a-z]-/.test(img.name);
      if (fullDir && existsSync(join(fullDir, img.name))) {
        try {
          const { width, height } = decodePng(readFileSync(join(fullDir, img.name)));
          img.existingSource = `${width}x${height}`;
          if (width < 800) img.focused = true;
        } catch { /* not a PNG we can read */ }
      }
      sec.images.push(img);
      continue;
    }
    if ((m = l.match(/^\*\*Check:\*\*\s*(.*)$/))) sec.checks.push(m[1]);
  }
  const keep = sections.filter((s) => s.steps.length || s.images.length);
  const images = keep.flatMap((s) => s.images.map((im) => ({ section: s.id, ...im })));
  return { title, imageCount: images.length, sections: keep, images: images.map((im) => im.name) };
}
