-- Run once in the Supabase SQL editor. Adds the Soft Drinks tab's first drink and
-- fixes the bourbon spelling on the live menu. Categories are plain text, so no
-- schema change is needed for the new tab.

update drinks set name = 'Bourbon' where lower(trim(name)) in ('burbon', 'bourban', 'bourbon');

insert into drinks (name, description, category, sort)
select 'Juice & Lemonade', '', 'Soft Drinks', (select coalesce(max(sort), 0) from drinks) + 1
where not exists (select 1 from drinks d where lower(d.name) = 'juice & lemonade');
