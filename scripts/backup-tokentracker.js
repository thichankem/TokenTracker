#!/usr/bin/env node
"use strict";

// Continuous GitHub backup for TokenTracker local data.
//
// Copies the token-count/queue/config files from ~/.tokentracker/tracker into a
// dedicated git worktree and pushes them to a branch of the configured GitHub
// repo. Designed so switching machines loses nothing: clone the backup branch
// and drop the files back into ~/.tokentracker/tracker.
//
// Privacy: only the whitelisted data files are backed up. Sensitive files
// (relay-cookies.json, anything carrying credentials) are excluded. Token data
// is token-counts-only by design (never prompts/messages).
//
// Usage:
//   node scripts/backup-tokentracker.js [--remote URL] [--branch NAME]
//                                       [--data DIR] [--work DIR]
// Env overrides: TOKENTRACKER_BACKUP_REMOTE, TOKENTRACKER_BACKUP_BRANCH,
//                TOKENTRACKER_BACKUP_DATA, TOKENTRACKER_BACKUP_WORK.

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_REMOTE = "https://github.com/thichankem/TokenTracker.git";
const DEFAULT_BRANCH = "tokentracker-backup";
const DEFAULT_DATA = path.join(os.homedir(), ".tokentracker", "tracker");
const DEFAULT_WORK = path.join(os.homedir(), ".tokentracker", "backup-git");

// Whitelisted data files (basename match). Excludes sensitive files.
const INCLUDED = [
  "queue.jsonl",
  "project.queue.jsonl",
  "session.queue.jsonl",
  "auto-outcomes.jsonl",
  "cursors.json",
  "config.json",
  "cloud-sync-pref.json",
  "queue.state.json",
  "project.queue.state.json",
  "session.queue.jsonl.meta.json",
  "auto-outcomes.jsonl.meta.json",
];
const EXCLUDED = ["relay-cookies.json", "relay-cookies.json.bak"];

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
function config(name, env, def) {
  return arg(name) || process.env[env] || def;
}

function git(args, cwd) {
  execFileSync("git", args, { cwd, stdio: "pipe", encoding: "utf8" });
}
function gitTry(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, stdio: "pipe", encoding: "utf8" }).trim();
  } catch (_e) {
    return null;
  }
}

function main() {
  const remote = config("--remote", "TOKENTRACKER_BACKUP_REMOTE", DEFAULT_REMOTE);
  const branch = config("--branch", "TOKENTRACKER_BACKUP_BRANCH", DEFAULT_BRANCH);
  const dataDir = config("--data", "TOKENTRACKER_BACKUP_DATA", DEFAULT_DATA);
  const workDir = config("--work", "TOKENTRACKER_BACKUP_WORK", DEFAULT_WORK);

  if (!fs.existsSync(dataDir)) {
    console.log(`[backup] data dir missing, nothing to do: ${dataDir}`);
    return;
  }

  fs.mkdirSync(workDir, { recursive: true });
  const gitDir = path.join(workDir, ".git");

  // Init the worktree on the backup branch if needed.
  if (!fs.existsSync(gitDir)) {
    git(["init", "-b", branch], workDir);
    git(["remote", "add", "origin", remote], workDir);
  } else {
    const cur = gitTry(["branch", "--show-current"], workDir);
    if (cur !== branch) {
      git(["checkout", "-B", branch], workDir);
    }
    const origin = gitTry(["remote", "get-url", "origin"], workDir);
    if (origin !== remote) {
      git(["remote", "set-url", "origin", remote], workDir);
    }
  }

  // Stage backup files into <work>/backup/.
  const destDir = path.join(workDir, "backup");
  fs.mkdirSync(destDir, { recursive: true });
  let copied = 0;
  for (const name of INCLUDED) {
    if (EXCLUDED.includes(name)) continue;
    const src = path.join(dataDir, name);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(destDir, name));
    copied += 1;
  }
  // Copy any *.jsonl that isn't explicitly excluded (future-proofing) — but
  // never cookies/secrets.
  for (const f of fs.readdirSync(dataDir)) {
    if (INCLUDED.includes(f) || EXCLUDED.includes(f)) continue;
    if (f.endsWith(".jsonl") && !f.endsWith(".meta.json")) {
      fs.copyFileSync(path.join(dataDir, f), path.join(destDir, f));
      copied += 1;
    }
  }

  // Detect real data changes BEFORE writing the manifest (whose timestamp
  // changes every run and would otherwise force a commit each time).
  git(["add", "-A"], workDir);
  const hasChanges = gitTry(["status", "--porcelain", "--", "backup"], workDir) !== "";
  if (!hasChanges) {
    console.log("[backup] no changes to push.");
    return;
  }

  // Record a manifest for restore convenience.
  const manifest = {
    machine_id: readJsonField(path.join(dataDir, "config.json"), "machineId"),
    backed_up_at: new Date().toISOString(),
    files: fs.readdirSync(destDir).sort(),
  };
  fs.writeFileSync(path.join(destDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  git(["add", "-A"], workDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + "Z";
  git(["commit", "-m", `chore(backup): tokentracker data snapshot ${stamp}`], workDir);
  git(["push", "-u", "origin", branch], workDir);
  console.log(`[backup] pushed ${copied} file(s) to ${branch} @ ${remote}`);
}

function readJsonField(file, field) {
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    return j && j[field] != null ? j[field] : null;
  } catch (_e) {
    return null;
  }
}

main();