import { useState, type ReactNode } from 'react'
import type { Drink, Strength } from './api'
import { BackArrow, Check, Glass } from './art'
import { cartKey, drinkQty, isJuice, itemLabel, type Cart } from './cart'

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
  if (!drinks.length) return <p className="text-sm text-stone px-1 py-4">Nothing here yet.</p>
  return (
    <div className="flex flex-col">
      {drinks.map((d) => {
        const off = !canOrder(d)
        const total = drinkQty(cart, d.id)
        return (
          <div key={d.id} className={`row flex items-center gap-4 ${compact ? 'py-2.5' : ''} ${off ? 'opacity-60' : ''}`}>
            <Glass name={d.name} size={compact ? 40 : 60} />
            <div className="flex-1 min-w-0">
              <div className={`display ${compact ? 'text-xl' : 'text-2xl'}`}>{d.name}</div>
              {d.description && !compact && <div className="text-sm text-stone">{d.description}</div>}
              {!d.available && <span className="pill bg-sand text-stone mt-1">Run out, sorry</span>}
            </div>
            {off ? null : isSpirit ? (
              <button className="btn-soft px-5 py-2.5" onClick={() => onChoose(d)}>
                {total > 0 ? `${total} added` : 'Choose'}
              </button>
            ) : total === 0 ? (
              <button className="btn-soft px-6 py-2.5" onClick={() => onBump(d.id, null, 1, null)}>Add</button>
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
      <span className="w-5 text-center text-base">{qty}</span>
      <button className="step-btn" onClick={() => onDelta(1)} aria-label={`One more ${label}`}>+</button>
    </div>
  )
}

// Full-screen "Bourbon — Choose your mixer" page: a radio list, juice flavours under
// "Juice", a free-text "Other", an optional pour, then "Add to order".
export function MixerSheet({ drink, mixers, otherMixer, strengths, cart, onAdd, onClose }: {
  drink: Drink
  mixers: string[]
  otherMixer: string
  strengths: Strength[]
  cart: Cart
  onAdd: (mixer: string, strength: Strength | null) => void
  onClose: () => void
}) {
  const plain = mixers.filter((m) => !isJuice(m))
  const juices = mixers.filter(isJuice)
  const [mixer, setMixer] = useState<string | null>(null)   // one of mixers, or "Other"
  const [juice, setJuice] = useState<string | null>(null)
  const [other, setOther] = useState('')
  const [strength, setStrength] = useState<Strength | null>(null)

  const chosen = mixer === 'Juice' ? juice : mixer === otherMixer ? (other.trim() ? `Other: ${other.trim().slice(0, 40)}` : null) : mixer
  const inCart = chosen ? cart[cartKey(drink.id, chosen, strength)]?.qty || 0 : 0

  return (
    <div className="fixed inset-0 z-30 bg-cream overflow-y-auto" role="dialog" aria-modal="true" aria-label={`${drink.name}: choose your mixer`}>
      <main className="min-h-dvh max-w-lg mx-auto px-5 pt-3 pb-36">
        <BackArrow onClick={onClose} />
        <div className="text-center mt-2">
          <Glass name={drink.name} size={96} className="mx-auto" />
          <h2 className="display text-4xl mt-3">{drink.name}</h2>
          <p className="text-stone mt-1">Choose your mixer</p>
        </div>

        <div className="mt-6 flex flex-col gap-2" role="radiogroup">
          {plain.map((m) => (
            <MixerRow key={m} title={m} selected={mixer === m} onPick={() => setMixer(m)} />
          ))}
          {juices.length > 0 && (
            <>
              <MixerRow title="Juice" sub={mixer === 'Juice' && juice ? juice.replace(/\s*juice$/i, '') : 'Pick a flavour'} selected={mixer === 'Juice' && !!juice} onPick={() => { setMixer('Juice'); if (!juice) setJuice(juices[0]) }}>
                <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Juice flavour">
                  {juices.map((j) => {
                    const on = mixer === 'Juice' && juice === j
                    return (
                      <button
                        key={j}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setMixer('Juice'); setJuice(j) }}
                        className={`rounded-lg border px-3.5 py-2 text-sm ${on ? 'bg-amber text-ivory border-amber' : 'border-cocoa/30 text-cocoa'}`}
                        aria-pressed={on}
                      >
                        {j.replace(/\s*juice$/i, '')}
                      </button>
                    )
                  })}
                </div>
              </MixerRow>
            </>
          )}
          <MixerRow title={otherMixer} sub="Let us know" selected={mixer === otherMixer} onPick={() => setMixer(otherMixer)} />
          {mixer === otherMixer && (
            <input
              className="input fade-up"
              autoFocus
              placeholder="What would you like with it?"
              value={other}
              maxLength={40}
              onChange={(e) => setOther(e.target.value)}
            />
          )}
        </div>

        {strengths.length > 0 && (
          <div className="mt-6">
            <p className="label mb-2">Pour</p>
            <div className="flex gap-2">
              {([null, ...strengths] as (Strength | null)[]).map((st) => (
                <button key={st ?? 'regular'} onClick={() => setStrength(st)} className={`rounded-lg border px-4 py-2 text-sm capitalize ${strength === st ? 'bg-espresso text-ivory border-espresso' : 'border-cocoa/30 text-cocoa'}`} aria-pressed={strength === st}>
                  {st ?? 'Regular'}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 p-4 bg-gradient-to-t from-cream via-cream to-transparent">
        <div className="max-w-lg mx-auto">
          <button className="btn-primary w-full text-lg" disabled={!chosen} onClick={() => chosen && onAdd(chosen, strength)}>
            {chosen ? `Add ${itemLabel(drink.name, chosen, strength)}` : 'Add to order'}
            <span className="ml-2" aria-hidden="true">›</span>
          </button>
          {inCart > 0 && <p className="text-center text-xs text-stone mt-2">{inCart} already in your order</p>}
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
      className="card w-full text-left py-4 cursor-pointer select-none"
      role="radio"
      aria-checked={selected}
      tabIndex={0}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-base text-espresso">{title}</div>
          {sub && <div className="text-sm text-stone">{sub}</div>}
        </div>
        <span className={`ring-radio ${selected ? 'bg-amber border-amber text-ivory' : ''}`}>{selected && <Check />}</span>
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
  if (!lines.length) return <p className="text-sm text-stone">Nothing in your order yet.</p>
  const nameOf = (id: string) => drinks.find((d) => d.id === id)?.name ?? 'Drink'
  return (
    <ul className="flex flex-col gap-2">
      {lines.map((l) => (
        <li key={cartKey(l.drink_id, l.mixer, l.strength)} className="card flex items-center gap-3 py-3">
          <Glass name={nameOf(l.drink_id)} size={40} />
          <span className="flex-1 text-base text-espresso">{itemLabel(nameOf(l.drink_id), l.mixer, l.strength)}</span>
          <Stepper qty={l.qty} onDelta={(n) => onBump(l.drink_id, l.mixer, n, l.strength)} label={nameOf(l.drink_id)} />
        </li>
      ))}
    </ul>
  )
}
