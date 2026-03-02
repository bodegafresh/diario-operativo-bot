-- V006__create_english_voice.sql
-- Log de notas de voz en inglés. Filas mutables: el status avanza de RECEIVED → REPLIED.
-- La clave de negocio es message_id (Telegram), usada por updateEnglishVoiceLog_ para updates.

CREATE TYPE ev_status_enum AS ENUM (
  'RECEIVED', 'SAVED_TO_DRIVE', 'TRANSCRIBED', 'ANALYZED', 'REPLIED', 'FAILED'
);

CREATE TABLE IF NOT EXISTS english_voice (
  id                   UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at           TIMESTAMPTZ  DEFAULT now() NOT NULL,

  -- Timestamps
  recorded_at          TIMESTAMPTZ,                         -- momento de recepción original
  updated_at           TIMESTAMPTZ,                         -- último update de status

  date                 DATE         NOT NULL,

  -- Metadatos Telegram
  chat_id              TEXT,
  message_id           TEXT         NOT NULL,
  reply_to_message_id  TEXT,

  -- Metadatos del archivo de audio
  file_id              TEXT,
  file_unique_id       TEXT,
  mime_type            TEXT,
  file_size_bytes      INTEGER,
  duration_seconds     INTEGER,

  -- Google Drive
  drive_file_id        TEXT,
  drive_file_url       TEXT,

  -- Procesamiento
  status               ev_status_enum DEFAULT 'RECEIVED',

  -- Resultado del análisis AI
  transcript_full      TEXT,
  transcript_short     TEXT,
  fixes_1              TEXT,
  fixes_2              TEXT,
  fixes_3              TEXT,
  better_version       TEXT,
  tomorrow_drill       TEXT,
  verb_focus           TEXT,
  error_message        TEXT,

  CONSTRAINT english_voice_message_id_uq UNIQUE (message_id)
);

CREATE INDEX IF NOT EXISTS english_voice_date_idx       ON english_voice (date);
CREATE INDEX IF NOT EXISTS english_voice_status_idx     ON english_voice (status);
CREATE INDEX IF NOT EXISTS english_voice_updated_at_idx ON english_voice (updated_at DESC);
