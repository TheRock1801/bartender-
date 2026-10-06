-- Run once in the Supabase SQL editor. Spirits are ordered as spirit + mixer,
-- and the guest menu is three tabs: Cocktails, Spirits, Beer & Wine.

alter table order_items add column if not exists mixer text;

-- The old "Mixers" category becomes "Spirits", and the seed "Bourbon & Coke"
-- becomes plain "Bourbon" (guests now pick Coke/Rocks/etc themselves).
update drinks set category = 'Spirits' where category = 'Mixers';
update drinks set name = 'Bourbon', description = '' where name = 'Bourbon & Coke';

-- Beer & Wine starters. Skipped if a drink with that name already exists.
insert into drinks (name, category, sort)
select v.name, 'Beer & Wine', (select coalesce(max(sort), 0) from drinks) + v.n
from (values ('Speights', 1), ('Red wine', 2), ('White wine', 3), ('Sparkling wine', 4)) as v(name, n)
where not exists (select 1 from drinks d where d.name = v.name);
