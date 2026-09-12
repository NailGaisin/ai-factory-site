-- Revenue Operations: fields needed to measure acquisition and sales execution.
-- This migration is additive: it does not remove or overwrite existing lead data.

alter table public.leads
  add column if not exists lead_source text not null default 'direct',
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists first_contacted_at timestamptz,
  add column if not exists next_action_at timestamptz,
  add column if not exists lost_reason text,
  add column if not exists manager_note text;

create index if not exists leads_next_action_at_idx
  on public.leads (next_action_at)
  where next_action_at is not null;

create index if not exists leads_source_created_at_idx
  on public.leads (lead_source, created_at desc);
