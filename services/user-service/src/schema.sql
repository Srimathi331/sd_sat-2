CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'reader',        -- reader | editor | admin
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  languages          TEXT[]  NOT NULL DEFAULT '{en}',
  breaking_news      BOOLEAN NOT NULL DEFAULT true,
  channels           JSONB   NOT NULL DEFAULT '{"push": true, "email": false, "inApp": true}',
  quiet_hours        JSONB,                             -- {"from":"22:00","to":"07:00","tz":"Asia/Kolkata"}
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_tokens (
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  token     TEXT NOT NULL,
  platform  TEXT NOT NULL,                              -- ios | android | web
  PRIMARY KEY (user_id, token)
);
