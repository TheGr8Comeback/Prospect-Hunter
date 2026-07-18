-- Maps a niche (lead category) to the base URL of its deployed template site.
-- One template per niche → every lead of that category gets its personalized
-- URL (base_url + slug) surfaced in the UI, ready to copy/send.
CREATE TABLE IF NOT EXISTS niche_templates (
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  category     text NOT NULL,
  base_url     text NOT NULL,
  updated_at   timestamptz DEFAULT now(),
  PRIMARY KEY (workspace_id, category)
);
