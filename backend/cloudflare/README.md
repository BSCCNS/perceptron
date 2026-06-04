# perceptron — Cloudflare Worker backend

Logs each round to a [D1](https://developers.cloudflare.com/d1/) SQLite database.
Runs on its own Cloudflare account (free tier is plenty), isolated from any
personal Google account, and lets you aggregate results with real SQL.

The game's client needs **no changes** — you just point `config.js` `endpoint`
at the deployed Worker URL (and `token` if you set a secret).

## Setup

You need a free Cloudflare account. From this folder:

```sh
cd backend/cloudflare
npm install                       # installs wrangler locally

npx wrangler login                # opens the browser to authorize

npx wrangler d1 create perceptron # prints a database_id
#   -> paste that id into wrangler.toml  (database_id = "...")

npx wrangler d1 execute perceptron --remote --file=schema.sql   # create the table

# optional: require a shared secret (then set the same value as `token` in config.js)
npx wrangler secret put SECRET

npx wrangler deploy               # prints your Worker URL, e.g.
#   https://perceptron-logger.<your-subdomain>.workers.dev
```

Opening that URL in a browser should say `perceptron logger is running`.
Paste it into `../../config.js` as `endpoint`, then play a round.

## Querying results

```sh
# reproduce the perception ranking from real players
npx wrangler d1 execute perceptron --remote --command \
  "SELECT encoding, ROUND(AVG(accuracy),1) AS avg, COUNT(*) AS n
   FROM events GROUP BY encoding ORDER BY avg DESC"

# color sub-encodings
npx wrangler d1 execute perceptron --remote --command \
  "SELECT variant, ROUND(AVG(accuracy),1) AS avg, COUNT(*) AS n
   FROM events WHERE encoding='color' GROUP BY variant ORDER BY avg DESC"

# length: shared vs floating baseline
npx wrangler d1 execute perceptron --remote --command \
  "SELECT aligned, ROUND(AVG(accuracy),1) AS avg, COUNT(*) AS n
   FROM events WHERE encoding='length' GROUP BY aligned"
```

## Notes / hardening

- The endpoint is public (its URL lives in `config.js`). Inputs are whitelisted,
  type-coerced, and inserted with **parameterized binds**, so junk POSTs can't
  inject SQL — at worst they add rows. The optional `SECRET` deters casual abuse.
- To throttle abuse, add a **Rate limiting rule** for the Worker route in the
  Cloudflare dashboard (Security → WAF).
- `ALLOWED_ORIGINS` in `src/worker.js` is the list of site origins allowed to
  POST (currently `https://creativeintelligencelab.bsc.es`). Set it to `[]` to
  allow any origin. **Heads up:** this also blocks logging while testing locally
  (a `file://` page sends Origin `null`, and `localhost` is a different origin),
  so add your dev origin to the list temporarily, or test on the real domain.
- Local dev: `npx wrangler dev` runs the Worker at `http://localhost:8787`;
  add `--local` to D1 commands to use a local copy of the database.
