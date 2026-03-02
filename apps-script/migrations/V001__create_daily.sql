-- V001__create_daily.sql
-- Tabla de entradas diarias del diario.
-- Clave de negocio: una entrada por usuario por fecha.

CREATE TYPE mood_enum AS ENUM (
  'calma', 'enfocado', 'energético', 'confianza', 'motivado',
  'neutral', 'estable', 'cansado', 'disperso', 'ansioso',
  'inquieto', 'irritable', 'frustrado', 'abrumado', 'vulnerable',
  'impulsivo', 'desanimado', 'gratitud'
);

CREATE TYPE focus_type_enum AS ENUM ('trading', 'project', 'work', 'lectura', 'estudio', 'none');

CREATE TYPE alcohol_context_enum AS ENUM ('social', 'solo', 'unknown');

CREATE TYPE stalk_intensity_enum AS ENUM ('low', 'mid', 'high', 'none');

CREATE TABLE IF NOT EXISTS daily (
  id                   UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at           TIMESTAMPTZ  DEFAULT now() NOT NULL,

  -- Metadatos del Sheet original
  recorded_at          TIMESTAMPTZ,                          -- timestamp original del bot
  date                 DATE         NOT NULL,
  from_name            TEXT,
  from_user            TEXT,
  chat_id              TEXT,
  message_id           TEXT,
  reply_to_message_id  TEXT,

  -- Campos del diario
  sleep_hours          NUMERIC(4,2),                         -- 0.0 – 12.0
  energy               SMALLINT     CHECK (energy BETWEEN 1 AND 5),
  mood                 mood_enum,
  focus_type           focus_type_enum  DEFAULT 'none',
  focus_minutes        INTEGER          DEFAULT 0,
  training_json        JSONB            DEFAULT '[]'::jsonb,  -- [{"type":"gym","minutes":45}]
  alcohol_consumed     BOOLEAN          DEFAULT false,
  alcohol_context      alcohol_context_enum DEFAULT 'unknown',
  alcohol_units        NUMERIC(5,2)     DEFAULT 0,
  stalk_occurred       BOOLEAN          DEFAULT false,
  stalk_intensity      stalk_intensity_enum DEFAULT 'none',
  trading_trades       INTEGER          DEFAULT 0,
  game_commits         INTEGER          DEFAULT 0,
  feature_done         BOOLEAN          DEFAULT false,
  notes                TEXT,
  raw                  TEXT,

  CONSTRAINT daily_date_user_uq UNIQUE (date, from_user)
);

CREATE INDEX IF NOT EXISTS daily_date_idx      ON daily (date);
CREATE INDEX IF NOT EXISTS daily_from_user_idx ON daily (from_user);
CREATE INDEX IF NOT EXISTS daily_recorded_at_idx ON daily (recorded_at);
