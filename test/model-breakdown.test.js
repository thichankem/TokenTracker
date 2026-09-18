const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { loadDashboardModule } = require("./helpers/load-dashboard-module");

// ─────────────────────────────────────────────────────────────────────────────
// Local-api handler under test — only loaded when the pricing / consumer-
// boundary tests below need it; kept lazy so module-load cost isn't paid
// by the existing dashboard-only tests.
// ─────────────────────────────────────────────────────────────────────────────
const localApi = require("../src/lib/local-api");
const leaderboardRefreshPath = path.resolve(
  __dirname,
  "../dashboard/edge-patches/tokentracker-leaderboard-refresh.ts",
);

test("buildFleetData keeps usage tokens for fleet rows", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildFleetData = mod.buildFleetData;

  const modelBreakdown = {
    pricing: { pricing_mode: "list" },
    sources: [
      {
        source: "cli",
        totals: { total_tokens: 1200, total_cost_usd: 1.2 },
        models: [
          {
            model: "gpt-4o",
            model_id: "gpt-4o",
            totals: { total_tokens: 1200 },
          },
        ],
      },
      {
        source: "api",
        totals: { total_tokens: 0, total_cost_usd: 0 },
        models: [],
      },
    ],
  };

  assert.equal(typeof buildFleetData, "function");

  const fleetData = buildFleetData(modelBreakdown);

  assert.equal(fleetData.length, 1);
  assert.equal(fleetData[0].label, "CLI");
  assert.equal(fleetData[0].usage, 1200);
  assert.equal(fleetData[0].totalPercent, "100.00");
  assert.equal(fleetData[0].totalPercentValue, 100);
});

test("buildFleetData computes input-side cache hit rate per source", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildFleetData = mod.buildFleetData;

  const modelBreakdown = {
    sources: [
      {
        // 900 reused / (100 + 900 + 0) input-side = 90%
        source: "claude",
        totals: {
          total_tokens: 1020,
          input_tokens: 100,
          cached_input_tokens: 900,
          cache_creation_input_tokens: 0,
        },
        models: [{ model: "claude-opus-4-8", model_id: "claude-opus-4-8", totals: { total_tokens: 1020 } }],
      },
      {
        // No cache activity at all → rate omitted (null) so the UI hides the line.
        source: "gemini",
        totals: {
          total_tokens: 500,
          input_tokens: 300,
          cached_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
        models: [{ model: "gemini-3-pro", model_id: "gemini-3-pro", totals: { total_tokens: 500 } }],
      },
    ],
  };

  const fleetData = buildFleetData(modelBreakdown);
  const claude = fleetData.find((f) => f.source === "claude");
  const gemini = fleetData.find((f) => f.source === "gemini");

  assert.equal(claude.cacheHitRate, 90);
  assert.equal(claude.cacheReusedTokens, 900);
  assert.equal(claude.cacheInputTokens, 1000);

  // Cache writes but no reads is still cache activity → a real 0%, not null.
  assert.equal(gemini.cacheHitRate, null, "no cache reads or writes must omit the rate");
});

test("buildFleetData reports 0% when cache is written but never read", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildFleetData = mod.buildFleetData;

  const fleetData = buildFleetData({
    sources: [
      {
        source: "codex",
        totals: {
          total_tokens: 600,
          input_tokens: 100,
          cached_input_tokens: 0,
          cache_creation_input_tokens: 500,
        },
        models: [{ model: "gpt-5.4", model_id: "gpt-5.4", totals: { total_tokens: 600 } }],
      },
    ],
  });

  assert.equal(fleetData[0].cacheHitRate, 0, "cache writes with zero reads is a real 0%, not null");
});

test("buildFleetData returns model ids for stable keys", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildFleetData = mod.buildFleetData;

  const modelBreakdown = {
    pricing: { pricing_mode: "list" },
    sources: [
      {
        source: "cli",
        totals: { total_tokens: 1200, total_cost_usd: 1.2 },
        models: [
          {
            model: "GPT-4o",
            model_id: "gpt-4o",
            totals: { total_tokens: 1200 },
          },
        ],
      },
    ],
  };

  const fleetData = buildFleetData(modelBreakdown);

  assert.equal(fleetData[0].models[0].id, "gpt-4o");
});

test("buildFleetData uses explicit per-model cost instead of proportional source allocation", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildFleetData = mod.buildFleetData;

  const modelBreakdown = {
    sources: [
      {
        source: "antigravity",
        totals: { billable_total_tokens: 143_140_984, total_cost_usd: "43.260712" },
        models: [
          {
            model: "gemini-3.5-flash",
            model_id: "gemini-3.5-flash",
            totals: { billable_total_tokens: 143_100_440, total_cost_usd: "43.185541" },
          },
          {
            model: "gemini-3.1-pro",
            model_id: "gemini-3.1-pro",
            totals: { billable_total_tokens: 40_544, total_cost_usd: "0.075171" },
          },
        ],
      },
    ],
  };

  const fleetData = buildFleetData(modelBreakdown);

  assert.equal(fleetData[0].usd, 43.260712);
  assert.equal(fleetData[0].models[0].cost, 43.185541);
  assert.equal(fleetData[0].models[1].cost, 0.075171);
});

test("buildTopModels aggregates by model name across sources", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildTopModels = mod.buildTopModels;

  const modelBreakdown = {
    sources: [
      {
        source: "cli",
        models: [{ model: "GPT-4o", totals: { billable_total_tokens: 70 } }],
      },
      {
        source: "api",
        models: [
          { model: "gpt-4o", totals: { billable_total_tokens: 50 } },
          { model: "GPT-4o-mini", totals: { billable_total_tokens: 30 } },
        ],
      },
    ],
  };

  assert.equal(typeof buildTopModels, "function");

  const topModels = buildTopModels(modelBreakdown, { limit: 3 });

  assert.equal(topModels.length, 2);
  assert.equal(topModels[0].id, "gpt-4o");
  assert.equal(topModels[0].name, "GPT-4o");
  assert.equal(topModels[0].percent, "80.0");
  assert.equal(topModels[1].id, "gpt-4o-mini");
  assert.equal(topModels[1].percent, "20.0");
});

test("buildAllModels creates a complete cross-tool personal model ranking", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const models = mod.buildAllModels([
    {
      label: "CODEX",
      models: [
        { id: "gpt-5.6", name: "GPT-5.6", usage: 70, cost: 0.7 },
        { id: "gpt-5.5", name: "gpt-5.5", usage: 20, cost: 0.2 },
      ],
    },
    {
      label: "CURSOR",
      models: [
        { id: "gpt-5.6", name: "gpt-5.6", usage: 30, cost: 0.3 },
        { id: "claude", name: "claude-sonnet", usage: 80, cost: null },
      ],
    },
  ]);

  assert.deepEqual(models, [
    { id: "gpt-5.6", name: "GPT-5.6", usage: 100, cost: 1, share: 50 },
    { id: "claude-sonnet", name: "claude-sonnet", usage: 80, cost: null, share: 40 },
    { id: "gpt-5.5", name: "gpt-5.5", usage: 20, cost: 0.2, share: 10 },
  ]);
});

test("model rankings merge provider-qualified ids only when a bare peer exists (#359)", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const fleetData = [
    {
      label: "CLAUDE",
      models: [
        { id: "glm-5.2", name: "GLM-5.2", usage: 30, cost: 0.3 },
        { id: "openrouter/shared", name: "openrouter/shared", usage: 20, cost: 0.2 },
      ],
    },
    {
      label: "OPENCODE",
      models: [
        { id: "volcengine/glm-5.2", name: "volcengine/glm-5.2", usage: 70, cost: 0.7 },
        { id: "bedrock/shared", name: "bedrock/shared", usage: 10, cost: 0.1 },
      ],
    },
  ];

  assert.deepEqual(mod.buildAllModels(fleetData), [
    { id: "glm-5.2", name: "GLM-5.2", usage: 100, cost: 1, share: 76.9 },
    { id: "openrouter/shared", name: "openrouter/shared", usage: 20, cost: 0.2, share: 15.4 },
    { id: "bedrock/shared", name: "bedrock/shared", usage: 10, cost: 0.1, share: 7.7 },
  ]);

  const top = mod.buildTopModels({
    sources: [
      {
        source: "claude",
        models: [{ model: "GLM-5.2", totals: { total_tokens: 30 } }],
      },
      {
        source: "opencode",
        models: [
          { model: "volcengine/glm-5.2", totals: { total_tokens: 70 } },
          { model: "openrouter/shared", totals: { total_tokens: 20 } },
          { model: "bedrock/shared", totals: { total_tokens: 10 } },
        ],
      },
    ],
  }, { limit: 5 });
  assert.deepEqual(top, [
    { id: "glm-5.2", name: "GLM-5.2", tokens: 100, percent: "76.9" },
    { id: "openrouter/shared", name: "openrouter/shared", tokens: 20, percent: "15.4" },
    { id: "bedrock/shared", name: "bedrock/shared", tokens: 10, percent: "7.7" },
  ]);
});

test("buildTopModels computes percent using billable tokens across all models", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const buildTopModels = mod.buildTopModels;

  const modelBreakdown = {
    sources: [
      {
        source: "cli",
        models: [
          { model: "legacy-model", totals: { billable_total_tokens: 20, total_tokens: 999 } },
        ],
      },
      {
        source: "api",
        models: [{ model: "GPT-4o", totals: { billable_total_tokens: 80, total_tokens: 999 } }],
      },
    ],
  };

  const topModels = buildTopModels(modelBreakdown, { limit: 1 });

  assert.equal(topModels.length, 1);
  assert.equal(topModels[0].id, "gpt-4o");
  assert.equal(topModels[0].percent, "80.0");
});

test("Cursor display data falls back to total tokens when billable tokens are zero", async () => {
  const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
  const { buildFleetData, buildTopModels, resolveDisplayTokens } = mod;

  const modelBreakdown = {
    sources: [
      {
        source: "cursor",
        totals: {
          total_tokens: 12345,
          billable_total_tokens: 0,
          total_cost_usd: "0.165051",
        },
        models: [
          {
            model: "auto",
            model_id: "auto",
            totals: {
              total_tokens: 12345,
              billable_total_tokens: 0,
            },
          },
        ],
      },
    ],
  };

  assert.equal(resolveDisplayTokens(modelBreakdown.sources[0].totals), 12345);

  const fleetData = buildFleetData(modelBreakdown);
  assert.equal(fleetData.length, 1);
  assert.equal(fleetData[0].source, "cursor");
  assert.equal(fleetData[0].usage, 12345);
  assert.equal(fleetData[0].models.length, 1);
  assert.equal(fleetData[0].models[0].usage, 12345);

  const topModels = buildTopModels(modelBreakdown, { limit: 3 });
  assert.equal(topModels.length, 1);
  assert.equal(topModels[0].id, "auto");
  assert.equal(topModels[0].tokens, 12345);
});


test("computeRowCost on Codex row matches ccusage-style math on a cache-heavy turn", () => {
  // Anchor: a realistic gpt-5.4 turn where the prompt is 95% cached.
  // ccusage-equivalent formula (non_cached = input - cached, reasoning folded
  // into output) is the source of truth here; our schema stores input as
  // pre-subtracted non-cached, so the stored row looks like this:
  const row = {
    source: "codex",
    model: "gpt-5.4",
    input_tokens: 50_000, // non-cached (950_000 cached already removed upstream)
    cached_input_tokens: 950_000,
    cache_creation_input_tokens: 0,
    output_tokens: 10_000,
    reasoning_output_tokens: 4_000, // informational; must NOT be billed again
  };
  const cost = localApi.computeRowCost(row);

  // gpt-5.4: input=$2.50, cache_read=$0.25, output=$15 per 1M.
  // 50_000 * 2.5/1e6   = 0.125
  // 950_000 * 0.25/1e6 = 0.2375
  // 10_000 * 15/1e6    = 0.15
  // reasoning term     = 0  (folded into output_tokens)
  const expected = 0.125 + 0.2375 + 0.15;
  assert.ok(
    Math.abs(cost - expected) < 1e-9,
    `expected ${expected}, got ${cost} (reasoning term must NOT be added for Codex)`,
  );

  // Sanity: if reasoning were double-counted, cost would jump by
  // 4_000 * 15/1e6 = 0.06 — assert we're NOT seeing that.
  assert.ok(cost < expected + 0.01, "reasoning_output_tokens must not be billed on Codex rows");
});

test("computeRowCost still bills reasoning for non-Codex sources (e.g. gemini)", () => {
  // Guard against accidentally dropping the reasoning term for sources where
  // reasoning is not folded into output_tokens. Uses gemini-2.5-pro which has
  // an output rate; a non-zero reasoning bucket must contribute.
  const baseRow = {
    source: "gemini",
    model: "gemini-2.5-pro",
    input_tokens: 1_000,
    cached_input_tokens: 0,
    cache_creation_input_tokens: 0,
    output_tokens: 1_000,
    reasoning_output_tokens: 0,
  };
  const withoutReasoning = localApi.computeRowCost(baseRow);
  const withReasoning = localApi.computeRowCost({ ...baseRow, reasoning_output_tokens: 5_000 });
  assert.ok(
    withReasoning > withoutReasoning,
    "non-Codex source must still bill reasoning_output_tokens at the output rate",
  );
});

test("pricing covers production MiniMax and DeepSeek model ids used by leaderboard", () => {
  const cases = [
    ["MiniMax-M2.7", { input: 0.3, output: 1.2, cache_read: 0.06, cache_write: 0.375 }],
    ["MiniMax-M2.7-highspeed", { input: 0.6, output: 2.4, cache_read: 0.06, cache_write: 0.375 }],
    ["deepseek-v4-flash", { input: 0.44, output: 1.32, cache_read: 0.014, cache_write: 0.44 }],
    ["deepseek-v4-pro", { input: 1.32, output: 3.96, cache_read: 0.044, cache_write: 1.32 }],
  ];

  for (const [model, expected] of cases) {
    assert.deepEqual(localApi.getModelPricing(model), expected, `${model} must not fall back to zero pricing`);
  }

  // DB rows can arrive with provider/model prefixes or lower-cased aliases.
  assert.deepEqual(localApi.getModelPricing("openrouter/minimax-m2.7"), cases[0][1]);
  assert.deepEqual(localApi.getModelPricing("DeepSeek-V4-Pro"), cases[3][1]);
});

test("leaderboard-refresh edge pricing covers MiniMax and DeepSeek model ids", () => {
  const edgeSrc = fs.readFileSync(leaderboardRefreshPath, "utf8");
  for (const snippet of [
    '"MiniMax-M2.7": { input: 0.3, output: 1.2, cache_read: 0.06, cache_write: 0.375 },',
    '"MiniMax-M2.7-highspeed": { input: 0.6, output: 2.4, cache_read: 0.06, cache_write: 0.375 },',
    '"deepseek-v4-flash": { input: 0.44, output: 1.32, cache_read: 0.014, cache_write: 0.44 },',
    '"deepseek-v4-pro": { input: 1.32, output: 3.96, cache_read: 0.044, cache_write: 1.32 },',
    'lower.includes("minimax-m2.7")',
    'lower.includes("deepseek-v4-flash")',
    'lower.includes("deepseek-v4-pro")',
  ]) {
    assert.ok(edgeSrc.includes(snippet), `leaderboard-refresh must include: ${snippet}`);
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// TASK-006: Consumer-boundary test against the REAL grouped shape
// (/functions/tokentracker-usage-model-breakdown) + buildFleetData. The
// buildTopModels assertions are flat-ranker sanity only — buildTopModels
// returns { id, name, tokens, percent } with NO source field.
// ─────────────────────────────────────────────────────────────────────────────

async function writeQueue(queuePath, rows) {
  await fs.promises.writeFile(queuePath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

async function callModelBreakdown(queuePath, from, to) {
  const handler = localApi.createLocalApiHandler({ queuePath });
  const chunks = [];
  let statusCode = null;
  const urlString = `http://localhost/functions/tokentracker-usage-model-breakdown?from=${from}&to=${to}&tz=UTC`;
  const url = new URL(urlString);
  const req = {
    method: "GET",
    url: url.pathname + url.search,
    headers: { host: "localhost" },
  };
  const res = {
    statusCode: 200,
    setHeader() {},
    writeHead(code) {
      statusCode = code;
    },
    end(body) {
      if (body) chunks.push(body);
    },
    write(chunk) {
      chunks.push(chunk);
    },
  };
  const handled = await handler(req, res, url);
  assert.ok(handled, "model-breakdown endpoint must handle the request");
  const body = chunks.join("");
  return { statusCode: statusCode || res.statusCode, body: JSON.parse(body) };
}


test("end-to-end: model-breakdown endpoint feeds buildFleetData a usable cache hit rate", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tt-cache-hitrate-"));
  try {
    const queuePath = path.join(tmp, "queue.jsonl");
    // 9000 cache reads / (1000 + 9000 + 0) input-side = 90%.
    await writeQueue(queuePath, [
      {
        source: "claude",
        model: "claude-opus-4-8",
        hour_start: "2026-04-20T10:00:00.000Z",
        input_tokens: 1000,
        output_tokens: 200,
        cached_input_tokens: 9000,
        cache_creation_input_tokens: 0,
        reasoning_output_tokens: 0,
        total_tokens: 10200,
        conversation_count: 1,
      },
    ]);

    const { body } = await callModelBreakdown(queuePath, "2026-04-20", "2026-04-20");
    const claude = body.sources.find((s) => s.source === "claude");
    assert.ok(claude, "endpoint must return a claude source");
    // The real endpoint must carry the input-side cache fields at SOURCE totals.
    assert.equal(claude.totals.cached_input_tokens, 9000);

    const mod = await loadDashboardModule("dashboard/src/lib/model-breakdown.ts");
    const fleet = mod.buildFleetData(body);
    const claudeFleet = fleet.find((f) => f.source === "claude");
    assert.equal(claudeFleet.cacheHitRate, 90, "fleet cache hit rate must reflect endpoint totals");
  } finally {
    await fs.promises.rm(tmp, { recursive: true, force: true });
  }
});
