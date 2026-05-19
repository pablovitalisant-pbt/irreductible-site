CREATE TABLE IF NOT EXISTS onboarding_emails (
  id           SERIAL PRIMARY KEY,
  subject      VARCHAR(255) NOT NULL,
  html         TEXT NOT NULL,
  delay_hours  INTEGER NOT NULL DEFAULT 24,
  active       BOOLEAN NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
