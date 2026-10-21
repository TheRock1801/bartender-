-- Riley & Jasmine drinks app, from scratch, for a BRAND-NEW Supabase project only.
-- All access goes through the API with the service role key; RLS on, no policies.
-- The live app uses the old Aria & Jansen project: run supabase_riley_jasmine_reset.sql there, not this.

create extension if not exists pgcrypto;

create table if not exists drinks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default 'Cocktails',
  available boolean not null default true,
  sort integer not null default 0,
  added_by text,
  instructions text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_no serial not null,                 -- the "#14" guests and bartenders see
  guest_name text not null,
  device_id text,
  placed_by text,                           -- bartender, for verbal orders
  fulfilment text not null default 'collect' check (fulfilment in ('collect','deliver')),
  table_no text,                            -- only when fulfilment = 'deliver'
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
  mixer text,                               -- spirits only: Coke, Tonic Water, "Other: lime & soda"…
  strength text check (strength in ('light','stiff')),  -- spirits only; null = regular pour
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
  ('Whiskey', '', 'Spirits', 10),
  ('Bourbon', '', 'Spirits', 11),
  ('Gin', '', 'Spirits', 12),
  ('Vodka', '', 'Spirits', 13),
  ('Rum', '', 'Spirits', 14),
  ('Brandy', '', 'Spirits', 15),
  ('Cognac', '', 'Spirits', 16),
  ('Espresso Martini', 'Vodka, coffee liqueur, espresso', 'Cocktails', 20),
  ('Aperol Spritz', 'Aperol, prosecco, soda, orange', 'Cocktails', 21),
  ('Whiskey Sour', 'Whiskey, lemon, sugar, egg white', 'Cocktails', 22),
  ('Beer', '', 'Beer & Wine', 30),
  ('Red wine', '', 'Beer & Wine', 31),
  ('White wine', '', 'Beer & Wine', 32),
  ('Sparkling wine', '', 'Beer & Wine', 33),
  ('Lemonade', '', 'Non-alcoholic', 40),
  ('Juice', 'Orange, pineapple or cranberry', 'Non-alcoholic', 41),
  ('Sparkling water', '', 'Non-alcoholic', 42)
on conflict do nothing;

insert into settings (key, value) values
  ('ordering_open', 'true'::jsonb),
  ('last_orders', 'false'::jsonb)
on conflict (key) do nothing;
