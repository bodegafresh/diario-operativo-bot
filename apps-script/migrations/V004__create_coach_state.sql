-- V004__create_coach_state.sql
-- Snapshots del estado del Coach V3 (append-only).
-- La última fila (ORDER BY recorded_at DESC LIMIT 1) es el estado actual.

CREATE TABLE IF NOT EXISTS coach_state (
  id                        UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at                TIMESTAMPTZ  DEFAULT now() NOT NULL,

  recorded_at               TIMESTAMPTZ  NOT NULL,
  date                      DATE         NOT NULL,

  -- Contadores del programa de 90 días
  week_index                SMALLINT     CHECK (week_index BETWEEN 1 AND 12),
  day90                     SMALLINT     CHECK (day90 BETWEEN 1 AND 90),
  day21                     SMALLINT     CHECK (day21 BETWEEN 1 AND 21),
  cycle21                   SMALLINT     CHECK (cycle21 BETWEEN 1 AND 4),
  train_day14               SMALLINT     CHECK (train_day14 BETWEEN 1 AND 14),
  impulse_count             INTEGER      DEFAULT 0,

  -- Fechas de control de envíos (YYYY-MM-DD → DATE)
  last_am                   DATE,
  last_pm                   DATE,
  last_rem_1                DATE,
  last_rem_2                DATE,
  last_rem_3                DATE,
  last_rem_4                DATE,
  ritual_daily_date         DATE,

  -- Afirmaciones del día (JSON array en el Sheet, JSONB en PG)
  ritual_daily_affirmations JSONB        DEFAULT '[]'::jsonb,

  CONSTRAINT coach_state_recorded_at_uq UNIQUE (recorded_at)
);

-- Consulta más frecuente: último estado
CREATE INDEX IF NOT EXISTS coach_state_recorded_at_idx ON coach_state (recorded_at DESC);
CREATE INDEX IF NOT EXISTS coach_state_date_idx        ON coach_state (date DESC);
