-- Riley & Jasmine, 2026-11-10: ONE script that is safe whatever state the project is in.
--   * never ran the reset (still the Aria & Jansen tables and menu)  -> fixes everything
--   * already ran the reset (old cocktails + juices still in the menu) -> swaps the menu only
--   * already ran this file                                           -> changes nothing
-- Paste the whole thing into the Supabase SQL editor and run it once (or again, harmless).
--
-- What it does: makes sure every table/column this version of the app needs exists,
-- drops the old guests table, throws away orders from before today (the A&J wedding and
-- any old tests), and makes the drinks table match the menu in lib/store.js exactly
-- (Spirits / Aperol Spritz, Margarita, Whiskey + Bourbon Old Fashioned / Beer & Wine /
-- Lemonade, Sparkling water). Drinks not on that list are deleted; past order lines keep
-- their drink_name so nothing in the history breaks.

create extension if not exists pgcrypto;

-- 1. Tables (no-ops when they already exist)
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
  order_no serial not null,
  guest_name text not null,
  device_id text,
  placed_by text,
  fulfilment text not null default 'collect' check (fulfilment in ('collect','deliver')),
  table_no text,
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
  mixer text,
  strength text check (strength in ('light')),
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

-- 2. Columns the current app needs (no-ops when already there)
alter table drinks add column if not exists instructions text not null default '';
alter table order_items add column if not exists mixer text;
alter table order_items add column if not exists strength text;
alter table orders add column if not exists order_no serial not null;
alter table orders add column if not exists fulfilment text not null default 'collect';
alter table orders add column if not exists table_no text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_fulfilment_check') then
    alter table orders add constraint orders_fulfilment_check check (fulfilment in ('collect','deliver'));
  end if;
end $$;

-- 3. Old wedding leftovers
drop table if exists guests;

-- Orders from before today (NZ) are the A&J night and old tests. Anything placed today stays.
delete from order_items where order_id in (select id from orders where created_at < timestamptz '2026-11-09 11:00:00+00');
delete from orders where created_at < timestamptz '2026-11-09 11:00:00+00';
do $$ begin
  if not exists (select 1 from orders) then
    alter sequence orders_order_no_seq restart with 1;
  end if;
end $$;

-- 4. Make the drinks table match the app's menu exactly
create temp table new_menu (name text, description text, category text, sort integer);
insert into new_menu values
  ('Whiskey', '', 'Spirits', 10),
  ('Bourbon', '', 'Spirits', 11),
  ('Gin', '', 'Spirits', 12),
  ('Vodka', '', 'Spirits', 13),
  ('Rum', '', 'Spirits', 14),
  ('Brandy', '', 'Spirits', 15),
  ('Cognac', '', 'Spirits', 16),
  ('Aperol Spritz', 'Aperol, prosecco, soda, orange', 'Cocktails', 20),
  ('Margarita', 'Tequila, lime, triple sec, salt rim', 'Cocktails', 21),
  ('Whiskey Old Fashioned', 'Whiskey, sugar, bitters, orange peel', 'Cocktails', 22),
  ('Bourbon Old Fashioned', 'Bourbon, sugar, bitters, orange peel', 'Cocktails', 23),
  ('Beer', '', 'Beer & Wine', 30),
  ('Red wine', '', 'Beer & Wine', 31),
  ('White wine', '', 'Beer & Wine', 32),
  ('Sparkling wine', '', 'Beer & Wine', 33),
  ('Lemonade', '', 'Non-alcoholic', 40),
  ('Sparkling water', '', 'Non-alcoholic', 41);

-- Drinks that are not on the list go (old A&J menu, Espresso Martini, Whiskey Sour, every juice).
-- Unlink them from any surviving order lines first; drink_name on the line keeps the history readable.
update order_items set drink_id = null
  where drink_id in (
    select d.id from drinks d
    where not exists (select 1 from new_menu m where m.name = d.name and m.category = d.category)
  );
delete from drinks d
  where not exists (select 1 from new_menu m where m.name = d.name and m.category = d.category);

-- Drinks already on the list: refresh description/order and put them back on the menu.
update drinks d set description = m.description, sort = m.sort, available = true
  from new_menu m where m.name = d.name and m.category = d.category;

-- Drinks on the list but missing: add them.
insert into drinks (name, description, category, sort)
  select m.name, m.description, m.category, m.sort from new_menu m
  where not exists (select 1 from drinks d where d.name = m.name and d.category = m.category);

drop table new_menu;

-- 5. Ordering open, last orders off
insert into settings (key, value) values
  ('ordering_open', 'true'::jsonb),
  ('last_orders', 'false'::jsonb)
on conflict (key) do update set value = excluded.value;

-- Check: should list the 17 drinks above in menu order.
select category, name, sort, available from drinks order by sort;
