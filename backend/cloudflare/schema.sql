-- perceptron D1 schema. One row per round.
CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER,   -- epoch millis
  session   TEXT,      -- anonymous per-browser id
  mode       TEXT,     -- "mixed" or the chosen encoding tab
  encoding   TEXT,     -- the actual encoding shown this round
  variant    TEXT,     -- color: hue / saturation / lightness
  aligned    TEXT,     -- length: shared vs floating baseline
  donut      TEXT,     -- angle: pie vs donut
  accuracy   REAL,     -- 0..100
  error      REAL,     -- |guess - target| in value units
  guess      REAL,
  target     REAL,
  rangeMin   REAL,
  rangeMax   REAL,
  unit       TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_encoding ON events(encoding);
CREATE INDEX IF NOT EXISTS idx_events_session  ON events(session);
