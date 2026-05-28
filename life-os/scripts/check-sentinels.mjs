#!/usr/bin/env node
// scripts/check-sentinels.mjs
//
// Sentinel grep: fails if the working tree reintroduces any personal-data
// strings that were scrubbed during the share-prep refactor. Runs in CI on
// master/main + shared pushes, plus locally via `npm run lint:sentinels`.
//
// Scope:
//   - Whitelisted directories (app, lib, components, scripts, supabase) +
//     README.md.
//   - Excludes `node_modules`, `.next`, `.git`, build outputs, and this
//     script file itself.
//
// Exit:
//   0  = no sentinels found  → CI green
//   1  = sentinel hit         → CI fail, prints the offending lines
//
// To add a new sentinel: append to SENTINEL_PATTERNS below.
//
// This script intentionally has zero npm dependencies (uses Node's
// built-in fs + child_process so it can run on any vanilla Node 18+
// environment, including the GitHub Actions runner).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

// Each entry is an exact substring (case-insensitive). Avoid super-generic
// words; the goal is "obvious personal data reintroduction", not
// "everything in Italian".
const SENTINEL_PATTERNS = [
  "Daniele",
  "dany24",
  "IULM",
  "Bergamo",
  "Vinted x2",
  "Content AI",
  "pendolarismo ~",
];

// Directories to scan. Add new ones here when the project grows.
const SCAN_ROOTS = [
  "app",
  "lib",
  "components",
  "scripts",
  "supabase",
];

// Individual files at the repo root that should also be scanned.
const SCAN_FILES = ["README.md"];

// Subpath patterns that should be skipped during the scan. Matched against
// the absolute path with forward slashes.
const SKIP_PATTERNS = [
  "/node_modules/",
  "/.next/",
  "/.git/",
  "/dist/",
  "/build/",
  // Don't grep this script itself — the pattern list above contains the
  // sentinels by definition.
  "/scripts/check-sentinels.mjs",
];

// File extensions to scan. Keep narrow to avoid binary noise (and large
// generated assets).
const SCAN_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".sql",
  ".md",
]);

const repoRoot = process.cwd();

function shouldSkip(absPath) {
  const normalized = absPath.split(sep).join("/");
  return SKIP_PATTERNS.some((p) => normalized.includes(p));
}

function hasScanExtension(fileName) {
  const dotIdx = fileName.lastIndexOf(".");
  if (dotIdx < 0) return false;
  return SCAN_EXTENSIONS.has(fileName.slice(dotIdx));
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (shouldSkip(full)) continue;
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && hasScanExtension(entry.name)) {
      yield full;
    }
  }
}

function checkFile(absPath, hits) {
  let content;
  try {
    content = readFileSync(absPath, "utf8");
  } catch {
    return;
  }
  const lower = content.toLowerCase();
  for (const pattern of SENTINEL_PATTERNS) {
    const lowerPattern = pattern.toLowerCase();
    let idx = lower.indexOf(lowerPattern);
    while (idx !== -1) {
      // Compute 1-based line number containing the hit.
      let line = 1;
      for (let i = 0; i < idx; i++) {
        if (content[i] === "\n") line++;
      }
      // Extract the matching line (best-effort, original case).
      const lineStart = content.lastIndexOf("\n", idx) + 1;
      const lineEnd = content.indexOf("\n", idx);
      const lineText = content
        .slice(lineStart, lineEnd === -1 ? content.length : lineEnd)
        .trim();
      hits.push({
        file: absPath.replace(repoRoot + sep, "").split(sep).join("/"),
        line,
        pattern,
        text: lineText,
      });
      idx = lower.indexOf(lowerPattern, idx + lowerPattern.length);
    }
  }
}

const hits = [];

for (const root of SCAN_ROOTS) {
  const abs = join(repoRoot, root);
  let s;
  try {
    s = statSync(abs);
  } catch {
    continue;
  }
  if (!s.isDirectory()) continue;
  for (const file of walk(abs)) {
    checkFile(file, hits);
  }
}

for (const f of SCAN_FILES) {
  const abs = join(repoRoot, f);
  try {
    if (statSync(abs).isFile()) checkFile(abs, hits);
  } catch {
    // Missing file is OK — just skip.
  }
}

if (hits.length === 0) {
  console.log(
    `[sentinels] OK — no personal-data sentinels found in ${SCAN_ROOTS.join(", ")} + ${SCAN_FILES.join(", ")}`,
  );
  process.exit(0);
}

console.error(`[sentinels] FAIL — found ${hits.length} sentinel hit(s):`);
for (const h of hits) {
  console.error(`  ${h.file}:${h.line}  [${h.pattern}]  ${h.text}`);
}
console.error("");
console.error(
  "These strings are blocklisted as personal-data sentinels — they must not appear in shipped source.",
);
console.error(
  "Either revert the change, or — if intentional — update SENTINEL_PATTERNS in this script.",
);
process.exit(1);
