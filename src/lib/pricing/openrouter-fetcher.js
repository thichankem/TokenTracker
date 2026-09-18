// OpenRouter data loader: 24h disk cache + live fetch of the public model
// catalog. OpenRouter is a supplementary pricing source: it carries real,
// frequently-updated per-model prices (including provider-qualified ids like
// `google/gemini-3.8-flash`) that LiteLLM's snapshot may miss or price stale.
//
// Resolution chain mirrors litellm-fetcher: fresh disk cache -> upstream fetch
// -> stale cache -> empty (callers fall back to LiteLLM/curated).

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

function readJsonSync(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function readJsonAsync(p) {
  return JSON.parse(await fsp.readFile(p, "utf8"));
}

function isFresh(stat, ttlMs) {
  if (!stat) return false;
  return Date.now() - stat.mtimeMs < ttlMs;
}

async function statSafe(p) {
  try {
    return await fsp.stat(p);
  } catch (e) {
    if (e?.code === "ENOENT") return null;
    throw e;
  }
}

// Parse an OpenRouter price string (per-token USD, e.g. "0.00000075") to a
// finite number, or null when absent/zero/non-numeric.
function parseOpenRouterPrice(v) {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v.replace(/[$,]/g, "")) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Convert one OpenRouter model object to the internal per-million-USD shape.
 * OpenRouter reports per-token USD strings. Fields:
 *   pricing.prompt            -> input
 *   pricing.completion        -> output
 *   pricing.input_cache_read  -> cache_read
 *   pricing.input_cache_write -> cache_write
 * Returns null when neither input nor output is priced (free/unknown models).
 */
function convertOpenRouterModel(model) {
  if (!model || typeof model !== "object") return null;
  const p = model.pricing || {};
  const input = parseOpenRouterPrice(p.prompt);
  const output = parseOpenRouterPrice(p.completion);
  if (input == null && output == null) return null;
  const cacheRead = parseOpenRouterPrice(p.input_cache_read);
  const cacheWrite = parseOpenRouterPrice(p.input_cache_write);
  const round = (n) => (n == null ? undefined : Math.round(n * 1e10) / 1e10);
  const out = {};
  if (input != null) out.input = round(input * 1_000_000);
  if (output != null) out.output = round(output * 1_000_000);
  if (cacheRead != null) out.cache_read = round(cacheRead * 1_000_000);
  if (cacheWrite != null) out.cache_write = round(cacheWrite * 1_000_000);
  return out;
}

/**
 * Build a per-million-USD map keyed by OpenRouter model id (provider-qualified,
 * e.g. "google/gemini-3.8-flash"). Skips entries with no usable price.
 */
function buildOpenRouterPerMillionMap(models) {
  const out = {};
  if (!Array.isArray(models)) return out;
  for (const m of models) {
    if (!m || typeof m.id !== "string" || !m.id.trim()) continue;
    const converted = convertOpenRouterModel(m);
    if (converted) out[m.id] = converted;
  }
  return out;
}

async function fetchOpenRouterModels({ url = OPENROUTER_MODELS_URL, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`OpenRouter fetch failed: HTTP ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } finally {
    clearTimeout(timer);
  }
}

async function writeCache(cachePath, models) {
  await fsp.mkdir(path.dirname(cachePath), { recursive: true });
  const slim = buildOpenRouterPerMillionMap(models);
  const payload = {
    _meta: {
      source: OPENROUTER_MODELS_URL,
      cached_at: new Date().toISOString(),
      kept_models: Object.keys(slim).length,
    },
    ...slim,
  };
  await fsp.writeFile(cachePath, JSON.stringify(payload) + "\n");
  return slim;
}

/**
 * Public: load OpenRouter pricing into a per-million map. Resolution chain:
 *   1. disk cache (if mtime < ttl)
 *   2. fetch upstream + write disk cache
 *   3. stale disk cache (network failed)
 *   4. empty map (callers fall back to LiteLLM/curated)
 */
async function loadOpenRouterData({
  cachePath,
  ttlMs = DEFAULT_TTL_MS,
  fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  fetchImpl = fetchOpenRouterModels,
  logger = null,
} = {}) {
  const log = (level, msg) => {
    if (logger && typeof logger[level] === "function") logger[level](msg);
  };

  if (cachePath) {
    const stat = await statSafe(cachePath);
    if (isFresh(stat, ttlMs)) {
      try {
        const data = await readJsonAsync(cachePath);
        delete data._meta;
        return { data, source: "disk-cache" };
      } catch (e) {
        log("warn", `[pricing] openrouter disk cache unreadable: ${e?.message || e}`);
      }
    }
  }

  try {
    // fetchImpl === null means "skip the upstream fetch" (test isolation where a
    // litellm fetchImpl was injected but no OpenRouter fixture was supplied).
    const models = fetchImpl
      ? await fetchImpl({ url: OPENROUTER_MODELS_URL, timeoutMs: fetchTimeoutMs })
      : null;
    if (models) {
      const slim = cachePath ? await writeCache(cachePath, models) : buildOpenRouterPerMillionMap(models);
      return { data: slim, source: "upstream" };
    }
  } catch (e) {
    log("warn", `[pricing] openrouter upstream fetch failed: ${e?.message || e}`);
  }

  if (cachePath) {
    const stat = await statSafe(cachePath);
    if (stat) {
      try {
        const data = await readJsonAsync(cachePath);
        delete data._meta;
        log("warn", "[pricing] using stale openrouter cache");
        return { data, source: "stale-cache" };
      } catch (e) {
        log("warn", `[pricing] stale openrouter cache unreadable: ${e?.message || e}`);
      }
    }
  }

  return { data: {}, source: "empty" };
}

module.exports = {
  OPENROUTER_MODELS_URL,
  DEFAULT_TTL_MS,
  parseOpenRouterPrice,
  convertOpenRouterModel,
  buildOpenRouterPerMillionMap,
  fetchOpenRouterModels,
  loadOpenRouterData,
};