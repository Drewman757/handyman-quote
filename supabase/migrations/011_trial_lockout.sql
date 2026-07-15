-- Trial-to-paid upgrade + lockout tracking for comp/beta contractor accounts.
-- stripe_subscription_id did NOT previously exist on contractors (only on the
-- untracked pending_signups table), so it's added here too.
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS trial_warning_sent_at timestamptz;
