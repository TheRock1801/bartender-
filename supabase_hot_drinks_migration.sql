-- Run once in the Supabase SQL editor. Adds the Hot Drinks tab's three starting
-- drinks (2026-10-13). Categories are plain text and the sugar choice is stored in
-- order_items.mixer, so no schema change is needed for the new tab.

insert into drinks (name, description, category, sort)
select 'Flat White', '', 'Hot Drinks', (select coalesce(max(sort), 0) from drinks) + 1
where not exists (select 1 from drinks d where lower(d.name) = 'flat white');

insert into drinks (name, description, category, sort)
select 'Black coffee', '', 'Hot Drinks', (select coalesce(max(sort), 0) from drinks) + 1
where not exists (select 1 from drinks d where lower(d.name) in ('black coffee', 'black', 'long black'));

insert into drinks (name, description, category, sort)
select 'Tea', '', 'Hot Drinks', (select coalesce(max(sort), 0) from drinks) + 1
where not exists (select 1 from drinks d where lower(d.name) = 'tea');
