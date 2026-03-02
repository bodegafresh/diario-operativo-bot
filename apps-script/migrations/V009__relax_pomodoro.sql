-- V009__relax_pomodoro.sql
-- El bot escribe phase/cycle como NULL en algunos eventos (logPomodoro_ usa `phase || null`).
-- Quitar NOT NULL de phase y mantener el enum; cycle ya era nullable vía CHECK.

ALTER TABLE pomodoro
  ALTER COLUMN phase DROP NOT NULL;
