# perceptron

A perception game in the spirit of [eyeball](https://eyeball.rory.codes/): how
accurately can you read the number behind a visual encoding? Each round is a
single click. Encodings are ordered by the **Cleveland–McGill graphical-perception
hierarchy** (position is read most accurately, color/area least), so playing
doubles as a hands-on demo of that research.

## Run it

No build step, no dependencies. Just open `index.html`:

```sh
open index.html        # macOS
```

Or serve the folder (`python3 -m http.server`) and visit it — either works,
because the scripts are plain classic `<script>` tags, not ES modules.

## Encodings (v1)

| Mode      | What you do                                              | Rank |
|-----------|---------------------------------------------------------|------|
| Position  | Click where a value falls on a number line              | 1    |
| Length    | Click the height of a bar (shared **or** floating baseline) | 2 |
| Angle     | Click to make a pie / donut slice the right share       | 4    |
| Area      | Click to size a circle's **area** to a value            | 5    |
| Color     | Read a swatch (hue / saturation / lightness), click its place on the scale | 6 |

"Mixed" draws a random encoding each round. Stats (best / average / streak /
rounds) persist in `localStorage`.

## How it's built

```
index.html          markup + stats bar + mode tabs + SVG stage
styles.css          minimalist styling
config.js           your logging endpoint URL (empty = logging off)
src/util.js         helpers, color maps, scoring, challenge registry (window.CE)
src/logger.js       fire-and-forget result logging (CE.log)
src/challenges.js   one object per encoding
src/game.js         round lifecycle, pointer wiring, stats persistence
backend/apps-script.gs   optional Google Sheet backend
backend/cloudflare/      optional Cloudflare Worker + D1 backend
```

### Adding a new encoding

Register one object in `src/challenges.js`:

```js
CE.register({
  id: "myencoding",
  name: "My encoding",
  hierRank: 3,                       // Cleveland–McGill rank, used for tab order
  blurb: "One-line description shown under the chart.",
  generate() {                       // make a round
    const range = CE.niceRange();    // { min, max, unit }
    return { range, target: /* the true value */ };
  },
  prompt: (rd) => `Click to ... <b>${CE.fmt(rd.target, rd.range)}</b>`,
  setup(svg, round) {                // draw the static scene into the SVG
    // ...append elements with CE.el(tag, attrs, text)...
    return {
      valueAt(pt) { /* pointer {x,y} in SVG units -> value (clamped) */ },
      preview(value) { /* draw the hover ghost */ },
      commit(guess, target) { /* draw final guess + true value markers */ },
    };
  },
});
```

The engine handles pointer→SVG coordinate conversion (`CE.svgPoint`), hover
preview, click-to-commit, scoring (`CE.accuracy`), and stats. The SVG `viewBox`
is `0 0 900 520`.

Set `hideTarget: true` on the round (as the Color encoding does) when the player
must *read* the value rather than *produce* it — the number is then withheld
until the reveal.

## Collecting data (optional)

Per-player accuracy is always tracked locally (the breakdown panel). To also
collect results **across players**, the game fires one anonymous event per round
to an endpoint you configure. It's fire-and-forget (`sendBeacon` / `no-cors`
fetch): if no endpoint is set, or the network fails, the game is unaffected.

Each event: `ts, session, mode, encoding, variant, aligned, donut, accuracy,
error, guess, target, rangeMin, rangeMax, unit`. `session` is a random id in
`localStorage` — nothing personal. Worth a one-line disclosure to players that
anonymous results are recorded.

### Easiest backend: a Google Sheet (no hosting)

1. Create a new Google Sheet.
2. **Extensions → Apps Script.** Delete the stub, paste the contents of
   [`backend/apps-script.gs`](backend/apps-script.gs), and save.
3. **Deploy → New deployment → type: Web app.** Set *Execute as:* **Me**,
   *Who has access:* **Anyone**. Deploy and authorize.
4. Copy the **Web app URL** (ends in `/exec`). Opening it should say
   "perceptron logger is running".
5. Paste that URL into [`config.js`](config.js) as `endpoint`.

Play a round — a row appears in the sheet's `events` tab. Aggregate with a pivot
table (rows = `encoding`, value = `AVERAGE of accuracy`, plus `COUNT`) to
reproduce the Cleveland–McGill ranking from real players. You can also break it
down by `variant` (color hue/saturation/lightness) or `aligned` (shared vs
floating baseline).

### More isolated / SQL-queryable: a Cloudflare Worker

If you'd rather not expose a personal account, or you want to aggregate with real
SQL, there's a ready-made **Cloudflare Worker + D1** backend in
[`backend/cloudflare/`](backend/cloudflare/) — see its README for the deploy
steps. It runs on its own free Cloudflare account and the client needs no
changes (same `endpoint` / `token` in `config.js`).

Any endpoint that accepts a POST works (Supabase, Formspree, Val Town, …) — just
have it read the JSON body and store it; the client side needs no changes.

## Ideas for later

- Scatter-plot position (2-D click), line slope, patterns, line weight.
- Unaligned bar **comparison** ("how many times taller is A than B?").
- Per-encoding score breakdown / a Cleveland-McGill "your personal ranking".
- Shareable result card and daily seed.
