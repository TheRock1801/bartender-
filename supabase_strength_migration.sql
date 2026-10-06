-- Run once in the Supabase SQL editor. Light / stiff pour choice on an order line.
alter table order_items add column if not exists strength text;
