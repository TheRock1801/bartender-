# Aria & Jansen drinks app ("the bartender app") — CLAUDE.md

Personal side project for Rocky Judd, **not Harrows work**. A phone web app for ordering drinks at Aria and Jansen's wedding. Guests scan a QR code, type a name once, order off three tabs. Four mates behind the bar (Rocky, Tussock, Ari, Todd) share one live queue on their own phones. Built 2026-10-06 in one evening; everything below was decided that night.

**Path:** `C:/Users/rockyj/aria-jansen-drinks`
**GitHub:** https://github.com/TheRock1801/bartender- (Rocky's PERSONAL GitHub, note the trailing dash)
**Vercel:** project `bartender` in Rocky's PERSONAL Vercel account (team slug `rocky-apps`). Auto-deploys on push to `main`. Deployment URL seen so far: `bartender-9dw7dlipa-rocky-apps.vercel.app`; the public production URL is whatever the project's Domains page says.
**Supabase:** Rocky's own project, created 2026-10-06. Service-role key only, RLS on with no policies.
**Dev:** `npm run dev` (Vite on 5173 proxying `/api` to Express on 3001, in-memory store, PIN `1234`). `npm test` runs API tests against the in-memory store. `npm run build` type-checks and bundles.

## Accounts and access gotchas

- **Commit identity is plain `Rocky Judd <rocky@harrows.co.nz>`**, passed per-commit with `git -c user.name=... -c user.email=...`. Not the HarrowsMarketing identity. Rocky does not want PRs or review branches: finish, verify (tests + build), commit, push to main.
- **The Vercel CLI on this machine is logged in as `harrowsadmin`** (Harrows team) and cannot see this project. Don't log it into Rocky's personal account without asking, that replaces the Harrows login. The CLI only works on this network with `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- **`gh` is not on PATH.** GitHub's public API via PowerShell `Invoke-RestMethod` works for deployment status (curl in Git Bash fails TLS here).
- **Headless Chrome/Edge hang in this sandbox.** Icons were drawn with `jimp` from `~/Harrows-dashboard/node_modules` (script kept in the session scratchpad only; recreate if needed: cream bg, espresso "A&J", orange ampersand, "DRINKS" below).
- **Vercel Deployment Protection**: as of 2026-10-06 every URL for the project, including the `-rocky-apps` production alias, redirected to Vercel Authentication. Guests would hit a login screen. Rocky was told to set Settings → Deployment Protection to preview-only (or off) and confirm in an incognito window. A custom domain (wanted, not yet chosen) is public regardless. **Not yet confirmed fixed.**
- **Git on this machine converts LF to CRLF on checkout.** Any multi-line string replacement against a freshly checked-out file must normalise `\r\n` first, or anchors silently miss.

## Stack and layout

React 19 + Vite + TypeScript + Tailwind v3, Express in one Vercel function, Supabase via `@supabase/supabase-js`. Installable PWA.

```
api/index.js        all routes. Guest: GET /api/menu, POST /api/orders, GET /api/orders/mine.
                    Bar (x-bar-pin header): /api/bar/login, /orders (GET incl. tally, POST verbal order,
                    PATCH :id actions claim/unclaim/ready/delivered/cancel/reopen), /drinks (POST, PATCH :id,
                    DELETE :id), /settings. resolveItems() validates drink/mixer/strength and merges lines.
lib/store.js        memoryStore() and supabaseStore() behind one interface. Also the menu constants:
                    CATEGORIES, SPIRITS_CATEGORY, MIXERS, STRENGTHS, SEED_DRINKS.
server.js           local dev only
src/App.tsx         path router: /bar -> BarApp, everything else -> GuestApp
src/GuestApp.tsx    Join (name lookup / is-that-you / initial) -> Flavour (prefs slide toggles + FavouritePicker) -> Menu (favourite pinned, ordering)
src/BarApp.tsx      PIN -> pick name -> Bar (queue / + order / menu tabs, DrinkSheet recipe popup)
src/DrinkRows.tsx   shared ordering rows (spirit panel with pour + mixers) and CartSummary
src/cart.ts         cart keyed by drink|mixer|strength; bumpCart, setStrength, itemLabel, groupByTab
src/api.ts          typed fetch client + localStorage helpers
src/usePoll.ts      visibility-aware polling
src/index.css       design tokens as component classes (see Look)
tailwind.config.js  colour/font tokens
public/             manifest.webmanifest, sw.js (network-only, caches NOTHING on purpose), icons
supabase_*.sql      migrations, see below
tests/api.test.js   node:test, 10 tests
```

## Data model (Supabase)

- `drinks`: id, name, description, category, available, sort, added_by, instructions (recipe text), created_at
- `orders`: id, guest_name, device_id, placed_by (bartender for verbal orders), status new/making/ready/delivered/cancelled, claimed_by, created_at, updated_at
- `order_items`: id, order_id (cascade), drink_id (set null on drink delete), drink_name, mixer, strength, qty
- `settings`: key/value jsonb (`ordering_open`, `last_orders`)
- `guests` (added 2026-10-07): id, name, name_key (unique, lowercased/trimmed), device_id (phone currently using it), prefs jsonb, favourite jsonb, timestamps. **A guest's name IS their account.**

**Migrations, run manually in the Supabase SQL editor, in this order** (no migration runner; all idempotent): `supabase_schema.sql`, `supabase_add_instructions.sql`, `supabase_spirits_migration.sql`, `supabase_menu_additions.sql`, `supabase_strength_migration.sql`, `supabase_guests_migration.sql`. **All six confirmed run by Rocky (first five 2026-10-06, guests 2026-10-07 after the live app showed "could not find the table public.guests").** A new column needs a new file and Rocky has to run it before the deploy that uses it, or writes fail.

Env vars on Vercel (Production): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (must be the service_role / `sb_secret_` key, the publishable key gives "violates row-level security"), `BAR_PIN`. Env changes need a redeploy to take effect.

## Product rules Rocky has set (don't undo)

- Deliberately minimal: no tables, no "where am I", no per-guest order cap, no payments, no accounts, no email. Date doesn't matter.
- **Guests log in with just their name (2026-10-07).** `POST /api/guests/lookup` says if a name exists; `POST /api/guests/join` creates it or, with `takeover`, re-links it to this phone ("there's already a Sam here. is that you?" → yes). A different person with a taken name is prompted for a last-name initial and becomes "Sam B" (loops if that is taken too). Prefs and favourite live on the guest row (`PUT /api/guests/me`) with a localStorage cache; `/api/orders/mine?name=` matches orders case-insensitively by `guest_name`, so a new phone gets the drinks back too. The name page's "recent orders from this phone" still uses `?device_id=`. No passwords, deliberately: anyone can claim any name by saying "yes, that's me".
- Bartenders pick their name from the fixed list `BARTENDERS` in `BarApp.tsx`, never type it.
- **Menu tabs are fixed and in this order: Spirits, Cocktails, Beer & Wine** (`CATEGORIES`). Spirits is the default tab.
- **Spirits are ordered as spirit + mixer.** Guest-facing base mixers (`MIXERS`): Rocks ("on the rocks"), Coke, Lemonade, Water, Ginger Beer. A spirit without a mixer is rejected server-side; a mixer on a non-spirit is rejected.
- **Flavour prefs (added 2026-10-06, moved server-side onto the guest row 2026-10-07):** after the name, a "what's your flavour?" step with three slide toggles: coke fat/skinny, lemonade fat/skinny, water still/sparkling (fat = regular, skinny = diet). Stored on the guest row with a phone cache (`aj_prefs`) and sent with every guest order; the server's `resolveMixer()` turns the base mixer into the exact pour and THAT is what `order_items.mixer` stores (Coke / Skinny Coke / Lemonade / Skinny Lemonade / Still Water / Sparkling Water). Bartenders' verbal-order chips are the resolved `MIXER_VARIANTS` directly. `src/cart.ts` has a client copy of resolveMixer for labels, keep the two in step. Older rows may still hold the pre-change mixers "Water (still)"/"Sparkling"; they render as-is.
- **Favourite:** same step offers "add your favourite" (drink + mixer + pour for a spirit); stored on the phone (`aj_fav`, base mixer) and pinned at the top of the menu with an "add one" button and a "change favourite" link. Hidden if the drink was removed. "your flavour" link next to "not you?" reopens the step.
- **Light / Stiff pour is spirits only** (Rocky corrected this mid-build: "no only spirits not cocktails"). One pour per spirit in an order; changing it moves every line of that spirit. Null = regular.
- Pour chips appear only inside a spirit's panel after tapping "choose", never up front (Rocky's second correction). The bottom bar is a `+N` count chip (opens a review sheet with − / + per line) and a "complete order" button.
- Spirits on the menu: Bourbon, Vodka, Gin, Whisky, Rum, Dark rum, Tequila. Cocktails: Whiskey Old Fashioned, Limoncello Spritz, Paloma (recipes in `instructions`). Beer & Wine: Speights, Red wine, White wine, Sparkling wine. Bartenders add/remove more from the app.
- Tapping a drink on the bar's Menu tab (or a drink name in the queue) opens a recipe sheet: instructions (editable), ordered-tonight tally (cancelled excluded), mark run out, remove (confirm step; past orders keep the name).
- Bar queue: "Up for grabs" / "Mine" / "Others are on it"; claim, made it, delivered, put back, cancel. Optional chime on new orders (needs a tap first).

## Look (restyled 2026-10-06 to a written stationery brief; the reference screenshot never arrived)

Warm, editorial, lowercase. Tokens in `tailwind.config.js` keep the ORIGINAL colour names so old classes work: `cream`/`ivory` #F3E8DB page, `sand` #DDC9B5, `taupe` #A58E7B rules, `peach` #EBC3A5, `cocoa`/`espresso` #42362F text, `amber` = burnt orange #B85E28 for primary actions and sparse accents, `sage` #7E8C74 only for ready/delivered. Fonts from Google Fonts with fallbacks: League Spartan 800 for `display` headings (written lowercase with a full stop: "aria & jansen.", "menu.", "bar."), IBM Plex Mono for `label`/`eyebrow`/chips/meta, Inter body. Classes: `btn-primary` (espresso/ivory), `btn-soft` (transparent, thin espresso border), `btn-ghost`, `card`, `row` (hairline list rows, preferred over cards), `divider`, `input`, `pill`, `fade-up`. Faint SVG paper grain on `body::before`. `prefers-reduced-motion` respected. No shadows, no pills-as-buttons, no gradients beyond the bottom-bar fade. The brief's countdown/RSVP/schedule/gallery sections do NOT apply (this isn't a wedding website); Rocky may ask for a landing page later.

## Open items

- Custom domain: Rocky wants one, none chosen yet. Add in Vercel → Domains; CNAME `cname.vercel-dns.com` for a subdomain or A `76.76.21.21` for a bare domain. Then update `manifest.webmanifest`/README if the name matters.
- Confirm Deployment Protection is off for production (see gotchas) and that the QR code points at the public domain.
- Nothing in this app has been screenshotted or visually verified by Claude; Rocky checks on his phone. Rocky's installed PWA keeps the loaded version until fully closed and reopened.
- Local Vercel CLI can't inspect this project; if build logs are ever needed, ask Rocky to paste them or use a personal-account token with `vercel --token`.
