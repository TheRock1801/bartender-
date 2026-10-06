-- Run once in the Supabase SQL editor. Adds "how to make it" text to each drink.
alter table drinks add column if not exists instructions text not null default '';
