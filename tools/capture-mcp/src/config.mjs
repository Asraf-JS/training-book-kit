// Settings for a capture run. Read from a JSON file outside every repository
// (default ~/.capture-mcp/config.json, or CAPTURE_CONFIG), then environment overrides.
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, resolve, dirname } from "node:path";

export function captureHome() {
  if (process.env.CAPTURE_HOME) return resolve(process.env.CAPTURE_HOME);
  if (platform() === "win32" && process.env.LOCALAPPDATA) return join(process.env.LOCALAPPDATA, "capture-mcp");
  return join(homedir(), ".capture-mcp");
}

export const DEFAULTS = {
  // "launch": Playwright starts Chrome with the persistent profile below.
  // "cdp": connect to a Chrome you started with --remote-debugging-port.
  mode: "launch",
  channel: "chrome",
  cdpUrl: "http://127.0.0.1:9222",
  headless: false,
  viewport: { width: 1600, height: 870 },
  deviceScaleFactor: 1,
  focusScale: 2,
  // Course repository the captures and specs are written into.
  repo: null,
  // Only files under this folder can be uploaded. Defaults to <repo>/shared/sample-files.
  sampleFiles: null,
  // Names and emails that must never appear in a capture (the training account's
  // display name, for example). Kept here, never in a repository.
  privateTerms: [],
  maskColour: "#E8EAED",
  // Clicking a control whose name matches one of these is refused unless the call
  // says allow_unsafe. They send, share, publish or delete.
  blockedControls: [
    "^send$", "^publish$", "^start publishing$", "^delete forever$", "^empty bin$", "^empty trash$",
    "^move to bin$", "^move to trash$", "^remove access$", "^transfer ownership$", "^notify$",
    "^send invitation$", "^invite$"
  ],
  // Refused only inside a dialog: the Share button in the title bar opens the Share
  // dialog to look at, but a Share, Done or Save button in that dialog would save it.
  blockedInDialog: ["^share$", "^done$", "^save$", "^copy link$", "^remove$", "^restrict$", "^anyone with the link$"],
  sheets: {
    nameBox: ["#t-name-box", "input[aria-label='Name Box']", "input[aria-label='Name box']"],
    // A pixel counts as selection outline when b >= minBlue, b - r >= blueOverRed,
    // b - g >= blueOverGreen and r <= maxRed.
    outline: { minBlue: 180, blueOverRed: 110, blueOverGreen: 55, maxRed: 110 },
    // Highlighted column and row headings: light blue.
    header: { minBlue: 235, maxRed: 236, blueOverRed: 14 }
  }
};

function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? merge(a[k], v) : v;
  }
  return out;
}

// Walks up from dir looking for a .git folder or file.
export function insideGitRepo(dir) {
  let d = resolve(dir);
  for (;;) {
    if (existsSync(join(d, ".git"))) return d;
    const up = dirname(d);
    if (up === d) return null;
    d = up;
  }
}

export function loadConfig(overrides = {}) {
  const home = captureHome();
  const file = process.env.CAPTURE_CONFIG || join(home, "config.json");
  const fromFile = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const env = {};
  if (process.env.CAPTURE_REPO) env.repo = process.env.CAPTURE_REPO;
  if (process.env.CAPTURE_PROFILE) env.profileDir = process.env.CAPTURE_PROFILE;
  if (process.env.CAPTURE_MODE) env.mode = process.env.CAPTURE_MODE;
  if (process.env.CAPTURE_CDP_URL) env.cdpUrl = process.env.CAPTURE_CDP_URL;
  if (process.env.CAPTURE_CHANNEL !== undefined) env.channel = process.env.CAPTURE_CHANNEL || null;
  if (process.env.CAPTURE_HEADLESS) env.headless = process.env.CAPTURE_HEADLESS === "1";
  const cfg = merge(merge(DEFAULTS, fromFile), merge(env, overrides));
  cfg.home = home;
  cfg.configFile = file;
  cfg.profileDir = resolve(cfg.profileDir || join(home, "profile"));
  cfg.backupDir = resolve(cfg.backupDir || join(home, "backups"));
  cfg.runDir = resolve(cfg.runDir || join(home, "runs"));
  if (cfg.repo) cfg.repo = resolve(cfg.repo);
  if (!cfg.sampleFiles && cfg.repo) cfg.sampleFiles = join(cfg.repo, "shared", "sample-files");
  if (cfg.sampleFiles) cfg.sampleFiles = resolve(cfg.sampleFiles);
  return cfg;
}

// The profile holds Google cookies, so it must never sit inside a repository.
export function checkProfileDir(cfg) {
  const repo = insideGitRepo(cfg.profileDir);
  if (repo) throw new Error(`The browser profile ${cfg.profileDir} is inside the git repository ${repo}. Move it outside every repository (see the README).`);
  mkdirSync(cfg.profileDir, { recursive: true });
  return cfg.profileDir;
}
