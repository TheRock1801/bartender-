import type { CartLine, Drink, Prefs, Strength } from './api'

// A cart line is a drink plus, for spirits, what it comes with. The same spirit
// with two different mixers is two lines.
export type Cart = Record<string, { drink_id: string; mixer: string | null; strength: Strength | null; qty: number }>

export const cartKey = (drink_id: string, mixer: string | null, strength: Strength | null = null) =>
  `${drink_id}|${mixer ?? ''}|${strength ?? ''}`

export function bumpCart(cart: Cart, drink_id: string, mixer: string | null, delta: number, strength: Strength | null = null): Cart {
  const key = cartKey(drink_id, mixer, strength)
  const qty = Math.max(0, Math.min(10, (cart[key]?.qty || 0) + delta))
  const next = { ...cart }
  if (qty === 0) delete next[key]
  else next[key] = { drink_id, mixer, strength, qty }
  return next
}

// One strength per spirit: re-keys every line of that spirit to the new strength.
export function setStrength(cart: Cart, drink_id: string, strength: Strength | null): Cart {
  const next: Cart = {}
  for (const l of Object.values(cart)) {
    const s = l.drink_id === drink_id ? strength : l.strength
    const key = cartKey(l.drink_id, l.mixer, s)
    next[key] = { ...l, strength: s, qty: (next[key]?.qty || 0) + l.qty }
  }
  return next
}

// The strength currently chosen for a drink in the cart (null when none added or regular).
export const drinkStrength = (cart: Cart, drink_id: string): Strength | null =>
  Object.values(cart).find((l) => l.drink_id === drink_id)?.strength ?? null

export function cartLines(cart: Cart): CartLine[] {
  return Object.values(cart).filter((l) => l.qty > 0).map(({ drink_id, mixer, strength, qty }) => ({ drink_id, mixer, strength, qty }))
}

export const cartCount = (cart: Cart) => Object.values(cart).reduce((n, l) => n + l.qty, 0)

// Quantity of one drink across all its mixers.
export const drinkQty = (cart: Cart, drink_id: string) =>
  Object.values(cart).filter((l) => l.drink_id === drink_id).reduce((n, l) => n + l.qty, 0)

// Client copy of the server's resolveMixer (lib/store.js): Coke / Lemonade / Water
// become the exact pour according to the guest's flavour prefs. Keep the two in step.
export function resolveMixer(mixer: string | null, prefs: Partial<Prefs> | null | undefined): string | null {
  if (!mixer) return mixer
  const p = prefs ?? {}
  if (mixer === 'Coke') return p.coke === 'skinny' ? 'Skinny Coke' : 'Coke'
  if (mixer === 'Lemonade') return p.lemonade === 'skinny' ? 'Skinny Lemonade' : 'Lemonade'
  if (mixer === 'Water') return p.water === 'sparkling' ? 'Sparkling Water' : 'Still Water'
  return mixer
}

// "Bourbon on the rocks", "Bourbon & Skinny Coke, stiff", or just the name.
export function itemLabel(name: string, mixer: string | null | undefined, strength?: Strength | null): string {
  let s = name
  if (mixer === 'Rocks') s = `${name} on the rocks`
  else if (mixer) s = `${name} & ${mixer}`
  if (strength) s += `, ${strength}`
  return s
}

// Drinks grouped into the server's tab order; any unknown category is appended.
export function groupByTab(drinks: Drink[], categories: string[]): [string, Drink[]][] {
  const order = [...categories, ...drinks.map((d) => d.category).filter((c) => !categories.includes(c))]
  const out: [string, Drink[]][] = []
  for (const cat of [...new Set(order)]) {
    const list = drinks.filter((d) => d.category === cat)
    if (list.length || categories.includes(cat)) out.push([cat, list])
  }
  return out
}
