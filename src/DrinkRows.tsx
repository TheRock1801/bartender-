import { useState } from 'react'
import type { Drink, Strength } from './api'
import { cartKey, drinkQty, drinkStrength, type Cart } from './cart'

// One tab's worth of drinks with add/remove controls. Shared by the guest menu
// and the bartender's verbal-order screen. Spirits expand into mixer chips;
// everything else is a plain Add / − / + row.
export function DrinkRows({ drinks, cart, onBump, onStrength, isSpirit, mixers, strengths, canOrder, compact }: {
  drinks: Drink[]
  cart: Cart
  onBump: (drink_id: string, mixer: string | null, delta: number) => void
  onStrength: (drink_id: string, strength: Strength | null) => void
  isSpirit: boolean
  mixers: string[]
  strengths: Strength[]   // empty = no light/stiff choice on this tab (only spirits get one)
  canOrder: (d: Drink) => boolean
  compact?: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (!drinks.length) return <p className="text-cocoa/60 text-sm px-1">Nothing here yet.</p>
  return (
    <div className="flex flex-col">
      {drinks.map((d) => {
        const off = !canOrder(d)
        const total = drinkQty(cart, d.id)
        const open = isSpirit && openId === d.id
        const strength = drinkStrength(cart, d.id)
        const showStrength = strengths.length > 0 && !off
        return (
          <div key={d.id} className={`row ${compact ? 'py-2.5' : 'py-4'} ${off ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className={`font-semibold leading-tight ${compact ? '' : 'text-lg'}`}>{d.name}</div>
                {d.description && !compact && <div className="text-sm text-cocoa/60">{d.description}</div>}
                {!d.available && <span className="pill bg-sand/70 text-cocoa/80 mt-1">Run out, sorry</span>}
              </div>
              {off ? null : isSpirit ? (
                <button
                  className={`btn-soft px-4 py-2 ${open ? '!bg-cocoa !text-cream' : ''}`}
                  onClick={() => setOpenId(open ? null : d.id)}
                  aria-expanded={open}
                >
                  {total > 0 ? `${total} added` : 'choose'}
                </button>
              ) : total === 0 ? (
                <button className="btn-soft px-5 py-2" onClick={() => onBump(d.id, null, 1)}>add</button>
              ) : (
                <div className="flex items-center gap-1">
                  <button className="btn-soft w-11 h-11 !px-0 text-xl" onClick={() => onBump(d.id, null, -1)} aria-label="Fewer">−</button>
                  <span className="w-7 text-center text-lg font-semibold">{total}</span>
                  <button className="btn-soft w-11 h-11 !px-0 text-xl" onClick={() => onBump(d.id, null, 1)} aria-label="More">+</button>
                </div>
              )}
            </div>

            {showStrength && (
              <div className="mt-3 flex items-center gap-2">
                <span className="label mr-1">Pour</span>
                {strengths.map((st) => (
                  <button
                    key={st}
                    onClick={() => onStrength(d.id, strength === st ? null : st)}
                    className={`rounded border px-3 py-1.5 font-mono text-xs lowercase ${strength === st ? 'bg-amber text-cream border-amber' : 'border-taupe/60 text-cocoa'}`}
                    aria-pressed={strength === st}
                  >
                    {st}
                  </button>
                ))}
                {!strength && <span className="font-mono text-xs text-cocoa/50">regular</span>}
              </div>
            )}

            {open && (
              <div className="mt-3 pt-3 border-t border-taupe/30">
                <p className="label mb-2">{d.name} with…</p>
                <div className="flex flex-wrap gap-2">
                  {mixers.map((m) => {
                    const q = cart[cartKey(d.id, m, strength)]?.qty || 0
                    return (
                      <div key={m} className={`inline-flex items-center rounded border ${q ? 'bg-cocoa text-cream border-cocoa' : 'border-taupe/60'}`}>
                        <button className="pl-3 pr-2 py-2 font-mono text-xs lowercase" onClick={() => onBump(d.id, m, 1)}>
                          {m === 'Rocks' ? 'on the rocks' : m.toLowerCase()}{q > 0 && <span className="ml-1.5 opacity-80">×{q}</span>}
                        </button>
                        {q > 0 && (
                          <button className="pr-3 pl-1 py-2 text-base leading-none opacity-80" onClick={() => onBump(d.id, m, -1)} aria-label={`One fewer ${d.name} with ${m}`}>−</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Compact list of what's in the cart, with − / + on each line.
export function CartSummary({ cart, drinks, onBump, label }: {
  cart: Cart
  drinks: Drink[]
  onBump: (drink_id: string, mixer: string | null, delta: number) => void
  label: (name: string, mixer: string | null, strength: Strength | null) => string
}) {
  const lines = Object.values(cart).filter((l) => l.qty > 0)
  if (!lines.length) return null
  const nameOf = (id: string) => drinks.find((d) => d.id === id)?.name ?? 'Drink'
  return (
    <div className="card">
      <h3 className="label mb-2">your order</h3>
      <ul className="flex flex-col gap-1.5">
        {lines.map((l) => (
          <li key={cartKey(l.drink_id, l.mixer, l.strength)} className="flex items-center gap-2">
            <span className="flex-1 font-semibold">{label(nameOf(l.drink_id), l.mixer, l.strength)}</span>
            <button className="btn-soft w-9 h-9 !px-0" onClick={() => onBump(l.drink_id, l.mixer, -1)} aria-label="Fewer">−</button>
            <span className="w-6 text-center font-semibold">{l.qty}</span>
            <button className="btn-soft w-9 h-9 !px-0" onClick={() => onBump(l.drink_id, l.mixer, 1)} aria-label="More">+</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
