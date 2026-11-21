-- ランキングの集計。kind は total / champion / type / role。total は key を空文字にした1行
CREATE TABLE IF NOT EXISTS counts (
  kind TEXT NOT NULL,
  key  TEXT NOT NULL,
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, key)
) WITHOUT ROWID;
