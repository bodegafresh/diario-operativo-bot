-- V002__create_checkins.sql
-- Check-ins emocionales: 3 por día, identificados por message_id de Telegram.

CREATE TABLE IF NOT EXISTS checkins (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ  DEFAULT now() NOT NULL,

  recorded_at     TIMESTAMPTZ,
  date            DATE         NOT NULL,
  from_name       TEXT,
  from_user       TEXT,
  chat_id         TEXT,
  message_id      TEXT         NOT NULL,   -- clave única: un check-in por mensaje TG
  question        TEXT         NOT NULL,
  intensity_0_10  SMALLINT     CHECK (intensity_0_10 BETWEEN 0 AND 10),
  answer_raw      TEXT,

  CONSTRAINT checkins_message_id_uq UNIQUE (message_id)
);

CREATE INDEX IF NOT EXISTS checkins_date_idx      ON checkins (date);
CREATE INDEX IF NOT EXISTS checkins_from_user_idx ON checkins (from_user);
