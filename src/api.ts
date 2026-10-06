export type Drink = {
  id: string
  name: string
  description: string
  category: string
  available: boolean
  sort: number
  added_by: string | null
  instructions: string
}

export type Strength = 'light' | 'stiff'
export type OrderItem = { id: string; drink_id: string | null; drink_name: string; mixer: string | null; strength: Strength | null; qty: number }

export type OrderStatus = 'new' | 'making' | 'ready' | 'delivered' | 'cancelled'

export type Order = {
  id: string
  guest_name: string
  device_id: string | null
  placed_by: string | null
  status: OrderStatus
  claimed_by: string | null
  created_at: string
  updated_at: string
  items: OrderItem[]
}

export type Settings = { ordering_open: boolean; last_orders: boolean }

// drink id -> how many ordered tonight (cancelled orders excluded)
export type Tally = Record<string, number>

export type CartLine = { drink_id: string; mixer?: string | null; strength?: Strength | null; qty: number }

// Flavour preferences, set once per phone. fat = regular, skinny = diet.
export type Prefs = { coke: 'fat' | 'skinny'; lemonade: 'fat' | 'skinny'; water: 'still' | 'sparkling' }
export type PrefKey = keyof Prefs

// A guest's pinned favourite. mixer is the BASE mixer (Coke, not Skinny Coke).
export type Favourite = { drink_id: string; mixer: string | null; strength: Strength | null }

export type MenuPayload = {
  drinks: Drink[]
  settings: Settings
  categories: string[]       // tab order
  spirits_category: string   // drinks in this category are ordered as spirit + mixer
  mixers: string[]            // base mixers a guest picks from
  mixer_variants: string[]    // every stored mixer value; bartenders pick from these
  pref_options: Record<PrefKey, string[]>
  default_prefs: Prefs
  strengths: Strength[]       // light/stiff choice, spirits only
}

async function req<T>(path: string, init: RequestInit = {}, pin?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) }
  if (pin) headers['x-bar-pin'] = pin
  const res = await fetch(path, { ...init, headers })
  let body: unknown = null
  try { body = await res.json() } catch { /* no body */ }
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error || `Request failed (${res.status})`
    const err = new Error(msg) as Error & { status: number }
    err.status = res.status
    throw err
  }
  return body as T
}

const json = (data: unknown) => JSON.stringify(data)

export const api = {
  menu: () => req<MenuPayload>('/api/menu'),
  placeOrder: (guest_name: string, device_id: string, items: CartLine[], prefs: Partial<Prefs>) =>
    req<Order>('/api/orders', { method: 'POST', body: json({ guest_name, device_id, items, prefs }) }),
  myOrders: (device_id: string) =>
    req<{ orders: Order[] }>(`/api/orders/mine?device_id=${encodeURIComponent(device_id)}`),

  bar: {
    login: (pin: string) => req<{ ok: true }>('/api/bar/login', { method: 'POST' }, pin),
    orders: (pin: string, all = false) =>
      req<{ orders: Order[]; settings: Settings; tally: Tally; now: string }>(`/api/bar/orders${all ? '?all=1' : ''}`, {}, pin),
    placeOrder: (pin: string, guest_name: string, placed_by: string, items: CartLine[]) =>
      req<Order>('/api/bar/orders', { method: 'POST', body: json({ guest_name, placed_by, items }) }, pin),
    act: (pin: string, id: string, action: string, by: string) =>
      req<Order>(`/api/bar/orders/${id}`, { method: 'PATCH', body: json({ action, by }) }, pin),
    addDrink: (pin: string, drink: { name: string; description: string; category: string; added_by: string; instructions: string }) =>
      req<Drink>('/api/bar/drinks', { method: 'POST', body: json(drink) }, pin),
    updateDrink: (pin: string, id: string, patch: Partial<Pick<Drink, 'available' | 'name' | 'description' | 'instructions'>>) =>
      req<Drink>(`/api/bar/drinks/${id}`, { method: 'PATCH', body: json(patch) }, pin),
    removeDrink: (pin: string, id: string) =>
      req<{ ok: true }>(`/api/bar/drinks/${id}`, { method: 'DELETE' }, pin),
    settings: (pin: string, patch: Partial<Settings>) =>
      req<Settings>('/api/bar/settings', { method: 'PATCH', body: json(patch) }, pin),
  },
}

export function deviceId(): string {
  const key = 'aj_device_id'
  try {
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return 'no-storage'
  }
}

export function storedJson<T>(key: string): T | null {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null } catch { return null }
}
export function storeJson(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch { /* ignore */ }
}

export function stored(key: string): string {
  try { return localStorage.getItem(key) || '' } catch { return '' }
}
export function store(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch { /* ignore */ }
}

export function minutesAgo(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
}

export function groupByCategory(drinks: Drink[]): [string, Drink[]][] {
  const map = new Map<string, Drink[]>()
  for (const d of drinks) {
    if (!map.has(d.category)) map.set(d.category, [])
    map.get(d.category)!.push(d)
  }
  return [...map.entries()]
}
