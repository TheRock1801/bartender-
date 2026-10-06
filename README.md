# Aria & Jansen · Drinks

Phone-based drink ordering for a chill wedding. Guests scan a QR code, type their
name once, and order off the cocktail list. Four mates behind the bar see one live
queue on their own phones, claim orders so nobody doubles up, and walk the drinks out.

## The two screens

| URL | Who | What |
|---|---|---|
| `/` | Guests | Type your name (remembered on the phone), browse the menu, order. See live status of your drinks. |
| `/bar` | Bartenders | Shared PIN, then your name. Queue (claim / made it / delivered), type in verbal orders, add drinks, mark run out, pause ordering, call last orders. |

Nothing sends email, takes payment, or needs an account.

## Run it locally

```
npm install
npm run dev
```

Vite serves the app at http://localhost:5173 and proxies `/api` to the Express
server on 3001. Without Supabase env vars it uses an in-memory store seeded with
Whiskey Old Fashioned and Bourbon & Coke. The local bar PIN is `1234`.

```
npm test        # API tests against the in-memory store
npm run build   # type-check + production bundle
```

## Deploy (one-time, ~15 minutes)

1. **Supabase**: new project, paste `supabase_schema.sql` into the SQL editor and run it, then `supabase_add_instructions.sql` (added later, one column).
   Copy the project URL and the `service_role` key (Settings → API).
2. **Vercel**: import this repo. Set env vars on Production:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `BAR_PIN` (anything, four to six digits is easiest to share)
3. Deploy. Open `/bar`, enter the PIN, add the cocktail list from your phone.
4. Make a QR code for the site root and print a few signs. Guests never need `/bar`.

## On the night

- Tap the bell on the bar screen once so your phone chimes on new orders (browsers need a tap before they'll play sound).
- "Pause ordering" when the queue gets silly. Guests see a banner and the order button goes away.
- "Call last orders" puts a banner on every guest's phone. Ordering stays open until you pause it.
- Tap any drink (Menu tab, or a drink name in the queue) for its recipe. Edit the steps there, mark it run out, see how many have been ordered tonight, or remove it from the menu.
- Run out of something: tap the drink, then "Mark run out". Guests see "Run out, sorry" straight away.
- Someone asks you for a drink while you're walking around: "+ Order" tab, their name, the drinks, done. It lands in the queue for whoever's at the bar.
- Wi-Fi drops: the app keeps polling and shows the last known queue. Nothing is lost server-side.

## Layout

```
api/index.js        all routes (guest: menu, orders; bar: PIN-gated queue/menu/settings)
lib/store.js        data access: in-memory (dev/tests) or Supabase (prod), same interface
server.js           local dev server only; Vercel runs api/index.js directly
src/GuestApp.tsx    guest screen
src/BarApp.tsx      bartender screen
src/api.ts          typed client + localStorage helpers
src/usePoll.ts      visibility-aware polling hook
supabase_schema.sql tables + seed
tests/api.test.js   end-to-end API tests
```
