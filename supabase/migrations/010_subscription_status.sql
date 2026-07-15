-- Add subscription_status to track comp/beta accounts created manually by an admin,
-- outside the normal Stripe checkout + approval flow.
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS subscription_status text;
