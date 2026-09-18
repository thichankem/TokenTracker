#!/usr/bin/env node
"use strict";

// Restore TokenTracker data from the GitHub backup branch onto a (new) machine.
//
// Clones the backup branch into a temp dir, then copies the backed-up files
// back into ~/.tokentracker/tracker. Safe to run repeatedly (idempotent).
//
// Usage:
//   node scripts/restore-tokentracker.js [--remote URL] [--branch NAME]
//                                        [--data DIR]
// Env overrides: TOKENTRACKER_BACKUP_REMOTE, TOKENTRACKER_BACKUP_BRANCH,
//                TOKENTRACKER_BACKUP_DATA.

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_REMOTE = "https://github.com/thichankem/TokenTracker.git";
const DEFAULT_BRANCH = "tokentracker-backup";
const DEFAULT_DATA = path.join(os.homedir(), ".tokentracker", "tracker");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
function config(name, env, def) {
  return arg(name) || process.env[env] || def;
}

function main() {
  const remote = config("--remote", "TOKENTRACKER_BACKUP_REMOTE", DEFAULT_REMOTE);
  const branch = config("--branch", "TOKENTRACKER_BACKUP_BRANCH", DEFAULT_BRANCH);
  const dataDir = config("--data", "TOKENTRACKER_BACKUP_DATA", DEFAULT_DATA);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tt-restore-"));
  try {
    execFileSync("git", ["clone", "--depth", "1", "--branch", branch, remote, tmp], {
      stdio: "pipe",
      encoding: "utf8",
    });
  } catch (e) {
    console.error(`[restore] failed to clone ${branch}: ${e.message}`);
    process.exit(1);
  }

  const srcDir = path.join(tmp, "backup");
  if (!fs.existsSync(srcDir)) {
    console.error(`[restore] no backup/ dir found on branch ${branch}`);
    process.exit(1);
  }

  fs.mkdirSync(dataDir, { recursive: true });
  let restored = 0;
  for (const name of fs.readdirSync(srcDir)) {
    if (name === "manifest.json") continue;
    const src = path.join(srcDir, name);
    if (!fs.statSync(src).isFile()) continue;
    fs.copyFileSync(src, path.join(dataDir, name));
    restored += 1;
  }
  console.log(`[restore] restored ${restored} file(s) to ${dataDir}`);
}

main();