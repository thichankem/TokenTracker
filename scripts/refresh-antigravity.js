#!/usr/bin/env node
"use strict";

// Refresh historical Antigravity usage so it uses the real output/reasoning
// token counts now extracted from the gen_metadata DB (previously estimated
// from the truncated transcript, which under-counted reasoning ~8-10x).
//
// This is a DESTRUCTIVE-but-safely-backed-up migration: it removes the
// antigravity rows from the queues and clears the antigravity cursors so the
// next `sync` re-bills those sessions from scratch with the corrected numbers.
//
// Safety: it first writes timestamped backups of queue.jsonl,
// project.queue.jsonl and cursors.json next to the originals (*.bak.*).
//
// Usage:
//   node scripts/refresh-antigravity.js [--data DIR]
//   then: node bin/tracker.js sync

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_DATA = path.join(os.homedir(), ".tokentracker", "tracker");
const QUEUE_FILES = ["queue.jsonl", "project.queue.jsonl"];
const CURSORS_FILE = "cursors.json";
const SOURCE = "antigravity";
const SEP = "|";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
function backup(file) {
  const bak = `${file}.bak.${stamp()}`;
  fs.copyFileSync(file, bak);
  return bak;
}
function parseSourceFromBucketKey(key) {
  if (typeof key !== "string") return null;
  const first = key.indexOf(SEP);
  if (first <= 0) return null;
  return key.slice(0, first);
}
// projectBucketKey is `${projectKey}|${source}|${hourStart}` — the source is the
// SECOND segment.
function parseSourceFromProjectBucketKey(key) {
  if (typeof key !== "string") return null;
  const first = key.indexOf(SEP);
  if (first <= 0) return null;
  const second = key.indexOf(SEP, first + 1);
  if (second <= 0) return null;
  return key.slice(first + 1, second);
}

function main() {
  const dataDir = arg("--data") || DEFAULT_DATA;
  if (!fs.existsSync(dataDir)) {
    console.log(`[refresh-antigravity] data dir missing: ${dataDir}`);
    return;
  }

  // 1. Filter antigravity rows out of the queues.
  let removedRows = 0;
  for (const qf of QUEUE_FILES) {
    const file = path.join(dataDir, qf);
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
    const kept = [];
    for (const line of lines) {
      let e;
      try { e = JSON.parse(line); } catch { kept.push(line); continue; }
      if (e && String(e.source || "").toLowerCase() === SOURCE) {
        removedRows += 1;
      } else {
        kept.push(line);
      }
    }
    if (removedRows > 0) {
      const bak = backup(file);
      fs.writeFileSync(file, kept.join("\n") + (kept.length ? "\n" : ""));
      console.log(`[refresh-antigravity] ${qf}: removed ${removedRows} row(s); backup ${path.basename(bak)}`);
    }
  }

  // 2. Clear antigravity cursors.
  const cursorsPath = path.join(dataDir, CURSORS_FILE);
  if (fs.existsSync(cursorsPath)) {
    const cursors = JSON.parse(fs.readFileSync(cursorsPath, "utf8"));
    const removedFiles = [];
    if (cursors.files && typeof cursors.files === "object") {
      for (const key of Object.keys(cursors.files)) {
        if (/antigravity/i.test(key)) {
          delete cursors.files[key];
          removedFiles.push(key);
        }
      }
    }
    let removedBuckets = 0;
    if (cursors.hourly && cursors.hourly.buckets && typeof cursors.hourly.buckets === "object") {
      for (const key of Object.keys(cursors.hourly.buckets)) {
        if (parseSourceFromBucketKey(key) === SOURCE) {
          delete cursors.hourly.buckets[key];
          removedBuckets += 1;
        }
      }
    }
    let removedProjectBuckets = 0;
    if (cursors.projectHourly && cursors.projectHourly.buckets && typeof cursors.projectHourly.buckets === "object") {
      for (const key of Object.keys(cursors.projectHourly.buckets)) {
        if (parseSourceFromProjectBucketKey(key) === SOURCE) {
          delete cursors.projectHourly.buckets[key];
          removedProjectBuckets += 1;
        }
      }
    }
    if (removedFiles.length || removedBuckets || removedProjectBuckets) {
      const bak = backup(cursorsPath);
      fs.writeFileSync(cursorsPath, JSON.stringify(cursors, null, 2) + "\n");
      console.log(
        `[refresh-antigravity] cursors: removed ${removedFiles.length} file cursor(s), ${removedBuckets} hourly bucket(s), ${removedProjectBuckets} project bucket(s); backup ${path.basename(bak)}`,
      );
    }
  }

  console.log(`[refresh-antigravity] done. Run: node bin/tracker.js sync`);
}

main();