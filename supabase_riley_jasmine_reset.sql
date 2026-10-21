-- Turns the Aria & Jansen Supabase project into Riley & Jasmine's. Paste into the SQL editor once.
-- WIPES every old order, drink and guest from the A&J wedding (that night is done), adds the
-- columns this version needs, and loads the new menu. Safe to run again: it just resets again.
-- (Brand-new Supabase project instead? Run supabase_schema.sql, not this.)

-- 1. Clear out the old wedding
delete from order_items;
delete from orders;
delete from drinks;
drop table if exists guests;

-- 2. Columns this version needs
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
alter sequence orders_order_no_seq restart with 1;

-- 3. The new menu
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
  ('Orange juice', '', 'Non-alcoholic', 41),
  ('Pineapple juice', '', 'Non-alcoholic', 42),
  ('Cranberry juice', '', 'Non-alcoholic', 43),
  ('Sparkling water', '', 'Non-alcoholic', 44);

insert into settings (key, value) values
  ('ordering_open', 'true'::jsonb),
  ('last_orders', 'false'::jsonb)
on conflict (key) do update set value = excluded.value;
