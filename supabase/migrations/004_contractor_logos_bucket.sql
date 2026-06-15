-- ──────────────────────────────────────────────────────────────────────────────
-- 004_contractor_logos_bucket.sql
--
-- Creates the contractor-logos storage bucket (public read, so PDF renderers
-- and browsers can load logos via URL without authentication).
--
-- Run in Supabase dashboard → SQL Editor → New query → Run (F5)
-- ──────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contractor-logos',
  'contractor-logos',
  true,       -- public read so logos appear in PDFs and emails without signed URLs
  2097152,    -- 2 MB max per file
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- All writes go through the server-side admin client (POST /api/logos) which
-- bypasses storage RLS, so no client-facing write policies are needed.
-- Public read is controlled by the bucket's `public` flag above.
