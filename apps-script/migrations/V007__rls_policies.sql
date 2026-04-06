-- V007__rls_policies.sql
-- Habilita Row Level Security en todas las tablas.
-- El script de migración y el bot usan la service_role key, que bypasea RLS por defecto.
-- Estas políticas otorgan CRUD completo al rol service_role explícitamente.

ALTER TABLE daily         ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro      ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_state   ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach         ENABLE ROW LEVEL SECURITY;
ALTER TABLE english_voice ENABLE ROW LEVEL SECURITY;

-- Acceso total para service_role (migration script + futuro bot)
CREATE POLICY daily_service_all
  ON daily FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY checkins_service_all
  ON checkins FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY pomodoro_service_all
  ON pomodoro FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY coach_state_service_all
  ON coach_state FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY coach_service_all
  ON coach FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY english_voice_service_all
  ON english_voice FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Opcional: permitir lectura anónima para dashboard/reports con anon key.
-- Descomentar si se necesita:
-- CREATE POLICY daily_anon_read         ON daily         FOR SELECT TO anon USING (true);
-- CREATE POLICY checkins_anon_read      ON checkins      FOR SELECT TO anon USING (true);
-- CREATE POLICY pomodoro_anon_read      ON pomodoro      FOR SELECT TO anon USING (true);
-- CREATE POLICY coach_state_anon_read   ON coach_state   FOR SELECT TO anon USING (true);
-- CREATE POLICY coach_anon_read         ON coach         FOR SELECT TO anon USING (true);
-- CREATE POLICY english_voice_anon_read ON english_voice FOR SELECT TO anon USING (true);
