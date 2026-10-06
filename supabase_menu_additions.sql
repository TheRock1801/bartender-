-- Run once in the Supabase SQL editor. Adds the spirits range and two cocktails.
-- Each insert is skipped if a drink with that name already exists.

insert into drinks (name, description, category, instructions, sort)
select v.name, v.description, v.category, v.instructions,
       (select coalesce(max(sort), 0) from drinks) + v.n
from (values
  ('Limoncello Spritz', 'Limoncello, prosecco, soda', 'Cocktails',
   E'Wine glass, lots of ice.\n60ml limoncello\n90ml prosecco\n30ml soda water\nBuild over ice, give it one gentle stir.\nLemon wheel, mint sprig if we have it.', 1),
  ('Paloma', 'Tequila, lime, grapefruit soda', 'Cocktails',
   E'Highball, ice. Salt rim optional (lime wedge round the rim, dip in salt).\n50ml tequila\n15ml fresh lime juice\nPinch of salt\nTop with grapefruit soda (about 100ml).\nStir once, grapefruit or lime wedge.', 2),
  ('Vodka', '', 'Spirits', '', 3),
  ('Gin', '', 'Spirits', '', 4),
  ('Whisky', '', 'Spirits', '', 5),
  ('Rum', '', 'Spirits', '', 6),
  ('Dark rum', '', 'Spirits', '', 7),
  ('Tequila', '', 'Spirits', '', 8)
) as v(name, description, category, instructions, n)
where not exists (select 1 from drinks d where d.name = v.name);
