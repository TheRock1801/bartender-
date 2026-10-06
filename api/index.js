// All API routes. Deployed as one Vercel function (see vercel.json rewrite);
// also mounted by server.js for local dev.

import express from 'express'
import { storeFromEnv, OPEN_STATUSES, ORDER_STATUSES, CATEGORIES, SPIRITS_CATEGORY, MIXERS, MIXER_VARIANTS, PREF_OPTIONS, DEFAULT_PREFS, normalisePrefs, resolveMixer, STRENGTHS } from '../lib/store.js'

export function buildApp(store, { barPin }) {
  const app = express()
  app.use(express.json({ limit: '50kb' }))

  const bad = (res, status, error) => res.status(status).json({ error })
  const str = (v, max = 60) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

  async function menuPayload() {
    const [drinks, settings] = await Promise.all([store.listDrinks(), store.getSettings()])
    return {
      drinks, settings,
      categories: CATEGORIES, spirits_category: SPIRITS_CATEGORY, mixers: MIXERS,
      mixer_variants: MIXER_VARIANTS, pref_options: PREF_OPTIONS, default_prefs: DEFAULT_PREFS,
      strengths: STRENGTHS,
    }
  }

  // Normalise a submitted items list against the current menu. Returns {items} or {error}.
  // A guest's base mixer (Coke / Lemonade) is resolved with their flavour prefs;
  // a bartender can send the resolved variant directly.
  async function resolveItems(rawItems, { requireAvailable, prefs = {} }) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) return { error: 'pick something first' }
    const drinks = await store.listDrinks()
    const byId = new Map(drinks.map((d) => [d.id, d]))
    const merged = new Map()
    for (const it of rawItems) {
      const d = byId.get(it?.drink_id)
      if (!d) return { error: "one of those just came off the menu, sorry" }
      if (requireAvailable && !d.available) return { error: `${d.name}'s all gone, sorry` }
      const qty = Math.min(10, Math.max(1, Math.floor(Number(it.qty) || 1)))
      let mixer = null
      if (d.category === SPIRITS_CATEGORY) {
        mixer = str(it.mixer, 30)
        if (MIXERS.includes(mixer)) mixer = resolveMixer(mixer, prefs)
        else if (!MIXER_VARIANTS.includes(mixer)) return { error: `what do you want with your ${d.name}?` }
      } else if (it.mixer) {
        return { error: `${d.name} doesn't take a mixer` }
      }
      let strength = null
      if (it.strength) {
        strength = str(it.strength, 10).toLowerCase()
        if (!STRENGTHS.includes(strength)) return { error: 'pour is light or stiff' }
        if (d.category !== SPIRITS_CATEGORY) return { error: 'light or stiff is just for spirits' }
      }
      const key = d.id + '|' + (mixer || '') + '|' + (strength || '')
      merged.set(key, { drink_id: d.id, drink_name: d.name, mixer, strength, qty: (merged.get(key)?.qty || 0) + qty })
    }
    return { items: [...merged.values()] }
  }

  // ---- Guest routes (no auth) ----

  // Guests are their name. Lookup says whether a name is taken; join creates it or, with
  // takeover, re-links an existing name to this phone (logged out, new phone). A different
  // person with the same first name is expected to add a last-name initial client-side.
  const publicGuest = (g) => ({ name: g.name, prefs: g.prefs || null, favourite: g.favourite || null })

  app.post('/api/guests/lookup', async (req, res, next) => {
    try {
      const name = str(req.body?.name)
      if (!name) return bad(res, 400, 'need your name first')
      const g = await store.getGuest(name)
      res.json({ exists: !!g, name: g ? g.name : name })
    } catch (e) { next(e) }
  })

  app.post('/api/guests/join', async (req, res, next) => {
    try {
      const name = str(req.body?.name)
      const device_id = str(req.body?.device_id, 80)
      if (!name) return bad(res, 400, 'need your name first')
      if (!device_id) return bad(res, 400, 'Missing device id')
      const existing = await store.getGuest(name)
      if (existing && !req.body?.takeover) return res.status(409).json({ error: 'name_taken', name: existing.name })
      const g = existing ? await store.updateGuest(name, { device_id }) : await store.createGuest({ name, device_id })
      res.status(existing ? 200 : 201).json(publicGuest(g))
    } catch (e) { next(e) }
  })

  app.get('/api/guests/me', async (req, res, next) => {
    try {
      const name = str(req.query.name)
      if (!name) return bad(res, 400, 'Missing name')
      const g = await store.getGuest(name)
      if (!g) return bad(res, 404, 'Guest not found')
      res.json(publicGuest(g))
    } catch (e) { next(e) }
  })

  app.put('/api/guests/me', async (req, res, next) => {
    try {
      const name = str(req.body?.name)
      if (!name) return bad(res, 400, 'Missing name')
      const patch = {}
      if ('prefs' in (req.body || {})) patch.prefs = req.body.prefs === null ? null : normalisePrefs(req.body.prefs)
      if ('favourite' in (req.body || {})) {
        const f = req.body.favourite
        patch.favourite = f && typeof f === 'object' && typeof f.drink_id === 'string'
          ? { drink_id: str(f.drink_id, 80), mixer: f.mixer ? str(f.mixer, 30) : null, strength: STRENGTHS.includes(f.strength) ? f.strength : null }
          : null
      }
      if (!Object.keys(patch).length) return bad(res, 400, 'Nothing to change')
      const g = await store.updateGuest(name, patch)
      if (!g) return bad(res, 404, 'Guest not found')
      res.json(publicGuest(g))
    } catch (e) { next(e) }
  })

  app.get('/api/menu', async (_req, res, next) => {
    try { res.json(await menuPayload()) } catch (e) { next(e) }
  })

  app.post('/api/orders', async (req, res, next) => {
    try {
      const guest_name = str(req.body?.guest_name)
      const device_id = str(req.body?.device_id, 80)
      if (!guest_name) return bad(res, 400, 'need your name first')
      if (!device_id) return bad(res, 400, 'Missing device id')
      const settings = await store.getSettings()
      if (!settings.ordering_open) return bad(res, 409, "bar's taking a breather, try again in a few")
      const { items, error } = await resolveItems(req.body?.items, { requireAvailable: true, prefs: normalisePrefs(req.body?.prefs) })
      if (error) return bad(res, 400, error)
      const order = await store.createOrder({ guest_name, device_id, items })
      res.status(201).json(order)
    } catch (e) { next(e) }
  })

  app.get('/api/orders/mine', async (req, res, next) => {
    try {
      const guest_name = str(req.query.name)
      const device_id = str(req.query.device_id, 80)
      if (!guest_name && !device_id) return bad(res, 400, 'Missing name')
      const orders = await store.listOrders(guest_name ? { guest_name } : { device_id })
      res.json({ orders: orders.slice(-20).reverse() })
    } catch (e) { next(e) }
  })

  // ---- Bartender routes (shared PIN in x-bar-pin header) ----

  const bar = express.Router()
  bar.use((req, res, next) => {
    const pin = req.get('x-bar-pin') || ''
    if (!barPin || pin !== barPin) return bad(res, 401, 'Wrong PIN')
    next()
  })

  bar.post('/login', (_req, res) => res.json({ ok: true }))

  bar.get('/orders', async (req, res, next) => {
    try {
      const all = req.query.all === '1'
      const [orders, settings, tally] = await Promise.all([
        store.listOrders(all ? {} : { statuses: OPEN_STATUSES }),
        store.getSettings(),
        store.drinkTally(),
      ])
      res.json({ orders, settings, tally, now: new Date().toISOString() })
    } catch (e) { next(e) }
  })

  // Verbal order: bartender types it in on a guest's behalf. Ignores ordering_open
  // and availability so the bar can always record what it is actually making.
  bar.post('/orders', async (req, res, next) => {
    try {
      const guest_name = str(req.body?.guest_name)
      const placed_by = str(req.body?.placed_by)
      if (!guest_name) return bad(res, 400, 'Whose drink is it?')
      if (!placed_by) return bad(res, 400, 'Missing bartender name')
      const { items, error } = await resolveItems(req.body?.items, { requireAvailable: false })
      if (error) return bad(res, 400, error)
      const order = await store.createOrder({ guest_name, placed_by, items })
      res.status(201).json(order)
    } catch (e) { next(e) }
  })

  bar.patch('/orders/:id', async (req, res, next) => {
    try {
      const existing = await store.getOrder(req.params.id)
      if (!existing) return bad(res, 404, 'Order not found')
      const by = str(req.body?.by)
      const action = str(req.body?.action, 20)
      const patch = {}
      switch (action) {
        case 'claim':
          if (existing.claimed_by && existing.claimed_by !== by && existing.status !== 'new') {
            return bad(res, 409, `${existing.claimed_by} already has this one`)
          }
          patch.claimed_by = by
          patch.status = 'making'
          break
        case 'unclaim':
          patch.claimed_by = null
          patch.status = 'new'
          break
        case 'ready':
          patch.status = 'ready'
          if (!existing.claimed_by) patch.claimed_by = by
          break
        case 'delivered':
          patch.status = 'delivered'
          if (!existing.claimed_by) patch.claimed_by = by
          break
        case 'cancel':
          patch.status = 'cancelled'
          break
        case 'reopen':
          patch.status = existing.claimed_by ? 'making' : 'new'
          break
        default:
          return bad(res, 400, 'Unknown action')
      }
      if (!ORDER_STATUSES.includes(patch.status)) return bad(res, 400, 'Bad status')
      res.json(await store.updateOrder(existing.id, patch))
    } catch (e) { next(e) }
  })

  bar.post('/drinks', async (req, res, next) => {
    try {
      const name = str(req.body?.name)
      if (!name) return bad(res, 400, 'Drink needs a name')
      const drink = await store.addDrink({
        name,
        description: str(req.body?.description, 120),
        category: CATEGORIES.includes(req.body?.category) ? req.body.category : 'Cocktails',
        added_by: str(req.body?.added_by) || null,
        instructions: str(req.body?.instructions, 2000),
      })
      res.status(201).json(drink)
    } catch (e) { next(e) }
  })

  bar.patch('/drinks/:id', async (req, res, next) => {
    try {
      const patch = {}
      if (typeof req.body?.available === 'boolean') patch.available = req.body.available
      if (typeof req.body?.name === 'string' && str(req.body.name)) patch.name = str(req.body.name)
      if (typeof req.body?.description === 'string') patch.description = str(req.body.description, 120)
      if (typeof req.body?.instructions === 'string') patch.instructions = str(req.body.instructions, 2000)
      if (!Object.keys(patch).length) return bad(res, 400, 'Nothing to change')
      const drink = await store.updateDrink(req.params.id, patch)
      if (!drink) return bad(res, 404, 'Drink not found')
      res.json(drink)
    } catch (e) { next(e) }
  })

  bar.delete('/drinks/:id', async (req, res, next) => {
    try {
      const ok = await store.deleteDrink(req.params.id)
      if (!ok) return bad(res, 404, 'Drink not found')
      res.json({ ok: true })
    } catch (e) { next(e) }
  })

  bar.patch('/settings', async (req, res, next) => {
    try {
      const patch = {}
      for (const k of ['ordering_open', 'last_orders']) {
        if (typeof req.body?.[k] === 'boolean') patch[k] = req.body[k]
      }
      if (!Object.keys(patch).length) return bad(res, 400, 'Nothing to change')
      res.json(await store.setSettings(patch))
    } catch (e) { next(e) }
  })

  app.use('/api/bar', bar)

  app.use('/api', (_req, res) => bad(res, 404, 'Not found'))
  app.use((err, _req, res, _next) => {
    console.error(err)
    bad(res, err.status || 500, err.status ? err.message : 'Something went wrong')
  })
  return app
}

// ---- Vercel entrypoint ----
let appPromise = null
function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const barPin = process.env.BAR_PIN || (process.env.VERCEL ? '' : '1234')
      if (!barPin) console.error('[api] BAR_PIN is not set: every bartender request will be rejected')
      return buildApp(await storeFromEnv(), { barPin })
    })()
  }
  return appPromise
}

export default async function handler(req, res) {
  const app = await getApp()
  return app(req, res)
}
