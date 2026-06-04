/**
 * perceptron — Cloudflare Worker backend (logs to a D1 SQLite database).
 *
 * Runs on its own Cloudflare account, isolated from any personal account.
 * The game's logger sends a "simple" POST, so CORS isn't strictly required,
 * but we return permissive CORS headers anyway so a normal fetch also works.
 *
 * Setup: see backend/cloudflare/README.md.
 */

// Browsers that use no-cors / sendBeacon ignore the CORS response header, so we
// also enforce the Origin server-side below. Empty array = allow any origin.
const ALLOWED_ORIGINS = ["https://creativeintelligencelab.bsc.es"];

function originAllowed(origin) {
  if (ALLOWED_ORIGINS.length === 0) return true;
  return !!origin && ALLOWED_ORIGINS.indexOf(origin) !== -1;
}

function cors(origin, extra) {
  const allow = ALLOWED_ORIGINS.length === 0 ? "*"
    : originAllowed(origin) ? origin : ALLOWED_ORIGINS[0];
  return Object.assign({
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  }, extra || {});
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method === "GET") return new Response("perceptron logger is running", { headers: cors(origin) });
    if (request.method !== "POST") return new Response("method not allowed", { status: 405, headers: cors(origin) });

    // Reject browser POSTs from other sites. (An Origin header is sent on
    // cross-origin browser requests; non-browser clients can omit/spoof it, so
    // the SECRET token below is the stronger gate.)
    if (origin && !originAllowed(origin)) {
      return new Response("forbidden origin", { status: 403, headers: cors(origin) });
    }

    let data;
    try { data = await request.json(); }
    catch (e) { return new Response("bad json", { status: 400, headers: cors(origin) }); }

    // Optional shared secret (set with `wrangler secret put SECRET`).
    if (env.SECRET && data.token !== env.SECRET) {
      return new Response("denied", { status: 403, headers: cors(origin) });
    }

    // Coerce/whitelist fields. Parameterized binds below also prevent SQL injection.
    const ts = Number(data.ts) || Date.now();
    const num = (k) => { const n = Number(data[k]); return isFinite(n) ? n : null; };
    const str = (k) => (data[k] == null ? null : String(data[k]).slice(0, 200));

    try {
      await env.DB.prepare(
        `INSERT INTO events
           (ts, session, mode, encoding, variant, aligned, donut,
            accuracy, error, guess, target, rangeMin, rangeMax, unit)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        ts, str("session"), str("mode"), str("encoding"), str("variant"),
        str("aligned"), str("donut"), num("accuracy"), num("error"),
        num("guess"), num("target"), num("rangeMin"), num("rangeMax"), str("unit")
      ).run();
    } catch (e) {
      return new Response("db error: " + e, { status: 500, headers: cors(origin) });
    }

    return new Response("ok", { headers: cors(origin) });
  },
};
