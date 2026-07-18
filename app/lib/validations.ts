import { z } from "zod";

// ── Campaigns ───────────────────────────────────────────────
export const createCampaignSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  template_ids: z.array(z.string().uuid()).optional(),
  template_id: z.string().uuid().optional(),
  assignment_method: z.enum(["round_robin", "random"]).default("round_robin"),
  account_ids: z.array(z.string().uuid()).min(1, "Au moins un compte email"),
  interval_min: z.number().int().min(1).max(3600).default(30),
  interval_max: z.number().int().min(1).max(7200).default(90),
  sending_hour_start: z.number().int().min(0).max(23).default(9),
  sending_hour_end: z.number().int().min(0).max(23).default(18),
  timezone: z.string().default("America/New_York"),
  filters: z.object({
    category: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    minScore: z.string().optional(),
    maxReviews: z.string().optional(),
    minReviews: z.string().optional(),
  }).default({}),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  template_ids: z.array(z.string().uuid()).optional(),
  assignment_method: z.enum(["round_robin", "random"]).optional(),
  filters: z.object({
    category: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    minScore: z.string().optional(),
    maxReviews: z.string().optional(),
    minReviews: z.string().optional(),
  }).optional(),
  interval_min: z.number().int().min(1).max(3600).optional(),
  interval_max: z.number().int().min(1).max(7200).optional(),
  sending_hour_start: z.number().int().min(0).max(23).optional(),
  sending_hour_end: z.number().int().min(0).max(23).optional(),
  timezone: z.string().optional(),
  account_ids: z.array(z.string().uuid()).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field to update",
});

// ── Jobs ────────────────────────────────────────────────────
export const createJobSchema = z.object({
  type: z.enum(["scrape", "enrich", "re-enrich", "screenshot", "email_batch"]),
  params: z.object({
    category: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    sources: z.array(z.string()).optional(),
    lead_id: z.string().uuid().optional(),
    slug: z.string().optional(),
    concurrency: z.number().int().min(1).max(10).optional(),
    maxResults: z.number().int().min(5).max(500).optional(),
    noWebsiteOnly: z.boolean().optional(),
    requireEmail: z.boolean().optional(),
    target: z.enum(["failed", "no_dm", "no_email"]).optional(),
    campaign_id: z.string().uuid().optional(),
  }),
});

// ── Templates ───────────────────────────────────────────────
export const createTemplateSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  subject: z.string().min(1, "Sujet requis"),
  body: z.string().min(1, "Corps requis"),
  language: z.string().default("en"),
  category: z.string().nullable().optional(),
  site_url: z.string().url().nullable().optional().or(z.literal("")),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  language: z.string().optional(),
  category: z.string().nullable().optional(),
  site_url: z.string().url().nullable().optional().or(z.literal("")),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field to update",
});

// ── Email Accounts ──────────────────────────────────────────
export const createEmailAccountSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  smtp_host: z.string().min(1, "SMTP host requis"),
  smtp_port: z.number().int().min(1).max(65535).default(587),
  smtp_user: z.string().min(1, "SMTP user requis"),
  smtp_pass: z.string().min(1, "SMTP pass requis"),
  sender_name: z.string().min(1, "Sender name requis"),
  sender_email: z.string().email("Email invalide"),
  daily_limit: z.number().int().min(1).max(10000).default(300),
  warmup_enabled: z.boolean().default(true),
});

export const updateEmailAccountSchema = z.object({
  name: z.string().min(1).optional(),
  smtp_host: z.string().min(1).optional(),
  smtp_port: z.number().int().min(1).max(65535).optional(),
  smtp_user: z.string().min(1).optional(),
  smtp_pass: z.string().min(1).optional(),
  sender_name: z.string().min(1).optional(),
  sender_email: z.string().email().optional(),
  daily_limit: z.number().int().min(1).max(10000).optional(),
  warmup_enabled: z.boolean().optional(),
  warmup_start_date: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field to update",
});
