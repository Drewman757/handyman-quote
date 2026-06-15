-- ──────────────────────────────────────────────────────────────────────────────
-- 002_grants.sql
--
-- Supabase automatically issues these grants when tables are created through
-- the CLI or dashboard UI.  If the schema was applied by pasting the raw SQL
-- into the SQL editor (bypassing the CLI migration runner), the grants are
-- missing and every role — including service_role — gets
-- "permission denied for table <name>".
--
-- Run this once in the Supabase dashboard:
--   Dashboard → SQL Editor → New query → paste → Run (F5)
-- ──────────────────────────────────────────────────────────────────────────────

-- Schema visibility
grant usage on schema public to anon, authenticated, service_role;

-- Full table access for all Supabase auth roles.
-- Row-level security policies (in 001) still filter what anon/authenticated
-- can read/write; service_role bypasses RLS entirely via BYPASSRLS.
grant all on table public.contractors       to anon, authenticated, service_role;
grant all on table public.clients          to anon, authenticated, service_role;
grant all on table public.quotes           to anon, authenticated, service_role;
grant all on table public.line_items       to anon, authenticated, service_role;
grant all on table public.pricing_templates to anon, authenticated, service_role;
grant all on table public.analytics_events  to anon, authenticated, service_role;

-- Sequence access (uuid_generate_v4 uses its own extension, but explicit is
-- safer across Postgres versions)
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- RPC / function access
grant execute on function public.generate_quote_number(uuid) to authenticated, service_role;
grant execute on function public.update_updated_at()         to authenticated, service_role;

-- Views
grant select on public.quote_analytics     to authenticated, service_role;
grant select on public.line_item_analytics to authenticated, service_role;
