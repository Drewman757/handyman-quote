-- Manual "Mark as Paid" flag for quotes. Contractors get paid outside the app
-- (cash, check, Venmo, etc.) and use this purely as a record/display flag —
-- no payment processing is involved.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS paid_at timestamptz;
