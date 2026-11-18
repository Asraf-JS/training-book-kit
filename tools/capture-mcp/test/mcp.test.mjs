// Starts the server over stdio and checks the tools are listed and start_lab plans a lab.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = dirname(fileURLToPath(import.meta.url));

test("lists the capture tools and plans a lab", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "capture-mcp-"));
  const repo = join(tmp, "repo");
  mkdirSync(join(repo, "04-sheets-x", "01-y"), { recursive: true });
  writeFileSync(join(repo, "04-sheets-x", "01-y", "README.md"),
    "# 01 - Test\n\n## 1.1 Start\n\n1. Click **New**.\n\n![New](./images/c04-01-01-new.png)\n\n*Caption.*\n\n2. Paste this.\n\n```text\nA\tB\n```\n\n![Tab](./images/c04-01-01a-tab-menu.png)\n");
  const client = new Client({ name: "test", version: "1" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(here, "..", "server.mjs")], env: { ...process.env, CAPTURE_HOME: join(tmp, "home"), CAPTURE_REPO: repo } }));
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const n of ["start_lab", "open", "click", "type", "key", "paste", "select_range", "screenshot", "boxes_for", "upload", "wait_for", "look"])
    assert.ok(names.includes(n), `missing ${n}`);
  const r = await client.callTool({ name: "start_lab", arguments: { course: "04-sheets-x", chapter: "01-y" } });
  const plan = JSON.parse(r.content[0].text);
  assert.equal(plan.imageCount, 2);
  assert.equal(plan.sections[0].images[1].afterStep, 2);
  assert.equal(plan.sections[0].images[1].focused, true);
  assert.equal(plan.sections[0].steps[1].copy[0], "A\tB");
  const bad = await client.callTool({ name: "start_lab", arguments: { course: "nope", chapter: "01-y" } });
  assert.equal(bad.isError, true);
  await client.close();
});
