-- V005__create_coach.sql
-- Log nocturno del Coach V3: una fila por fecha con score y actividades completadas.

CREATE TYPE coach_level_enum AS ENUM ('suave', 'estandar', 'desafiante');
CREATE TYPE coach_tier_enum  AS ENUM ('valid', 'fragile', 'reset_alcohol', 'reset_score');

CREATE TABLE IF NOT EXISTS coach (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at       TIMESTAMPTZ  DEFAULT now() NOT NULL,

  recorded_at      TIMESTAMPTZ,
  date             DATE         NOT NULL,

  -- Contexto del programa
  level            coach_level_enum,
  start_iso        DATE,                                    -- fecha de inicio del programa de 90 días
  day90            SMALLINT     CHECK (day90 BETWEEN 1 AND 90),
  week_1_12        SMALLINT     CHECK (week_1_12 BETWEEN 1 AND 12),
  cycle21_1_4      SMALLINT     CHECK (cycle21_1_4 BETWEEN 1 AND 4),
  day21_1_21       SMALLINT     CHECK (day21_1_21 BETWEEN 1 AND 21),
  train_day14_1_14 SMALLINT     CHECK (train_day14_1_14 BETWEEN 1 AND 14),

  phase            TEXT,                                    -- FUNDAMENTO / CONSTRUCCIÓN / INTEGRACIÓN
  theme21          TEXT,                                    -- CONTROL DE IMPULSOS / etc.

  -- Resultado del día
  score_0_6        SMALLINT     CHECK (score_0_6 BETWEEN 0 AND 6),
  tier             coach_tier_enum,
  alcohol_bool     BOOLEAN      DEFAULT false,
  impulses_count   INTEGER      DEFAULT 0,

  -- Actividades completadas (0/1 en Sheet → BOOLEAN en PG)
  workout_done     BOOLEAN      DEFAULT false,
  read_done        BOOLEAN      DEFAULT false,
  voice_done       BOOLEAN      DEFAULT false,
  english_done     BOOLEAN      DEFAULT false,
  story_done       BOOLEAN      DEFAULT false,
  ritual_done      BOOLEAN      DEFAULT false,

  note             TEXT,
  raw_json         JSONB        DEFAULT '{}'::jsonb,

  CONSTRAINT coach_date_uq UNIQUE (date)
);

CREATE INDEX IF NOT EXISTS coach_date_idx  ON coach (date);
CREATE INDEX IF NOT EXISTS coach_day90_idx ON coach (day90);
