-- Only needed if supabase_riley_jasmine_reset.sql was already run BEFORE 2026-10-22's
-- juice change. Swaps the single "Juice" drink for the three flavours so guests pick one.
-- (A fresh run of the reset already includes these, so running both is harmless.)

delete from drinks where name = 'Juice' and category = 'Non-alcoholic';

insert into drinks (name, description, category, sort) values
  ('Orange juice', '', 'Non-alcoholic', 41),
  ('Pineapple juice', '', 'Non-alcoholic', 42),
  ('Cranberry juice', '', 'Non-alcoholic', 43)
on conflict do nothing;

update drinks set sort = 44 where name = 'Sparkling water' and category = 'Non-alcoholic';
