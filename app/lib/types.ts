// ============================================================
// Prospect OS — Types TypeScript
// Généré depuis le schéma Supabase dans AGENTS.md
// ============================================================

export type LeadStatus = "draft" | "sent" | "opened" | "replied" | "archived";
export type EnrichmentStatus = "pending" | "running" | "ok" | "failed";
export type JobStatus = "pending" | "running" | "done" | "failed";
export type JobType = "scrape" | "enrich" | "re-enrich" | "screenshot" | "email_batch";
export type CampaignStatus = "draft" | "running" | "paused" | "done" | "failed";
export type CampaignLeadStatus = "pending" | "sent" | "failed" | "skipped";

// ── Score detail ─────────────────────────────────────────────
export interface ScoreDetail {
  website:    number;  // /25
  socials:    number;  // /25
  reputation: number;  // /25
  contact:    number;  // /25
}

// ── Lead ─────────────────────────────────────────────────────
export interface Lead {
  id:           string;
  workspace_id: string;
  slug:         string;

  // Données scraping
  name:          string;
  category:      string | null;
  category_raw:  string | null;
  country:       string | null;
  city:          string | null;
  region:        string | null;
  address:       string | null;
  postal_code:   string | null;
  lat:           number | null;
  lng:           number | null;
  phone:         string | null;
  phone_raw:     string | null;
  website:       string | null;
  has_website:   boolean;
  sources:       string[];
  opening_hours: string | null;
  rating:        number | null;
  reviews_count: number | null;

  // Enrichissement website
  https:              boolean | null;
  mobile_friendly:    boolean | null;
  copyright_year:     number | null;
  tech_stack:         string[];
  html_size_kb:       number | null;
  title_present:      boolean | null;
  meta_desc_present:  boolean | null;
  favicon_present:    boolean | null;
  response_time_ms:   number | null;
  status_code:        number | null;
  website_score:      number | null;

  // Enrichissement SEO / chatbot (par service, pour cibler + pitcher)
  seo_score:           number | null;
  seo_detail:          Record<string, unknown> | null;
  has_chat:            boolean | null;
  chat_vendor:         string | null;
  chatbot_opportunity: boolean | null;

  // Enrichissement socials
  facebook:   string | null;
  instagram:  string | null;
  linkedin:   string | null;
  twitter:    string | null;
  tiktok:     string | null;
  youtube:    string | null;

  // Enrichissement contact
  email:        string | null;
  email_status: string | null;  // valid, invalid, catch_all, unknown (homegrown SMTP)
  email_type:   string | null;  // personal, generic

  // Enrichissement manuel
  screenshot_url: string | null;

  // Business size
  business_size: string | null;  // small, medium, large

  // Intelligence
  score:        number | null;
  score_detail: ScoreDetail | null;

  // War-machine qualification
  warm_score:      number | null;
  warm_detail:     Record<string, number> | null;
  lead_tier:       string | null;   // PERFECT | STRONG | MAYBE | SKIP
  tier_reason:     string | null;
  no_real_website: boolean | null;
  free_builder:    boolean | null;
  website_kind:    string | null;   // none | social | free_builder | custom
  hooks:               string[] | null;
  disqualified:        boolean | null;
  disqualified_reason: string | null;

  // Conversion elements (from the site)
  has_online_booking: boolean | null;
  has_click_to_call:  boolean | null;
  has_contact_form:   boolean | null;

  // Real performance (Lighthouse / PageSpeed)
  mobile_score: number | null;
  perf_score:   number | null;

  // Paid advertising
  ad_active:    boolean | null;
  ad_platforms: string[] | null;

  // Review mining
  review_pain:        number | null;
  review_pain_quotes: string[] | null;
  review_velocity:    number | null;
  reviews_text:       string[] | null;

  // Intent + visual
  is_recently_opened: boolean | null;
  photos:     string[] | null;
  hero_image: string | null;

  // Outreach
  subject:          string | null;
  pitch:            string | null;
  pitch_generated:  string | null;  // body produced from a template angle
  pitch_angle:      string | null;  // which template angle (for A/B)
  status:           LeadStatus;
  sent_at:          string | null;
  notes:            string | null;
  outreach_channel: string | null;
  outreach_at:      string | null;
  outreach_status:  string;       // not_contacted | contacted | replied | closed_won | closed_lost
  follow_up_at:     string | null;
  follow_up_count:  number;

  // Tracking
  visit_count:       number;
  first_visited_at:  string | null;
  last_visited_at:   string | null;
  first_engaged_at:  string | null;  // first genuine human engagement (microsite)
  last_opened_at:    string | null;  // last open (human-no-engage or scanner)
  scanner_count:     number;         // email-gateway detonations
  last_scanned_at:   string | null;

  // Meta
  enrichment_status: EnrichmentStatus;
  enriched_at:       string | null;
  scraped_at:        string;
  created_at:        string;
  updated_at:        string;
}

// ── Job ──────────────────────────────────────────────────────
export interface JobParams {
  category?:    string;
  city?:        string;
  country?:     string;
  sources?:     string[];
  lead_id?:     string;  // pour les jobs enrich/screenshot
  slug?:        string;
  concurrency?: number;
  target?:      string;  // pour re-enrich: "failed" | "no_dm" | "no_email"
}

export interface JobProgress {
  found?:    number;
  enriched?: number;
  total?:    number;
}

export interface Job {
  id:           string;
  workspace_id: string;
  type:         JobType;
  status:       JobStatus;
  params:       JobParams;
  progress:     JobProgress | null;
  error:        string | null;
  created_at:   string;
  started_at:   string | null;
  finished_at:  string | null;
}

// ── Template ─────────────────────────────────────────────────
export interface Template {
  id:           string;
  workspace_id: string;
  name:         string;
  subject:      string;
  body:         string;
  language:     string;
  category:     string | null;
  site_url:     string | null;
  created_at:   string;
}

// ── EmailMessage ─────────────────────────────────────────────
export interface EmailMessage {
  id:           string;
  workspace_id: string;
  lead_id:      string;
  subject:      string;
  body:         string;
  to_email:     string;
  from_email:   string;
  status:       string;
  sent_at:      string;
}

// ── EmailAccount ─────────────────────────────────────────────
export interface EmailAccount {
  id:                string;
  workspace_id:      string;
  name:              string;
  smtp_host:         string;
  smtp_port:         number;
  smtp_user:         string;
  smtp_pass:         string;
  sender_name:       string;
  sender_email:      string;
  daily_limit:       number;
  warmup_enabled:    boolean;
  warmup_start_date: string | null;
  sends_today:       number;
  last_reset_date:   string;
  status:            string;
  created_at:        string;
}

// ── Campaign ─────────────────────────────────────────────────
export type AssignmentMethod = "round_robin" | "random";

export interface Campaign {
  id:                 string;
  workspace_id:       string;
  template_id:        string | null;
  template_ids:       string[];
  assignment_method:  AssignmentMethod;
  name:               string;
  filters:            Record<string, unknown>;
  interval_min:       number;
  interval_max:       number;
  sending_hour_start: number;
  sending_hour_end:   number;
  timezone:           string;
  account_ids:        string[];
  status:             CampaignStatus;
  total_leads:        number;
  sent_count:         number;
  failed_count:       number;
  created_at:         string;
  started_at:         string | null;
  paused_at:          string | null;
  finished_at:        string | null;
}

// ── CampaignLead ─────────────────────────────────────────────
export interface CampaignLead {
  id:          string;
  campaign_id: string;
  lead_id:     string;
  template_id: string | null;
  account_id:  string | null;
  status:      CampaignLeadStatus;
  error:       string | null;
  sent_at:     string | null;
  created_at:  string;
}

// ── Workspace ────────────────────────────────────────────────
export interface Workspace {
  id:         string;
  name:       string;
  created_at: string;
}

// ── NDJSON export format (Prospects Hunter) ──────────────────
export interface NdjsonLead {
  id:              string;
  name:            string;
  category:        string;
  category_raw:    string;
  country:         string;
  city:            string;
  region:          string | null;
  address:         string;
  postal_code:     string;
  lat:             number;
  lng:             number;
  phone:           string | null;
  phone_raw:       string | null;
  website:         string | null;
  has_website:     boolean;
  website_score:   number | null;
  website_signals: {
    https:                    boolean;
    mobile_friendly:          boolean;
    copyright_year:           number | null;
    tech_stack:               string[];
    html_size_kb:             number;
    title_present:            boolean;
    meta_description_present: boolean;
    favicon_present:          boolean;
    response_time_ms:         number;
    status_code:              number;
  } | null;
  emails:          string[];
  socials: {
    facebook:  string | null;
    instagram: string | null;
    linkedin:  string | null;
    twitter:   string | null;
    tiktok:    string | null;
    youtube:   string | null;
  };
  opening_hours:    string | null;
  rating:           number | null;
  reviews_count:    number | null;
  sources:          string[];
  scraped_at:       string;
  enriched_at:      string | null;
  enrichment_status: string;
  lead_priority:    string;
}
