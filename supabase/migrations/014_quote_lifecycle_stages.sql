-- Manual lifecycle-stage timestamps for quotes, layered on top of the existing
-- status enum (draft/sent/viewed/accepted/declined) and is_paid — same pattern,
-- purely contractor-set markers with no automated triggers behind them.
--
-- follow_up_sent_at is NOT added here — it already exists (006_followup.sql)
-- and is tied to the real follow-up email feature (FollowUp.tsx), not a manual
-- marker. The lifecycle stepper reuses that existing field instead of a
-- duplicate/conflicting one.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS project_started_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS invoice_sent_at timestamptz;
