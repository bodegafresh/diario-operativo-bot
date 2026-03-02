-- V003__create_pomodoro.sql
-- Eventos del timer Pomodoro (start/end por fase).
-- recorded_at es clave única: el bot escribe exactamente una fila por transición de fase.

CREATE TYPE pomo_event_enum AS ENUM ('start', 'end');
CREATE TYPE pomo_phase_enum AS ENUM ('work', 'short_break', 'long_break');

CREATE TABLE IF NOT EXISTS pomodoro (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ  DEFAULT now() NOT NULL,

  recorded_at TIMESTAMPTZ  NOT NULL,
  date        DATE         NOT NULL,
  event       pomo_event_enum NOT NULL,
  phase       pomo_phase_enum NOT NULL,
  cycle       SMALLINT     CHECK (cycle BETWEEN 1 AND 4),
  meta        JSONB        DEFAULT '{}'::jsonb,   -- {"at": "2026-01-07T10:25:00"}

  CONSTRAINT pomodoro_recorded_at_uq UNIQUE (recorded_at)
);

CREATE INDEX IF NOT EXISTS pomodoro_date_idx  ON pomodoro (date);
CREATE INDEX IF NOT EXISTS pomodoro_phase_idx ON pomodoro (phase, event);
