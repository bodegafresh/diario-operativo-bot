-- V008__fix_constraints.sql
-- Relajar constraints de rango en coach_state para permitir valor 0 (estado inicial
-- del programa antes de que arranque el día 1) y valores NULL.

ALTER TABLE coach_state
  DROP CONSTRAINT IF EXISTS coach_state_week_index_check,
  DROP CONSTRAINT IF EXISTS coach_state_day90_check,
  DROP CONSTRAINT IF EXISTS coach_state_day21_check,
  DROP CONSTRAINT IF EXISTS coach_state_cycle21_check,
  DROP CONSTRAINT IF EXISTS coach_state_train_day14_check;

ALTER TABLE coach_state
  ADD CONSTRAINT coach_state_week_index_check  CHECK (week_index  IS NULL OR week_index  BETWEEN 0 AND 12),
  ADD CONSTRAINT coach_state_day90_check       CHECK (day90       IS NULL OR day90       BETWEEN 0 AND 90),
  ADD CONSTRAINT coach_state_day21_check       CHECK (day21       IS NULL OR day21       BETWEEN 0 AND 21),
  ADD CONSTRAINT coach_state_cycle21_check     CHECK (cycle21     IS NULL OR cycle21     BETWEEN 0 AND 4),
  ADD CONSTRAINT coach_state_train_day14_check CHECK (train_day14 IS NULL OR train_day14 BETWEEN 0 AND 14);
