-- ============================================================
-- Handyman Quote Generator — Database Schema
-- Lineage Labs | Phase 1
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Contractors (one per handyman business) ─────────────────────────────────
create table contractors (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null unique,
  business_name   text not null,
  owner_name      text not null,
  phone           text not null,
  email           text not null,
  license_number  text,
  logo_url        text,
  default_payment_terms text default 'Payment due upon completion.',
  default_caveats text,
  financing_options text,
  created_at      timestamptz default now() not null
);

alter table contractors enable row level security;

create policy "Contractors can only access their own record"
  on contractors for all
  using (auth.uid() = user_id);

-- ─── Clients ────────────────────────────────────────────────────────────────
create table clients (
  id             uuid primary key default uuid_generate_v4(),
  contractor_id  uuid references contractors(id) on delete cascade not null,
  name           text not null,
  address        text not null,
  city           text not null,
  state          text not null,
  zip            text not null,
  phone          text not null,
  email          text not null,
  notes          text,
  created_at     timestamptz default now() not null
);

alter table clients enable row level security;

create policy "Contractors see only their clients"
  on clients for all
  using (
    contractor_id in (
      select id from contractors where user_id = auth.uid()
    )
  );

-- ─── Pricing Templates ────────────────────────────────────────────────────────
create table pricing_templates (
  id             uuid primary key default uuid_generate_v4(),
  contractor_id  uuid references contractors(id) on delete cascade not null,
  name           text not null,
  description    text,
  pricing_type   text not null check (pricing_type in ('fixed', 'sqft', 'hourly')),
  unit_price     numeric(10,2) not null,
  unit_label     text,
  min_charge     numeric(10,2),
  category       text not null default 'General',
  created_at     timestamptz default now() not null
);

alter table pricing_templates enable row level security;

create policy "Contractors see only their pricing templates"
  on pricing_templates for all
  using (
    contractor_id in (
      select id from contractors where user_id = auth.uid()
    )
  );

-- ─── Quotes ──────────────────────────────────────────────────────────────────
create table quotes (
  id                  uuid primary key default uuid_generate_v4(),
  contractor_id       uuid references contractors(id) on delete cascade not null,
  client_id           uuid references clients(id) not null,
  quote_number        text not null,
  status              text not null default 'draft'
                        check (status in ('draft','sent','viewed','accepted','declined','expired')),
  voice_transcript    text,
  subtotal            numeric(10,2) not null default 0,
  tax_rate            numeric(5,4) not null default 0,
  tax_amount          numeric(10,2) not null default 0,
  total               numeric(10,2) not null default 0,
  payment_terms       text,
  caveats             text,
  financing_options   text,
  valid_until         date,
  notes               text,
  pdf_url             text,
  sent_at             timestamptz,
  viewed_at           timestamptz,
  responded_at        timestamptz,
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null
);

alter table quotes enable row level security;

create policy "Contractors see only their quotes"
  on quotes for all
  using (
    contractor_id in (
      select id from contractors where user_id = auth.uid()
    )
  );

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger quotes_updated_at
  before update on quotes
  for each row execute function update_updated_at();

-- Auto-generate quote numbers: Q-2025-0001
create or replace function generate_quote_number(p_contractor_id uuid)
returns text language plpgsql as $$
declare
  seq_num int;
  year_str text;
begin
  year_str := to_char(now(), 'YYYY');
  select count(*) + 1
    into seq_num
    from quotes
    where contractor_id = p_contractor_id
      and extract(year from created_at) = extract(year from now());
  return 'Q-' || year_str || '-' || lpad(seq_num::text, 4, '0');
end;
$$;

-- ─── Line Items ───────────────────────────────────────────────────────────────
create table line_items (
  id                    uuid primary key default uuid_generate_v4(),
  quote_id              uuid references quotes(id) on delete cascade not null,
  description           text not null,
  pricing_type          text not null check (pricing_type in ('fixed', 'sqft', 'hourly')),
  unit_price            numeric(10,2) not null,
  quantity              numeric(10,2) not null default 1,
  unit_label            text,
  total                 numeric(10,2) not null,
  sort_order            int not null default 0,
  notes                 text,
  pricing_template_id   uuid references pricing_templates(id) on delete set null
);

alter table line_items enable row level security;

create policy "Line items accessible through quote ownership"
  on line_items for all
  using (
    quote_id in (
      select q.id from quotes q
      join contractors c on c.id = q.contractor_id
      where c.user_id = auth.uid()
    )
  );

-- ─── Analytics Events ────────────────────────────────────────────────────────
-- Stores lightweight events for win/loss analysis
create table analytics_events (
  id             uuid primary key default uuid_generate_v4(),
  contractor_id  uuid references contractors(id) on delete cascade not null,
  quote_id       uuid references quotes(id) on delete cascade not null,
  event_type     text not null,   -- 'sent', 'viewed', 'accepted', 'declined'
  metadata       jsonb,
  created_at     timestamptz default now() not null
);

alter table analytics_events enable row level security;

create policy "Contractors see only their analytics"
  on analytics_events for all
  using (
    contractor_id in (
      select id from contractors where user_id = auth.uid()
    )
  );

-- ─── Analytics View ───────────────────────────────────────────────────────────
-- Materialized view for dashboard performance
create or replace view quote_analytics as
  select
    contractor_id,
    count(*) filter (where status != 'draft') as total_quotes,
    count(*) filter (where status = 'sent' or status = 'viewed') as pending_quotes,
    count(*) filter (where status = 'accepted') as accepted_quotes,
    count(*) filter (where status = 'declined') as declined_quotes,
    round(
      count(*) filter (where status = 'accepted')::numeric /
      nullif(count(*) filter (where status in ('accepted','declined')), 0) * 100,
      1
    ) as win_rate_pct,
    round(avg(total) filter (where status != 'draft'), 2) as avg_quote_value,
    sum(total) filter (where status = 'accepted') as total_revenue,
    sum(total) filter (where status in ('sent','viewed')) as pipeline_value
  from quotes
  group by contractor_id;

-- ─── Line item analytics view ─────────────────────────────────────────────────
create or replace view line_item_analytics as
  select
    q.contractor_id,
    li.description,
    li.pricing_type,
    count(*) as times_quoted,
    count(*) filter (where q.status = 'accepted') as times_accepted,
    count(*) filter (where q.status = 'declined') as times_declined,
    round(
      count(*) filter (where q.status = 'accepted')::numeric /
      nullif(count(*) filter (where q.status in ('accepted','declined')), 0) * 100,
      1
    ) as win_rate_pct,
    round(avg(li.unit_price), 2) as avg_unit_price,
    round(avg(li.total), 2) as avg_total
  from line_items li
  join quotes q on q.id = li.quote_id
  group by q.contractor_id, li.description, li.pricing_type
  order by times_quoted desc;

-- ─── Seed: Demo pricing templates (inserted after a contractor signs up) ───────
-- (These will be seeded via the onboarding flow, not here)

-- ─── Storage Buckets ──────────────────────────────────────────────────────────
-- Run in Supabase dashboard:
-- insert into storage.buckets (id, name, public) values ('quote-photos', 'quote-photos', false);
-- insert into storage.buckets (id, name, public) values ('quote-pdfs', 'quote-pdfs', false);
-- insert into storage.buckets (id, name, public) values ('logos', 'logos', true);
