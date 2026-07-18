-- Job retry support: track attempts and allow automatic retries
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS retry_count   smallint NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_retries   smallint NOT NULL DEFAULT 3;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_error    text;
