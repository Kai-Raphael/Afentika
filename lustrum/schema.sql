-- Afentika · Lustrum spel schema
-- Uitvoeren via: npx wrangler d1 execute afentika-db --remote --file=lustrum/schema.sql

CREATE TABLE IF NOT EXISTS lustrum_players (
  id               INTEGER PRIMARY KEY,
  name             TEXT    NOT NULL UNIQUE,
  code             TEXT    NOT NULL UNIQUE,
  role             TEXT    NOT NULL,
  role_description TEXT    NOT NULL DEFAULT '',
  mission          TEXT    NOT NULL,
  alive            INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lustrum_questions (
  id           INTEGER PRIMARY KEY,
  key          TEXT    NOT NULL UNIQUE,
  number       INTEGER NOT NULL,
  slug         TEXT    NOT NULL UNIQUE,
  pin          TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  body         TEXT    NOT NULL,
  answers      TEXT    NOT NULL, -- JSON array met geaccepteerde antwoorden
  points       INTEGER NOT NULL,
  max_attempts INTEGER NOT NULL DEFAULT 3
);

CREATE TABLE IF NOT EXISTS lustrum_attempts (
  id          INTEGER PRIMARY KEY,
  player_id   INTEGER NOT NULL REFERENCES lustrum_players(id),
  question_id INTEGER NOT NULL REFERENCES lustrum_questions(id),
  answer      TEXT    NOT NULL,
  correct     INTEGER NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS lustrum_attempts_by_player_question
  ON lustrum_attempts (player_id, question_id);

-- Alle punten (vragen, opdrachten, raadrondes) lopen via dit grootboek.
CREATE TABLE IF NOT EXISTS lustrum_ledger (
  id          INTEGER PRIMARY KEY,
  player_id   INTEGER NOT NULL REFERENCES lustrum_players(id),
  amount      INTEGER NOT NULL,
  reason      TEXT    NOT NULL,
  question_id INTEGER REFERENCES lustrum_questions(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS lustrum_ledger_one_award_per_question
  ON lustrum_ledger (player_id, question_id) WHERE question_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS lustrum_rounds (
  id        INTEGER PRIMARY KEY,
  label     TEXT NOT NULL,
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS lustrum_votes (
  round_id   INTEGER NOT NULL REFERENCES lustrum_rounds(id),
  voter_id   INTEGER NOT NULL REFERENCES lustrum_players(id),
  target_id  INTEGER NOT NULL REFERENCES lustrum_players(id),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (round_id, voter_id)
);

-- Mislukte pogingen (spelerscode, pincode) voor rate limiting.
CREATE TABLE IF NOT EXISTS lustrum_failures (
  id         INTEGER PRIMARY KEY,
  kind       TEXT NOT NULL,
  key        TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS lustrum_failures_lookup
  ON lustrum_failures (kind, key, created_at);
