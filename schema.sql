-- Afentika · Triple A Scoreboard schema
-- Uitvoeren via: wrangler d1 execute afentika-db --file=schema.sql

CREATE TABLE IF NOT EXISTS sync_state (
  key        TEXT    PRIMARY KEY,
  data       TEXT    NOT NULL,
  updated_at TEXT    DEFAULT (datetime('now'))
);
