import type { CartLine, Drink } from './api'

// A cart line is a drink plus, for spirits, what it comes with. The same spirit
// with two different mixers is two lines.
export type Cart = Record<string, { drink_id: string; mixer: string | null; qty: number }>

export const cartKey = (drink_id: string, mixer: string | null) => `${drink_id}|${mixer ?? ''}`

export function bumpCart(cart: Cart, drink_id: string, mixer: string | null, delta: number): Cart {
  const key = cartKey(drink_id, mixer)
  const qty = Math.max(0, Math.min(10, (cart[key]?.qty || 0) + delta))
  const next = { ...cart }
  if (qty === 0) delete next[key]
  else next[key] = { drink_id, mixer, qty }
  return next
}

export function cartLines(cart: Cart): CartLine[] {
  return Object.values(cart).filter((l) => l.qty > 0).map(({ drink_id, mixer, qty }) => ({ drink_id, mixer, qty }))
}

export const cartCount = (cart: Cart) => Object.values(cart).reduce((n, l) => n + l.qty, 0)

// Quantity of one drink across all its mixers.
export const drinkQty = (cart: Cart, drink_id: string) =>
  Object.values(cart).filter((l) => l.drink_id === drink_id).reduce((n, l) => n + l.qty, 0)

// "Bourbon on the rocks", "Bourbon & Coke", or just the name.
export function itemLabel(name: string, mixer: string | null | undefined): string {
  if (!mixer) return name
  if (mixer === 'Rocks') return `${name} on the rocks`
  return `${name} & ${mixer}`
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
