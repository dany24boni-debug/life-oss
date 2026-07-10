// scripts/setup-git.mjs
//
// One-time per-machine git configuration for this repo.
//
// Currently registers the custom `ours` merge driver referenced
// by `.gitattributes` so that `lib/modules/private-boot.ts`
// silently keeps the current branch's version on cross-branch
// merges (instead of producing a conflict every time the
// personal and shared branches diverge on that single file).
//
// Without this script, the `merge=ours` rule in `.gitattributes`
// is silently ignored — the file LOOKS protected but isn't.
//
// Idempotent: re-running has no effect if the driver is already
// configured.
//
// Usage:
//   node scripts/setup-git.mjs

import { execSync, spawnSync } from "node:child_process";

function gitConfig(key, value) {
  const res = spawnSync("git", ["config", "--local", key, value], {
    encoding: "utf8",
  });
  if (res.status !== 0) {
    console.error(`✗ failed to set ${key}: ${res.stderr.trim()}`);
    process.exit(1);
  }
  console.log(`✓ git config --local ${key} ${value}`);
}

function gitConfigGet(key) {
  try {
    return execSync(`git config --local --get ${key}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

console.log("Setting up local git config for life-os repo...\n");

// `merge.ours.driver true` registers the custom merge driver
// named "ours" with the no-op command `true` (Unix utility that
// always exits 0). When git encounters `merge=ours` in
// .gitattributes, it runs `true` as the merge resolver, which
// keeps the CURRENT branch's version of the file. This is what
// lib/modules/private-boot.ts needs so cross-branch merges don't
// produce conflicts on a file whose contents are SUPPOSED to
// differ per branch.
const existing = gitConfigGet("merge.ours.driver");
if (existing === "true") {
  console.log("✓ merge.ours.driver already set to 'true' (no-op)");
} else {
  gitConfig("merge.ours.driver", "true");
}

console.log("\nDone. Verify with:");
console.log("  git config --get merge.ours.driver  # expect: true");
console.log("\nSee lib/modules/README.md for context.");
