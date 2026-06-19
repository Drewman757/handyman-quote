-- Add agreed_to_terms_at column to pending_signups and contractors
-- Records the timestamp at which the user accepted the Terms of Service,
-- Privacy Policy, and Data Use Agreement during signup.

ALTER TABLE pending_signups
  ADD COLUMN IF NOT EXISTS agreed_to_terms_at TIMESTAMPTZ;

ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS agreed_to_terms_at TIMESTAMPTZ;
