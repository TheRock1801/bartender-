-- Run once in the Supabase SQL editor. Guests are their name: one row per name,
-- holding the phone currently using it plus flavour prefs and favourite, so typing
-- the same name on any phone brings everything back.

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null unique,          -- lowercased, trimmed name
  device_id text,
  prefs jsonb,
  favourite jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table guests enable row level security;

-- orders/mine now looks up by name (case-insensitive)
create index if not exists orders_guest_name_idx on orders (lower(guest_name), created_at);
