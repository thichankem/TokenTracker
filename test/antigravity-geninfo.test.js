"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { extractAntigravityGenInfo } = require("../src/lib/rollout");

// Minimal protobuf encoder for the gen_metadata fields the extractor reads.
function encodeVarint(n) {
  const out = [];
  let v = n >>> 0;
  while (true) {
    const byte = v & 0x7f;
    v >>>= 7;
    if (v === 0) { out.push(byte); break; }
    out.push(byte | 0x80);
  }
  return Buffer.from(out);
}
function tag(num, wt) { return encodeVarint((num << 3) | wt); }
function fieldVarint(num, val) { return Buffer.concat([tag(num, 0), encodeVarint(val)]); }
function fieldBytes(num, bytes) {
  const b = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return Buffer.concat([tag(num, 2), encodeVarint(b.length), b]);
}
function concat(...parts) { return Buffer.concat(parts); }

describe("extractAntigravityGenInfo", () => {
  it("reads real output/reasoning token counts from the generation-result record (inner #1 -> #4)", () => {
    // inner #1
    const inner = concat(
      fieldBytes(19, "gemini-3.8-flash"),
      // context: inner.#9 -> .#10 -> .#1 = 474
      fieldBytes(9, fieldBytes(10, fieldVarint(1, 474))),
      // generation result: inner.#4 -> .#9 (reasoning=561), .#10 (output=77), .#3 (total=638)
      fieldBytes(4, concat(fieldVarint(3, 638), fieldVarint(9, 561), fieldVarint(10, 77))),
      // last_step_index = 5
      fieldBytes(20, concat(fieldBytes(1, "last_step_index"), fieldBytes(2, "5"))),
    );
    const buf = fieldBytes(1, inner);

    const info = extractAntigravityGenInfo(buf);
    assert.equal(info.model, "gemini-3.8-flash");
    assert.equal(info.contextTokens, 474);
    assert.equal(info.outputTokens, 77);
    assert.equal(info.reasoningTokens, 561);
    assert.equal(info.lastStepIndex, 5);
  });

  it("returns null output/reasoning when the generation-result record is absent (legacy rows)", () => {
    const inner = concat(
      fieldBytes(19, "gemini-2.5-pro"),
      fieldBytes(9, fieldBytes(10, fieldVarint(1, 1234))),
      fieldBytes(20, concat(fieldBytes(1, "last_step_index"), fieldBytes(2, "9"))),
    );
    const buf = fieldBytes(1, inner);
    const info = extractAntigravityGenInfo(buf);
    assert.equal(info.contextTokens, 1234);
    assert.equal(info.outputTokens, null);
    assert.equal(info.reasoningTokens, null);
    assert.equal(info.lastStepIndex, 9);
  });

  it("ignores zero output/reasoning fields (falls back to transcript estimation downstream)", () => {
    const inner = concat(
      fieldBytes(19, "claude-sonnet-4-6"),
      fieldBytes(9, fieldBytes(10, fieldVarint(1, 100))),
      fieldBytes(4, concat(fieldVarint(9, 0), fieldVarint(10, 0))),
      fieldBytes(20, concat(fieldBytes(1, "last_step_index"), fieldBytes(2, "1"))),
    );
    const buf = fieldBytes(1, inner);
    const info = extractAntigravityGenInfo(buf);
    assert.equal(info.outputTokens, null);
    assert.equal(info.reasoningTokens, null);
    assert.equal(info.contextTokens, 100);
  });
});