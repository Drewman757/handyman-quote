-- Adds a paid_quotes count to quote_analytics so the win/loss chart can split
-- the Accepted bar into Paid vs Not-yet-paid. Depends on quotes.is_paid from
-- 012_quote_paid_status.sql — run that one first if it hasn't been applied yet.
create or replace view quote_analytics as
  select
    contractor_id,
    count(*) filter (where status != 'draft') as total_quotes,
    count(*) filter (where status = 'sent' or status = 'viewed') as pending_quotes,
    count(*) filter (where status = 'accepted') as accepted_quotes,
    count(*) filter (where status = 'accepted' and is_paid) as paid_quotes,
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
