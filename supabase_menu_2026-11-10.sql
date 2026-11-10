-- 2026-11-10 menu change (Rocky): cocktails are Aperol Spritz, Margarita and an Old Fashioned
-- (whiskey or bourbon); no juice anywhere (dropped as mixers in code, dropped as drinks here).
-- Run once in the Supabase SQL editor on a database that already had the Riley & Jasmine
-- reset applied. A fresh run of supabase_riley_jasmine_reset.sql already includes all of this.
-- Past orders keep their drink names (order_items stores drink_name), so deleting is safe.

delete from drinks where category = 'Cocktails' and name in ('Espresso Martini', 'Whiskey Sour');
delete from drinks where category = 'Non-alcoholic' and name in ('Juice', 'Orange juice', 'Pineapple juice', 'Cranberry juice');

insert into drinks (name, description, category, sort) values
  ('Margarita', 'Tequila, lime, triple sec, salt rim', 'Cocktails', 21),
  ('Whiskey Old Fashioned', 'Whiskey, sugar, bitters, orange peel', 'Cocktails', 22),
  ('Bourbon Old Fashioned', 'Bourbon, sugar, bitters, orange peel', 'Cocktails', 23)
on conflict do nothing;

-- drinks.name has no unique constraint, so "on conflict" above never fires; add Aperol Spritz only if it is missing.
insert into drinks (name, description, category, sort)
select 'Aperol Spritz', 'Aperol, prosecco, soda, orange', 'Cocktails', 20
where not exists (select 1 from drinks where name = 'Aperol Spritz' and category = 'Cocktails');
update drinks set sort = 20, available = true where name = 'Aperol Spritz' and category = 'Cocktails';
update drinks set sort = 41 where name = 'Sparkling water' and category = 'Non-alcoholic';
