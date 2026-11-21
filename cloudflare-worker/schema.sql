-- ランキングの集計。kind は total / champion / type / role。total は key を空文字にした1行
CREATE TABLE IF NOT EXISTS counts (
  kind TEXT NOT NULL,
  key  TEXT NOT NULL,
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, key)
) WITHOUT ROWID;

-- 32問の回答ごとの8軸の点数（0〜100）。判定の偏りを実際の答え方で調整するために残す（2026-11-21〜）。
-- 個人を特定できる情報（IP・端末情報など）は持たない。日時も日付まで
CREATE TABLE IF NOT EXISTS answers (
  id        INTEGER PRIMARY KEY,
  day       TEXT NOT NULL,
  role      TEXT,
  champ_id  TEXT NOT NULL,
  type_name TEXT,
  v INTEGER NOT NULL, i INTEGER NOT NULL, h INTEGER NOT NULL, t INTEGER NOT NULL,
  a INTEGER NOT NULL, w INTEGER NOT NULL, s INTEGER NOT NULL, d INTEGER NOT NULL
);
