// All API routes. Deployed as one Vercel function (see vercel.json rewrite);
// also mounted by server.js for local dev.

import express from 'express'
import { storeFromEnv, OPEN_STATUSES, ORDER_STATUSES, CATEGORIES, SPIRITS_CATEGORY, MIXERS, OTHER_MIXER, isValidMixer, STRENGTHS, FULFILMENTS } from '../lib/store.js'

export function buildApp(store, { barPin }) {
  const app = express()
  app.use(express.json({ limit: '50kb' }))

  const bad = (res, status, error) => res.status(status).json({ error })
  const str = (v, max = 60) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

  async function menuPayload() {
    const [drinks, settings] = await Promise.all([store.listDrinks(), store.getSettings()])
    return {
      drinks, settings,
      categories: CATEGORIES, spirits_category: SPIRITS_CATEGORY,
      mixers: MIXERS, other_mixer: OTHER_MIXER, strengths: STRENGTHS, fulfilments: FULFILMENTS,
    }
  }

  // Normalise a submitted items list against the current menu. Returns {items} or {error}.
  // A spirit needs a mixer (one of MIXERS, or "Other: <what they typed>"); nothing else takes one.
  async function resolveItems(rawItems, { requireAvailable }) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) return { error: 'Pick a drink first' }
    const drinks = await store.listDrinks()
    const byId = new Map(drinks.map((d) => [d.id, d]))
    const merged = new Map()
    for (const it of rawItems) {
      const d = byId.get(it?.drink_id)
      if (!d) return { error: 'One of those just came off the menu, sorry' }
      if (requireAvailable && !d.available) return { error: `${d.name} has run out, sorry` }
      const qty = Math.min(10, Math.max(1, Math.floor(Number(it.qty) || 1)))
      let mixer = null
      if (d.category === SPIRITS_CATEGORY) {
        mixer = str(it.mixer, 48).replace(/\s+/g, ' ')
        if (!isValidMixer(mixer)) return { error: `What would you like with your ${d.name}?` }
      } else if (it.mixer) {
        return { error: `${d.name} doesn't take a mixer` }
      }
      let strength = null
      if (it.strength) {
        strength = str(it.strength, 10).toLowerCase()
        if (!STRENGTHS.includes(strength)) return { error: 'Pour is regular or light' }
        if (d.category !== SPIRITS_CATEGORY) return { error: 'A light pour is just for spirits' }
      }
      const key = d.id + '|' + (mixer || '') + '|' + (strength || '')
      merged.set(key, { drink_id: d.id, drink_name: d.name, mixer, strength, qty: (merged.get(key)?.qty || 0) + qty })
    }
    return { items: [...merged.values()] }
  }

  // Collect from the bar (default) or deliver to a table, which needs a table number.
  function resolveFulfilment(body) {
    const fulfilment = str(body?.fulfilment, 10).toLowerCase() || 'collect'
    if (!FULFILMENTS.includes(fulfilment)) return { error: 'Collect from the bar, or deliver to your table?' }
    const table_no = str(body?.table_no, 12)
    if (fulfilment === 'deliver' && !table_no) return { error: 'Which table are you at?' }
    return { fulfilment, table_no: fulfilment === 'deliver' ? table_no : null }
  }

  // ---- Guest routes (no auth) ----

  app.get('/api/menu', async (_req, res, next) => {
    try { res.json(await menuPayload()) } catch (e) { next(e) }
  })

  app.post('/api/orders', async (req, res, next) => {
    try {
      const guest_name = str(req.body?.guest_name)
      const device_id = str(req.body?.device_id, 80)
      if (!guest_name) return bad(res, 400, 'Pop your name in first')
      if (!device_id) return bad(res, 400, 'Missing device id')
      const settings = await store.getSettings()
      if (!settings.ordering_open) return bad(res, 409, "The bar's taking a short break, try again in a few minutes")
      const f = resolveFulfilment(req.body)
      if (f.error) return bad(res, 400, f.error)
      const { items, error } = await resolveItems(req.body?.items, { requireAvailable: true })
      if (error) return bad(res, 400, error)
      const order = await store.createOrder({ guest_name, device_id, fulfilment: f.fulfilment, table_no: f.table_no, items })
      res.status(201).json(order)
    } catch (e) { next(e) }
  })

  app.get('/api/orders/mine', async (req, res, next) => {
    try {
      const device_id = str(req.query.device_id, 80)
      if (!device_id) return bad(res, 400, 'Missing device id')
      const orders = await store.listOrders({ device_id })
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
      if (!guest_name) return bad(res, 400, 'Whose drink is it?')
      const f = resolveFulfilment(req.body)
      if (f.error) return bad(res, 400, f.error)
      const { items, error } = await resolveItems(req.body?.items, { requireAvailable: false })
      if (error) return bad(res, 400, error)
      // placed_by marks it as typed in at the bar rather than ordered from a phone.
      const order = await store.createOrder({ guest_name, placed_by: 'Bar', fulfilment: f.fulfilment, table_no: f.table_no, items })
      res.status(201).json(order)
    } catch (e) { next(e) }
  })

  bar.patch('/orders/:id', async (req, res, next) => {
    try {
      const existing = await store.getOrder(req.params.id)
      if (!existing) return bad(res, 404, 'Order not found')
      // No bartender identities: the bar is one shared PIN, so the actions just move the status.
      // start = someone's making it (Preparing), made = done (there is no separate "delivered"
      // step: made it means it's at the bar or on its way), putback = back to New.
      const action = str(req.body?.action, 20)
      const patch = {}
      switch (action) {
        case 'start':
          patch.status = 'making'
          break
        case 'putback':
          patch.status = 'new'
          break
        case 'made':
          patch.status = 'delivered'
          break
        case 'cancel':
          patch.status = 'cancelled'
          break
        case 'reopen':
          patch.status = 'making'
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
