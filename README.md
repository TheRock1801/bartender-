# Riley & Jasmine · The Bar

Phone-based drink ordering for a wedding. Guests scan a QR code, pick a drink, say whether
they'll collect it from the bar or want it brought to their table, pop their name in, done.
Whoever is behind the bar sees one live, numbered queue on their own phones, claims orders so
nobody doubles up, and marks them ready and delivered.

Was the Aria & Jansen bartender app; written over and restyled to Riley and Jasmine's mood board.

## The two screens

| URL | Who | What |
|---|---|---|
| `/` | Guests | The bar menu in four tabs (Spirits, Cocktails, Beer & Wine, Non-alcoholic). A spirit opens a "choose your mixer" page (Coke, Coke Zero, Lemonade, Dry Ginger Ale, Soda Water, Tonic Water, Ginger Beer, Juice with a flavour, Other with a note, On the rocks, plus an optional light/stiff pour). "Your Order" has − / + per line, Collect from bar or Deliver to my table (with the table number), your name, and "Place order — it's on us!". Live status of your drinks sits at the top. |
| `/bar` | Bartenders | Shared PIN, then pick your name. Orders tab with All / New / Preparing / Ready / Delivered filters, order numbers, time, drink, collect-or-table and a status pill; tap a row for the actions (I've got it, Ready, Delivered, Put back, Cancel, Reopen). + Order for verbal orders, Menu to add drinks, recipes, mark run out, pause ordering, call last orders. |

Nothing sends email, takes payment, or needs an account.

## Run it locally

```
npm install
npm run dev
```

Vite serves the app at http://localhost:5173 and proxies `/api` to the Express
server on 3001. Without Supabase env vars it uses an in-memory store seeded with
the menu below. The local bar PIN is `1234`.

```
npm test        # API tests against the in-memory store
npm run build   # type-check + production bundle
```

## Deploy

Already wired up from the first wedding: pushing to `main` deploys on Vercel, which talks to the existing Supabase project.

1. **Supabase**: paste `supabase_riley_jasmine_reset.sql` into the SQL editor and run it once. It wipes the old wedding's orders and menu, adds the new columns, and loads the new menu. (A brand-new project would use `supabase_schema.sql` instead.)
2. **Vercel** env vars are unchanged: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BAR_PIN`. Change the PIN if the old crew still know it. Check Settings → Deployment Protection is off for Production, so guests don't hit a Vercel login.
3. Open `/bar`, enter the PIN, check the menu, place a test order from a phone.
4. Make a QR code for the site root and print a few signs. Guests never need `/bar`.

## On the night

- Edit `BARTENDERS` in `src/BarApp.tsx` to the real names before the day (the names are picked from a list so claims match across phones).
- Tap the bell on the bar screen once so your phone chimes on new orders (browsers need a tap before they'll play sound).
- "Pause ordering" when the queue gets silly. Guests see a banner and the order button goes away.
- "Call last orders" puts a banner on every guest's phone. Ordering stays open until you pause it.
- Menu tabs are fixed: Spirits, Cocktails, Beer & Wine, Non-alcoholic (`CATEGORIES`/`MIXERS` in `lib/store.js`). Add a spirit by its name only; guests choose the mixer.
- Tap any drink (Menu tab, or a drink name in an expanded order) for its recipe. Edit the steps there, mark it run out, see how many have been ordered tonight, or remove it from the menu.
- Someone asks you for a drink while you're walking around: "+ Order" tab, their name, collect or table, the drinks, done.
- Wi-Fi drops: the app keeps polling and shows the last known queue. Nothing is lost server-side.

## Starting menu

Spirits: Whiskey, Bourbon, Gin, Vodka, Rum, Brandy, Cognac. Cocktails: Espresso Martini, Aperol Spritz, Whiskey Sour. Beer & Wine: Beer, Red wine, White wine, Sparkling wine. Non-alcoholic: Lemonade, Juice, Sparkling water. Change any of it from the bar's Menu tab.

## Look

From the mood board: cream page (`cream`) with lighter cream cards (`ivory`), espresso text, terracotta (`amber`) for primary buttons and "Preparing", olive (`sage`) for "Ready", grey (`mist`) for "Delivered". Italianno script for the couple's name, "the bar" and "Your Order"; Cormorant Garamond for drink names and headings; Jost for everything else, spaced capitals for tabs and labels. The floral header and the glass illustrations are crops of the mood board in `public/art` (swap them for the real artwork when it arrives; `src/art.tsx` maps a spirit's name to its glass). Tokens in `tailwind.config.js`, reusable classes in `src/index.css`.

## Layout

```
api/index.js        all routes (guest: menu, orders; bar: PIN-gated queue/menu/settings)
lib/store.js        data access: in-memory (dev/tests) or Supabase (prod), same interface; menu constants
server.js           local dev server only; Vercel runs api/index.js directly
src/GuestApp.tsx    guest screen: menu, mixer page, order page, your drinks
src/BarApp.tsx      bartender screen: orders, + order, menu, recipe sheet
src/DrinkRows.tsx   shared drink rows, MixerSheet, CartSummary
src/art.tsx         illustrations, couple name block, icons
src/cart.ts         cart helpers and item labels
src/api.ts          typed client + localStorage helpers
src/usePoll.ts      visibility-aware polling hook
public/art          header florals + glass illustrations (cropped from the mood board)
supabase_riley_jasmine_reset.sql  run once on the existing project (wipe + new columns + new menu)
supabase_schema.sql               the same end state from scratch, for a brand-new project only
tests/api.test.js   end-to-end API tests
```
