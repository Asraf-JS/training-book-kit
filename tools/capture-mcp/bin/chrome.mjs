#!/usr/bin/env node
// Starts Chrome with the capture profile, outside Playwright, so Google accepts the sign-in.
//
//   node bin/chrome.mjs login          sign in to the training account once, then close Chrome
//   node bin/chrome.mjs cdp [port]     start Chrome for capture-mcp's "cdp" mode (default port 9222)
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, checkProfileDir } from "../src/config.mjs";

const [cmd = "login", portArg] = process.argv.slice(2);
const cfg = loadConfig();
checkProfileDir(cfg);

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = process.platform === "win32"
    ? [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean).map((d) => join(d, "Google", "Chrome", "Application", "chrome.exe"))
    : process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
      : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("Can't find Chrome. Set CHROME_PATH to chrome.exe.");
  return found;
}

const args = [`--user-data-dir=${cfg.profileDir}`, "--no-first-run", "--no-default-browser-check", `--window-size=${cfg.viewport.width + 16},${cfg.viewport.height + 140}`];
if (cmd === "cdp") args.push(`--remote-debugging-port=${portArg || 9222}`, "about:blank");
else if (cmd === "login") args.push("https://accounts.google.com/");
else { console.error("Usage: node bin/chrome.mjs login | cdp [port]"); process.exit(1); }

console.log(`Profile: ${cfg.profileDir}`);
if (cmd === "login") console.log("Sign in with the training account only, then close every Chrome window this opened.");
else console.log(`Chrome is listening on port ${portArg || 9222}. Leave it open while Claude captures; set "mode": "cdp" in the config.`);
const child = spawn(chromePath(), args, { stdio: "ignore", detached: cmd === "cdp" });
if (cmd === "cdp") child.unref();
else child.on("exit", () => console.log("Chrome closed. The sign-in is saved in the profile."));
