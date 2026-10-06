// Data access. Two implementations behind one interface:
//   - memoryStore(): in-process, seeded, used when SUPABASE_URL is unset (local dev/tests)
//   - supabaseStore(): real persistence via the service role key
// Every function returns plain objects; orders always carry an `items` array.

import { randomUUID } from 'node:crypto'

export const ORDER_STATUSES = ['new', 'making', 'ready', 'delivered', 'cancelled']
export const OPEN_STATUSES = ['new', 'making', 'ready']

// Menu tabs, in display order. A drink's category must be one of these to show
// on the guest menu; "Spirits" rows are ordered as spirit + mixer.
export const CATEGORIES = ['Spirits', 'Cocktails', 'Beer & Wine', 'Soft Drinks']
export const SPIRITS_CATEGORY = 'Spirits'
// What a spirit can be ordered with, as a guest picks it. "Rocks" means neat over ice.
// Coke and Lemonade are resolved by the guest's flavour preferences into the
// exact thing to pour (see resolveMixer); the order stores the resolved mixer.
export const MIXERS = ['Rocks', 'Coke', 'Lemonade', 'Juice & Lemonade', 'Water', 'Soda', 'Ginger Beer', 'Tonic']
// Flavour preferences a guest sets once on their phone. "fat" = regular, "skinny" = diet.
export const PREF_OPTIONS = { coke: ['fat', 'skinny'], lemonade: ['fat', 'skinny'] }
export const DEFAULT_PREFS = { coke: 'fat', lemonade: 'fat' }
export function normalisePrefs(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, options] of Object.entries(PREF_OPTIONS)) {
    if (typeof raw[k] === 'string' && options.includes(raw[k].toLowerCase())) out[k] = raw[k].toLowerCase()
  }
  return out
}
export function resolveMixer(mixer, prefs = {}) {
  const p = { ...DEFAULT_PREFS, ...normalisePrefs(prefs) }
  if (mixer === 'Coke') return p.coke === 'skinny' ? 'Skinny Coke' : 'Coke'
  if (mixer === 'Lemonade') return p.lemonade === 'skinny' ? 'Skinny Lemonade' : 'Lemonade'
  if (mixer === 'Juice & Lemonade') return p.lemonade === 'skinny' ? 'Juice & Skinny Lemonade' : 'Juice & Lemonade'
  return mixer
}
// Every value a stored mixer can take. Bartenders pick from this list directly.
export const MIXER_VARIANTS = ['Rocks', 'Coke', 'Skinny Coke', 'Lemonade', 'Skinny Lemonade', 'Juice & Lemonade', 'Juice & Skinny Lemonade', 'Water', 'Soda', 'Ginger Beer', 'Tonic']
// Pour strength on spirits. Null means a regular pour.
export const STRENGTHS = ['light', 'stiff']

const SEED_DRINKS = [
  { name: 'Whiskey Old Fashioned', description: 'Whiskey, sugar, bitters, orange', category: 'Cocktails', sort: 1 },
  { name: 'Limoncello Spritz', description: 'Limoncello, prosecco, soda', category: 'Cocktails', sort: 2 },
  { name: 'Paloma', description: 'Tequila, lime, grapefruit soda', category: 'Cocktails', sort: 3 },
  { name: 'Bourbon', description: '', category: 'Spirits', sort: 10 },
  { name: 'Vodka', description: '', category: 'Spirits', sort: 11 },
  { name: 'Gin', description: '', category: 'Spirits', sort: 12 },
  { name: 'Whisky', description: '', category: 'Spirits', sort: 13 },
  { name: 'Rum', description: '', category: 'Spirits', sort: 14 },
  { name: 'Dark rum', description: '', category: 'Spirits', sort: 15 },
  { name: 'Tequila', description: '', category: 'Spirits', sort: 16 },
  { name: 'Speights', description: '', category: 'Beer & Wine', sort: 20 },
  { name: 'Red wine', description: '', category: 'Beer & Wine', sort: 21 },
  { name: 'White wine', description: '', category: 'Beer & Wine', sort: 22 },
  { name: 'Sparkling wine', description: '', category: 'Beer & Wine', sort: 23 },
  { name: 'Juice & Lemonade', description: '', category: 'Soft Drinks', sort: 30 },
]
const DEFAULT_SETTINGS = { ordering_open: true, last_orders: false }

// Guests are keyed by their name, case- and space-insensitively. "Sam" and "sam " are one guest.
export const nameKey = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')

export function memoryStore() {
  const drinks = SEED_DRINKS.map((d) => ({
    id: randomUUID(), available: true, added_by: null, instructions: '', created_at: new Date().toISOString(), ...d,
  }))
  const orders = []
  const guests = []
  const settings = { ...DEFAULT_SETTINGS }
  const clone = (o) => JSON.parse(JSON.stringify(o))

  return {
    kind: 'memory',
    async getGuest(name) {
      const g = guests.find((x) => x.name_key === nameKey(name))
      return g ? clone(g) : null
    },
    async createGuest({ name, device_id }) {
      const now = new Date().toISOString()
      const g = { id: randomUUID(), name: name.trim(), name_key: nameKey(name), device_id, prefs: null, favourite: null, created_at: now, updated_at: now }
      guests.push(g)
      return clone(g)
    },
    async updateGuest(name, patch) {
      const g = guests.find((x) => x.name_key === nameKey(name))
      if (!g) return null
      Object.assign(g, patch, { updated_at: new Date().toISOString() })
      return clone(g)
    },
    async listDrinks() {
      return clone([...drinks].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)))
    },
    async addDrink({ name, description = '', category = 'Cocktails', added_by = null, instructions = '' }) {
      const sort = drinks.length ? Math.max(...drinks.map((d) => d.sort)) + 1 : 1
      const d = { id: randomUUID(), name, description, category, available: true, sort, added_by, instructions, created_at: new Date().toISOString() }
      drinks.push(d)
      return clone(d)
    },
    async updateDrink(id, patch) {
      const d = drinks.find((x) => x.id === id)
      if (!d) return null
      Object.assign(d, patch)
      return clone(d)
    },
    async deleteDrink(id) {
      const i = drinks.findIndex((x) => x.id === id)
      if (i < 0) return false
      drinks.splice(i, 1)
      for (const o of orders) for (const it of o.items) if (it.drink_id === id) it.drink_id = null
      return true
    },
    // How many of each drink has been ordered tonight (cancelled orders excluded), keyed by drink id.
    async drinkTally() {
      const tally = {}
      for (const o of orders) {
        if (o.status === 'cancelled') continue
        for (const it of o.items) if (it.drink_id) tally[it.drink_id] = (tally[it.drink_id] || 0) + it.qty
      }
      return tally
    },
    async getSettings() {
      return { ...settings }
    },
    async setSettings(patch) {
      Object.assign(settings, patch)
      return { ...settings }
    },
    async createOrder({ guest_name, device_id = null, placed_by = null, items }) {
      const now = new Date().toISOString()
      const o = {
        id: randomUUID(), guest_name, device_id, placed_by, status: 'new', claimed_by: null,
        created_at: now, updated_at: now,
        items: items.map((i) => ({ id: randomUUID(), drink_id: i.drink_id, drink_name: i.drink_name, mixer: i.mixer ?? null, strength: i.strength ?? null, qty: i.qty })),
      }
      orders.push(o)
      return clone(o)
    },
    async listOrders({ device_id, guest_name, statuses, since } = {}) {
      let rows = orders
      if (device_id) rows = rows.filter((o) => o.device_id === device_id)
      if (guest_name) rows = rows.filter((o) => nameKey(o.guest_name) === nameKey(guest_name))
      if (statuses) rows = rows.filter((o) => statuses.includes(o.status))
      if (since) rows = rows.filter((o) => o.updated_at >= since)
      return clone([...rows].sort((a, b) => a.created_at.localeCompare(b.created_at)))
    },
    async getOrder(id) {
      const o = orders.find((x) => x.id === id)
      return o ? clone(o) : null
    },
    async updateOrder(id, patch) {
      const o = orders.find((x) => x.id === id)
      if (!o) return null
      Object.assign(o, patch, { updated_at: new Date().toISOString() })
      return clone(o)
    },
  }
}

export function supabaseStore({ url, key, createClient }) {
  const sb = createClient(url, key, { auth: { persistSession: false } })
  const fail = (error) => {
    const e = new Error(error.message || 'supabase error')
    e.status = 502
    throw e
  }

  async function withItems(orderRows) {
    if (!orderRows.length) return []
    const ids = orderRows.map((o) => o.id)
    const { data, error } = await sb.from('order_items').select('*').in('order_id', ids)
    if (error) fail(error)
    const byOrder = new Map()
    for (const it of data) {
      if (!byOrder.has(it.order_id)) byOrder.set(it.order_id, [])
      byOrder.get(it.order_id).push(it)
    }
    return orderRows.map((o) => ({ ...o, items: byOrder.get(o.id) || [] }))
  }

  return {
    kind: 'supabase',
    async getGuest(name) {
      const { data, error } = await sb.from('guests').select('*').eq('name_key', nameKey(name)).maybeSingle()
      if (error) fail(error)
      return data
    },
    async createGuest({ name, device_id }) {
      const { data, error } = await sb.from('guests').insert({ name: name.trim(), name_key: nameKey(name), device_id }).select().single()
      if (error) fail(error)
      return data
    },
    async updateGuest(name, patch) {
      const { data, error } = await sb.from('guests').update({ ...patch, updated_at: new Date().toISOString() }).eq('name_key', nameKey(name)).select().maybeSingle()
      if (error) fail(error)
      return data
    },
    async listDrinks() {
      const { data, error } = await sb.from('drinks').select('*').order('sort').order('name')
      if (error) fail(error)
      return data
    },
    async addDrink({ name, description = '', category = 'Cocktails', added_by = null, instructions = '' }) {
      const { data: maxRow } = await sb.from('drinks').select('sort').order('sort', { ascending: false }).limit(1).maybeSingle()
      const sort = (maxRow?.sort ?? 0) + 1
      const { data, error } = await sb.from('drinks').insert({ name, description, category, added_by, instructions, sort }).select().single()
      if (error) fail(error)
      return data
    },
    async updateDrink(id, patch) {
      const { data, error } = await sb.from('drinks').update(patch).eq('id', id).select().maybeSingle()
      if (error) fail(error)
      return data
    },
    async deleteDrink(id) {
      // order_items.drink_id is "on delete set null", so past orders keep their drink_name.
      const { data, error } = await sb.from('drinks').delete().eq('id', id).select('id')
      if (error) fail(error)
      return data.length > 0
    },
    async drinkTally() {
      const { data, error } = await sb
        .from('order_items')
        .select('drink_id, qty, orders!inner(status)')
        .neq('orders.status', 'cancelled')
        .not('drink_id', 'is', null)
      if (error) fail(error)
      const tally = {}
      for (const it of data) tally[it.drink_id] = (tally[it.drink_id] || 0) + it.qty
      return tally
    },
    async getSettings() {
      const { data, error } = await sb.from('settings').select('*')
      if (error) fail(error)
      const out = { ...DEFAULT_SETTINGS }
      for (const row of data) out[row.key] = row.value
      return out
    },
    async setSettings(patch) {
      const rows = Object.entries(patch).map(([key, value]) => ({ key, value }))
      const { error } = await sb.from('settings').upsert(rows, { onConflict: 'key' })
      if (error) fail(error)
      return this.getSettings()
    },
    async createOrder({ guest_name, device_id = null, placed_by = null, items }) {
      const { data: order, error } = await sb.from('orders').insert({ guest_name, device_id, placed_by }).select().single()
      if (error) fail(error)
      const { data: its, error: e2 } = await sb
        .from('order_items')
        .insert(items.map((i) => ({ order_id: order.id, drink_id: i.drink_id, drink_name: i.drink_name, mixer: i.mixer ?? null, strength: i.strength ?? null, qty: i.qty })))
        .select()
      if (e2) fail(e2)
      return { ...order, items: its }
    },
    async listOrders({ device_id, guest_name, statuses, since } = {}) {
      let q = sb.from('orders').select('*').order('created_at')
      if (device_id) q = q.eq('device_id', device_id)
      if (guest_name) q = q.ilike('guest_name', nameKey(guest_name))
      if (statuses) q = q.in('status', statuses)
      if (since) q = q.gte('updated_at', since)
      const { data, error } = await q
      if (error) fail(error)
      return withItems(data)
    },
    async getOrder(id) {
      const { data, error } = await sb.from('orders').select('*').eq('id', id).maybeSingle()
      if (error) fail(error)
      if (!data) return null
      return (await withItems([data]))[0]
    },
    async updateOrder(id, patch) {
      const { data, error } = await sb
        .from('orders')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle()
      if (error) fail(error)
      if (!data) return null
      return (await withItems([data]))[0]
    },
  }
}

export async function storeFromEnv(env = process.env) {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = await import('@supabase/supabase-js')
    return supabaseStore({ url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY, createClient })
  }
  console.warn('[store] SUPABASE_URL not set, using in-memory store (data resets on restart)')
  return memoryStore()
}
