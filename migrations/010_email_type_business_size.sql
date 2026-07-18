-- Add email_type (personal/generic) and business_size (small/medium/large)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_type text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS business_size text;

-- Backfill email_type for existing leads with emails
UPDATE leads SET email_type = CASE
  WHEN split_part(email, '@', 1) IN (
    'info', 'contact', 'admin', 'support', 'hello', 'office', 'sales',
    'service', 'help', 'billing', 'enquiries', 'enquiry', 'general',
    'team', 'staff', 'mail', 'email', 'webmaster', 'postmaster',
    'noreply', 'no-reply', 'marketing', 'media', 'press', 'hr',
    'jobs', 'careers', 'feedback', 'complaints', 'reception',
    'frontdesk', 'front-desk', 'customerservice', 'customer-service'
  ) THEN 'generic'
  ELSE 'personal'
END
WHERE email IS NOT NULL AND email_type IS NULL;

-- Backfill business_size for existing leads
UPDATE leads SET business_size = CASE
  WHEN name ~* '\m(group|national|corp|inc|franchise|chain|holdings|enterprises|international|worldwide|global)\M' THEN 'large'
  WHEN reviews_count > 500 THEN 'large'
  WHEN reviews_count > 100 THEN 'medium'
  ELSE 'small'
END
WHERE business_size IS NULL;
