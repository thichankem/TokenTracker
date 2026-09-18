"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, describe, it } = require("node:test");

const {
  convertOpenRouterModel,
  buildOpenRouterPerMillionMap,
  loadOpenRouterData,
  parseOpenRouterPrice,
} = require("../src/lib/pricing/openrouter-fetcher");
const { lookupOpenRouterPricing } = require("../src/lib/pricing/matcher");
const {
  resetPricingForTests,
  ensurePricingLoaded,
  getModelPricing,
} = require("../src/lib/pricing/index");

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tt-openrouter-"));
}
function clean(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) {}
}

describe("openrouter-fetcher", () => {
  afterEach(() => resetPricingForTests());

  it("converts per-token USD strings to the per-million shape", () => {
    const out = convertOpenRouterModel({
      id: "google/gemini-3.8-flash",
      pricing: {
        prompt: "0.00000075",
        completion: "0.00000375",
        input_cache_read: "0.000000075",
        input_cache_write: "0.0000000416666666666667",
      },
    });
    assert.deepEqual(out, { input: 0.75, output: 3.75, cache_read: 0.075, cache_write: 0.0416666667 });
  });

  it("returns null for models with no priced input/output (free routes)", () => {
    assert.equal(convertOpenRouterModel({ id: "x/free", pricing: { prompt: "0", completion: "0" } }), null);
    assert.equal(convertOpenRouterModel({ id: "x/none" }), null);
    assert.equal(convertOpenRouterModel(null), null);
  });

  it("parses prices tolerating currency symbols and whitespace", () => {
    assert.equal(parseOpenRouterPrice("$0.000003"), 0.000003);
    assert.equal(parseOpenRouterPrice("0.000003"), 0.000003);
    assert.equal(parseOpenRouterPrice("0"), null);
    assert.equal(parseOpenRouterPrice(null), null);
  });

  it("builds a per-million map keyed by provider-qualified id", () => {
    const map = buildOpenRouterPerMillionMap([
      { id: "google/gemini-3.8-flash", pricing: { prompt: "0.00000075", completion: "0.00000375" } },
      { id: "anthropic/claude-sonnet-5", pricing: { prompt: "0.000002", completion: "0.00001" } },
      { id: "org/freebie", pricing: { prompt: "0", completion: "0" } },
    ]);
    assert.deepEqual(map["google/gemini-3.8-flash"], { input: 0.75, output: 3.75 });
    assert.deepEqual(map["anthropic/claude-sonnet-5"], { input: 2, output: 10 });
    assert.equal(map["org/freebie"], undefined);
  });

  it("loadOpenRouterData falls back to empty when fetch fails and no cache exists", async () => {
    const dir = tmpDir();
    try {
      const cachePath = path.join(dir, "openrouter.json");
      const { data, source } = await loadOpenRouterData({
        cachePath,
        fetchImpl: async () => { throw new Error("boom"); },
      });
      assert.equal(source, "empty");
      assert.deepEqual(data, {});
    } finally { clean(dir); }
  });

  it("loadOpenRouterData writes and re-reads a fresh disk cache", async () => {
    const dir = tmpDir();
    try {
      const cachePath = path.join(dir, "openrouter.json");
      const models = [{ id: "google/gemini-3.8-flash", pricing: { prompt: "0.00000075", completion: "0.00000375" } }];
      const first = await loadOpenRouterData({ cachePath, fetchImpl: async () => models });
      assert.equal(first.source, "upstream");
      const second = await loadOpenRouterData({ cachePath, fetchImpl: async () => { throw new Error("should not fetch"); } });
      assert.equal(second.source, "disk-cache");
      assert.deepEqual(second.data["google/gemini-3.8-flash"], { input: 0.75, output: 3.75 });
    } finally { clean(dir); }
  });
});

describe("OpenRouter pricing integration", () => {
  afterEach(() => resetPricingForTests());

  it("lookupOpenRouterPricing resolves a bare model to its provider-qualified key", () => {
    const map = { "google/gemini-3.8-flash": { input: 0.75, output: 3.75 } };
    const hit = lookupOpenRouterPricing("gemini-3.8-flash", map);
    assert.equal(hit.hit, true);
    assert.equal(hit.source, "openrouter:prefix-strip");
    assert.equal(hit.value.input, 0.75);
  });

  it("antigravity gemini-3.8-flash resolves to the real OpenRouter price, not the gemini-2.5-flash guess", async () => {
    resetPricingForTests();
    const dir = tmpDir();
    try {
      const cachePath = path.join(dir, "pricing.json");
      const orCachePath = path.join(dir, "openrouter.json");
      // Seed a tiny litellm cache + an OpenRouter cache carrying the real price.
      fs.writeFileSync(cachePath, JSON.stringify({ _meta: {}, "gemini-2.5-flash": { input_cost_per_token: 0.0000003, output_cost_per_token: 0.0000025 } }));
      fs.writeFileSync(orCachePath, JSON.stringify({ _meta: {}, "google/gemini-3.8-flash": { input: 0.75, output: 3.75 } }));
      await ensurePricingLoaded({ cachePath, openRouterCachePath: orCachePath });
      const p = getModelPricing("gemini-3.8-flash", { source: "antigravity" });
      assert.equal(p.input, 0.75);
      assert.equal(p.output, 3.75);
    } finally { clean(dir); }
  });

  it("falls back to LiteLLM/curated when OpenRouter has no entry for the model", async () => {
    resetPricingForTests();
    const dir = tmpDir();
    try {
      const cachePath = path.join(dir, "pricing.json");
      const orCachePath = path.join(dir, "openrouter.json");
      fs.writeFileSync(cachePath, JSON.stringify({ _meta: {}, "claude-sonnet-4-6": { input_cost_per_token: 0.000003, output_cost_per_token: 0.000015 } }));
      fs.writeFileSync(orCachePath, JSON.stringify({ _meta: {} }));
      await ensurePricingLoaded({ cachePath, openRouterCachePath: orCachePath });
      const p = getModelPricing("claude-sonnet-4-6", { source: "antigravity" });
      assert.equal(p.input, 3);
      assert.equal(p.output, 15);
    } finally { clean(dir); }
  });
});