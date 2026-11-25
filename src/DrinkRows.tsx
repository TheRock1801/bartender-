import { useState, type ReactNode } from 'react'
import type { Drink, Strength } from './api'
import { BackArrow, Check } from './art'
import { cartKey, drinkQty, itemLabel, type Cart } from './cart'

// One tab's worth of drinks. A spirit row has a "Choose" button that opens the mixer
// page (MixerSheet); every other row is Add, then − n +. Shared by the guest menu and
// the bartender's verbal-order screen.
export function DrinkRows({ drinks, cart, onBump, onChoose, isSpirit, canOrder, compact }: {
  drinks: Drink[]
  cart: Cart
  onBump: (drink_id: string, mixer: string | null, delta: number, strength: Strength | null) => void
  onChoose: (drink: Drink) => void
  isSpirit: boolean
  canOrder: (d: Drink) => boolean
  compact?: boolean
}) {
  if (!drinks.length) return <p className="font-mono text-sm text-cocoa/60 px-1 py-4">nothing here yet.</p>
  return (
    <div className="flex flex-col">
      {drinks.map((d) => {
        const off = !canOrder(d)
        const total = drinkQty(cart, d.id)
        return (
          <div key={d.id} className={`row flex items-center gap-3 ${compact ? 'py-2.5' : 'py-4'} ${off ? 'opacity-60' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className={`font-semibold leading-tight ${compact ? '' : 'text-lg'}`}>{d.name}</div>
              {d.description && !compact && <div className="text-sm text-cocoa/60">{d.description}</div>}
              {!d.available && <span className="pill bg-sand/70 text-cocoa/80 mt-1">all gone, sorry</span>}
            </div>
            {off ? null : isSpirit ? (
              <button className={`btn-soft px-4 py-2 ${total > 0 ? '!bg-cocoa !text-cream' : ''}`} onClick={() => onChoose(d)}>
                {total > 0 ? `${total} added` : 'choose'}
              </button>
            ) : total === 0 ? (
              <button className="btn-soft px-5 py-2" onClick={() => onBump(d.id, null, 1, null)}>add</button>
            ) : (
              <Stepper qty={total} onDelta={(n) => onBump(d.id, null, n, null)} label={d.name} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function Stepper({ qty, onDelta, label }: { qty: number; onDelta: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <button className="step-btn" onClick={() => onDelta(-1)} aria-label={`One fewer ${label}`}>−</button>
      <span className="w-6 text-center text-lg font-semibold">{qty}</span>
      <button className="step-btn" onClick={() => onDelta(1)} aria-label={`One more ${label}`}>+</button>
    </div>
  )
}

// Full-screen "Bourbon — Choose your mixer" page: a radio list, a free-text "Other",
// an optional pour, then "Add to order".
export function MixerSheet({ drink, mixers, otherMixer, strengths, cart, onAdd, onClose }: {
  drink: Drink
  mixers: string[]
  otherMixer: string
  strengths: Strength[]
  cart: Cart
  onAdd: (mixer: string, strength: Strength | null) => void
  onClose: () => void
}) {
  const [mixer, setMixer] = useState<string | null>(null)   // one of mixers, or "Other"
  const [other, setOther] = useState('')
  const [strength, setStrength] = useState<Strength | null>(null)

  const chosen = mixer === otherMixer ? (other.trim() ? `Other: ${other.trim().slice(0, 40)}` : null) : mixer
  const inCart = chosen ? cart[cartKey(drink.id, chosen, strength)]?.qty || 0 : 0

  return (
    <div className="fixed inset-0 z-30 bg-cream overflow-y-auto" role="dialog" aria-modal="true" aria-label={`${drink.name}: choose your mixer`}>
      <main className="min-h-dvh max-w-lg mx-auto px-6 pt-4 pb-36">
        <BackArrow onClick={onClose} />
        <div className="mt-2">
          <p className="eyebrow">{drink.category}</p>
          <h2 className="display text-[2.5rem] mt-2">{drink.name}.</h2>
          <p className="font-mono text-xs text-cocoa/60 mt-2">what do you want with it?</p>
        </div>

        <div className="mt-5 divider flex flex-col" role="radiogroup">
          {mixers.map((m) => (
            <MixerRow key={m} title={m} selected={mixer === m} onPick={() => setMixer(m)} />
          ))}
          <MixerRow title={otherMixer} sub="tell us what" selected={mixer === otherMixer} onPick={() => setMixer(otherMixer)} />
          {mixer === otherMixer && (
            <input
              className="input fade-up mt-3"
              autoFocus
              placeholder="what would you like with it?"
              value={other}
              maxLength={40}
              onChange={(e) => setOther(e.target.value)}
            />
          )}
        </div>

        {strengths.length > 0 && (
          <div className="mt-6 divider pt-5">
            <p className="label mb-2">pour</p>
            <div className="flex gap-2">
              {([null, ...strengths] as (Strength | null)[]).map((st) => (
                <button key={st ?? 'regular'} onClick={() => setStrength(st)} className={`rounded border px-3 py-1.5 font-mono text-xs lowercase ${strength === st ? 'bg-amber text-cream border-amber' : 'border-taupe/60 text-cocoa'}`} aria-pressed={strength === st}>
                  {st ?? 'regular'}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 p-4 bg-gradient-to-t from-cream via-cream to-transparent">
        <div className="max-w-lg mx-auto">
          <button className="btn-primary w-full text-lg" disabled={!chosen} onClick={() => chosen && onAdd(chosen, strength)}>
            {chosen ? `add ${itemLabel(drink.name, chosen, strength).toLowerCase()}` : 'pick a mixer'}
          </button>
          {inCart > 0 && <p className="text-center font-mono text-xs text-cocoa/60 mt-2">{inCart} already in your order</p>}
        </div>
      </div>
    </div>
  )
}

// One radio row on the mixer list.
function MixerRow({ title, sub, selected, onPick, children }: { title: string; sub?: string; selected: boolean; onPick: () => void; children?: ReactNode }) {
  return (
    <div
      onClick={onPick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick() } }}
      className="row w-full text-left py-3.5 cursor-pointer select-none"
      role="radio"
      aria-checked={selected}
      tabIndex={0}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className={`text-lg ${selected ? 'font-semibold' : ''}`}>{title}</div>
          {sub && <div className="font-mono text-xs text-cocoa/60">{sub}</div>}
        </div>
        <span className={`ring-radio ${selected ? 'bg-cocoa border-cocoa text-cream' : ''}`}>{selected && <Check />}</span>
      </div>
      {children}
    </div>
  )
}

// What's in the order so far, with − / + on each line. Used on the guest's order page
// and inline on the bartender's verbal-order screen.
export function CartSummary({ cart, drinks, onBump }: {
  cart: Cart
  drinks: Drink[]
  onBump: (drink_id: string, mixer: string | null, delta: number, strength: Strength | null) => void
}) {
  const lines = Object.values(cart).filter((l) => l.qty > 0)
  if (!lines.length) return <p className="font-mono text-sm text-cocoa/60 py-3">nothing in here yet.</p>
  const nameOf = (id: string) => drinks.find((d) => d.id === id)?.name ?? 'Drink'
  return (
    <ul className="flex flex-col">
      {lines.map((l) => (
        <li key={cartKey(l.drink_id, l.mixer, l.strength)} className="row flex items-center gap-2">
          <span className="flex-1 font-semibold">{itemLabel(nameOf(l.drink_id), l.mixer, l.strength)}</span>
          <Stepper qty={l.qty} onDelta={(n) => onBump(l.drink_id, l.mixer, n, l.strength)} label={nameOf(l.drink_id)} />
        </li>
      ))}
    </ul>
  )
}
