-- Aria & Jansen drinks app. Paste into the Supabase SQL editor once.
-- All access goes through the API with the service role key; RLS on, no policies.

create extension if not exists pgcrypto;

create table if not exists drinks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default 'Cocktails',
  available boolean not null default true,
  sort integer not null default 0,
  added_by text,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  device_id text,
  placed_by text,
  status text not null default 'new' check (status in ('new','making','ready','delivered','cancelled')),
  claimed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  drink_id uuid references drinks(id) on delete set null,
  drink_name text not null,
  qty integer not null default 1 check (qty > 0)
);

create table if not exists settings (
  key text primary key,
  value jsonb not null
);

create index if not exists orders_status_idx on orders(status, created_at);
create index if not exists orders_device_idx on orders(device_id, created_at);
create index if not exists order_items_order_idx on order_items(order_id);

alter table drinks enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table settings enable row level security;

insert into drinks (name, description, category, sort) values
  ('Whiskey Old Fashioned', 'Whiskey, sugar, bitters, orange', 'Cocktails', 1),
  ('Bourbon & Coke', 'Tall, over ice', 'Mixers', 2)
on conflict do nothing;

insert into settings (key, value) values
  ('ordering_open', 'true'::jsonb),
  ('last_orders', 'false'::jsonb)
on conflict (key) do nothing;
