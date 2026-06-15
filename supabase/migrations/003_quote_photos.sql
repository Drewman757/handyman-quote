-- ──────────────────────────────────────────────────────────────────────────────
-- 003_quote_photos.sql
--
-- Adds photo attachment support:
--   • photo_urls column on quotes (stores storage paths, not full URLs)
--   • quote-photos storage bucket creation
--
-- Run in Supabase dashboard → SQL Editor → New query → Run (F5)
-- ──────────────────────────────────────────────────────────────────────────────

-- Extend quotes table
alter table public.quotes
  add column if not exists photo_urls text[] not null default '{}';

-- Create the storage bucket (safe to run if it already exists)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quote-photos',
  'quote-photos',
  false,
  10485760,   -- 10 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- All reads/writes go through the server-side admin client which bypasses
-- storage RLS.  No client-facing storage policies are needed.
-- If you want direct client uploads in the future, add policies here.
