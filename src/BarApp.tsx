import { useEffect, useRef, useState } from 'react'
import { api, groupByCategory, minutesAgo, store, stored, type CartLine, type Drink, type Order, type Settings, type Tally } from './api'
import { usePoll } from './usePoll'

const PIN_KEY = 'aj_bar_pin'
const NAME_KEY = 'aj_bar_name'

export default function BarApp() {
  const [pin, setPin] = useState(() => stored(PIN_KEY))
  const [name, setName] = useState(() => stored(NAME_KEY))
  if (!pin) return <PinScreen onOk={(p) => { store(PIN_KEY, p); setPin(p) }} />
  if (!name) return <NameScreen onOk={(n) => { store(NAME_KEY, n); setName(n) }} />
  return (
    <Bar
      pin={pin}
      me={name}
      onLogout={() => { store(PIN_KEY, ''); store(NAME_KEY, ''); setPin(''); setName('') }}
    />
  )
}

function PinScreen({ onOk }: { onOk: (pin: string) => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api.bar.login(pin)
      onOk(pin)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Nope')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <form onSubmit={submit} className="card w-full max-w-xs flex flex-col gap-3">
        <h1 className="font-display text-2xl">Bar</h1>
        <input className="input tracking-widest text-center" inputMode="numeric" autoFocus placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
        {err && <p className="text-red-700 text-sm">{err}</p>}
        <button className="btn-primary" disabled={!pin || busy}>In</button>
      </form>
    </main>
  )
}

function NameScreen({ onOk }: { onOk: (name: string) => void }) {
  const [v, setV] = useState('')
  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) onOk(v.trim()) }} className="card w-full max-w-xs flex flex-col gap-3">
        <h1 className="font-display text-2xl">Who's pouring?</h1>
        <input className="input" autoFocus placeholder="Your name" value={v} maxLength={60} onChange={(e) => setV(e.target.value)} />
        <button className="btn-primary" disabled={!v.trim()}>That's me</button>
      </form>
    </main>
  )
}

type Tab = 'queue' | 'new' | 'menu'

function Bar({ pin, me, onLogout }: { pin: string; me: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('queue')
  const queue = usePoll(() => api.bar.orders(pin), 4000, [pin])
  const menu = usePoll(api.menu, 15000)
  const [toast, setToast] = useState('')
  const [openDrinkId, setOpenDrinkId] = useState<string | null>(null)
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    if (queue.error && /PIN/i.test(queue.error)) onLogout()
  }, [queue.error, onLogout])

  const orders = queue.data?.orders ?? []
  const settings = queue.data?.settings
  const drinks = menu.data?.drinks ?? []
  const tally = queue.data?.tally ?? {}
  const newCount = orders.filter((o) => o.status === 'new').length
  const openDrink = openDrinkId ? drinks.find((d) => d.id === openDrinkId) ?? null : null

  useNewOrderChime(orders)

  const act = async (o: Order, action: string) => {
    try {
      const updated = await api.bar.act(pin, o.id, action, me)
      queue.setData((d) => d && { ...d, orders: d.orders.map((x) => (x.id === updated.id ? updated : x)) })
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Did not save')
      queue.refresh()
    }
  }

  const toggleSetting = async (patch: Partial<Settings>) => {
    try {
      const s = await api.bar.settings(pin, patch)
      queue.setData((d) => d && { ...d, settings: s })
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Did not save')
    }
  }

  return (
    <main className="min-h-dvh pb-24 max-w-lg mx-auto">
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl leading-none">Bar</h1>
          <p className="text-xs text-cocoa/60 mt-1">
            {me} · <button className="underline" onClick={onLogout}>switch</button>
          </p>
        </div>
        <ChimeToggle />
      </header>

      {settings && (
        <div className="px-4 flex gap-2">
          <Toggle on={!settings.ordering_open} label={settings.ordering_open ? 'Pause ordering' : 'Paused · tap to resume'} onClick={() => toggleSetting({ ordering_open: !settings.ordering_open })} />
          <Toggle on={settings.last_orders} label={settings.last_orders ? 'Last orders ON' : 'Call last orders'} onClick={() => toggleSetting({ last_orders: !settings.last_orders })} />
        </div>
      )}

      {queue.error && <p className="mx-4 mt-3 rounded-xl bg-red-100 text-red-800 px-3 py-2 text-sm">Connection trouble: {queue.error}. Showing last known queue.</p>}

      <div className="px-4 mt-4">
        {tab === 'queue' && <Queue orders={orders} me={me} now={queue.data?.now} act={act} loading={!queue.data} onShowDrink={setOpenDrinkId} />}
        {tab === 'new' && <NewOrder pin={pin} me={me} drinks={drinks} onPlaced={(o) => { queue.setData((d) => d && { ...d, orders: [...d.orders, o] }); setTab('queue'); flash(`Added ${o.guest_name}'s order`) }} onError={flash} />}
        {tab === 'menu' && <MenuManager pin={pin} me={me} drinks={drinks} tally={tally} onChange={() => menu.refresh()} onError={flash} onShowDrink={setOpenDrinkId} />}
      </div>

      <nav className="fixed bottom-0 inset-x-0 bg-cream/95 backdrop-blur border-t border-cocoa/10">
        <div className="max-w-lg mx-auto grid grid-cols-3">
          <TabBtn active={tab === 'queue'} onClick={() => setTab('queue')}>Queue{newCount > 0 && <span className="ml-1.5 pill bg-amber text-white">{newCount}</span>}</TabBtn>
          <TabBtn active={tab === 'new'} onClick={() => setTab('new')}>+ Order</TabBtn>
          <TabBtn active={tab === 'menu'} onClick={() => setTab('menu')}>Menu</TabBtn>
        </div>
      </nav>

      {openDrink && (
        <DrinkSheet
          pin={pin}
          drink={openDrink}
          ordered={tally[openDrink.id] || 0}
          onClose={() => setOpenDrinkId(null)}
          onChange={() => menu.refresh()}
          onRemoved={() => { setOpenDrinkId(null); menu.refresh(); flash(`Removed ${openDrink.name}`) }}
          onError={flash}
        />
      )}

      {toast && <div className="fixed top-4 inset-x-4 mx-auto max-w-md rounded-xl bg-cocoa text-cream px-4 py-3 text-center font-semibold shadow-lg">{toast}</div>}
    </main>
  )
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${on ? 'bg-amber text-white ring-amber' : 'bg-white/70 text-cocoa ring-cocoa/15'}`}>
      {label}
    </button>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`py-4 text-sm font-semibold flex items-center justify-center ${active ? 'text-cocoa border-t-2 border-cocoa -mt-px' : 'text-cocoa/50'}`}>
      {children}
    </button>
  )
}

// ---- Queue ----

function Queue({ orders, me, now, act, loading, onShowDrink }: { orders: Order[]; me: string; now?: string; act: (o: Order, a: string) => void; loading: boolean; onShowDrink: (id: string) => void }) {
  const nowMs = now ? new Date(now).getTime() : Date.now()
  const open = orders.filter((o) => ['new', 'making', 'ready'].includes(o.status))
  const grabs = open.filter((o) => o.status === 'new')
  const mine = open.filter((o) => o.status !== 'new' && o.claimed_by === me)
  const others = open.filter((o) => o.status !== 'new' && o.claimed_by !== me)

  if (loading) return <p className="text-cocoa/60">Loading…</p>
  if (!open.length) return <p className="card text-center text-cocoa/60 py-10">Nothing waiting. Go mingle.</p>

  return (
    <div className="flex flex-col gap-6">
      <Section title={`Up for grabs (${grabs.length})`} empty="All claimed">
        {grabs.map((o) => (
          <OrderCard key={o.id} order={o} nowMs={nowMs} onShowDrink={onShowDrink}>
            <button className="btn-amber flex-1" onClick={() => act(o, 'claim')}>I've got it</button>
            <button className="btn-ghost" onClick={() => act(o, 'cancel')}>Cancel</button>
          </OrderCard>
        ))}
      </Section>
      <Section title={`Mine (${mine.length})`} empty="Nothing on the go">
        {mine.map((o) => (
          <OrderCard key={o.id} order={o} nowMs={nowMs} onShowDrink={onShowDrink}>
            {o.status === 'making' && <button className="btn-primary flex-1" onClick={() => act(o, 'ready')}>Made it</button>}
            {o.status === 'ready' && <button className="btn-primary flex-1 !bg-sage" onClick={() => act(o, 'delivered')}>Delivered</button>}
            {o.status === 'making' && <button className="btn-ghost" onClick={() => act(o, 'unclaim')}>Put back</button>}
            <button className="btn-ghost" onClick={() => act(o, 'cancel')}>Cancel</button>
          </OrderCard>
        ))}
      </Section>
      {others.length > 0 && (
        <Section title={`Others are on it (${others.length})`} empty="">
          {others.map((o) => (
            <OrderCard key={o.id} order={o} nowMs={nowMs} muted onShowDrink={onShowDrink}>
              {o.status === 'ready' && <button className="btn-soft flex-1" onClick={() => act(o, 'delivered')}>I delivered it</button>}
            </OrderCard>
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section>
      <h2 className="uppercase tracking-widest text-xs text-cocoa/60 mb-2">{title}</h2>
      <div className="flex flex-col gap-2">
        {children.length ? children : empty ? <p className="text-sm text-cocoa/50 px-1">{empty}</p> : null}
      </div>
    </section>
  )
}

function OrderCard({ order, nowMs, muted, children, onShowDrink }: { order: Order; nowMs: number; muted?: boolean; children: React.ReactNode; onShowDrink: (id: string) => void }) {
  const mins = minutesAgo(order.created_at, nowMs)
  const late = mins >= 10 && order.status !== 'ready'
  return (
    <div className={`card ${muted ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-display text-xl leading-tight">{order.guest_name}</div>
        <span className={`pill ${late ? 'bg-red-100 text-red-800' : 'bg-cocoa/10 text-cocoa/70'}`}>{mins} min</span>
      </div>
      <ul className="mt-1.5 text-lg">
        {order.items.map((i) => (
          <li key={i.id}>
            <span className="font-semibold">{i.qty}×</span>{' '}
            {i.drink_id ? (
              <button className="underline decoration-dotted underline-offset-4 text-left" onClick={() => onShowDrink(i.drink_id!)}>{i.drink_name}</button>
            ) : i.drink_name}
          </li>
        ))}
      </ul>
      <div className="mt-1 text-xs text-cocoa/50">
        {order.placed_by ? `Taken by ${order.placed_by}` : 'From the app'}
        {order.claimed_by && ` · ${order.claimed_by} ${order.status === 'ready' ? 'has it ready' : 'is making it'}`}
      </div>
      <div className="mt-3 flex gap-2 items-center">{children}</div>
    </div>
  )
}

// ---- New (verbal) order ----

function DrinkPicker({ drinks, cart, setCart, showUnavailable }: { drinks: Drink[]; cart: Record<string, number>; setCart: (c: Record<string, number>) => void; showUnavailable: boolean }) {
  const bump = (id: string, d: number) => setCart({ ...cart, [id]: Math.max(0, Math.min(10, (cart[id] || 0) + d)) })
  return (
    <>
      {groupByCategory(drinks.filter((d) => showUnavailable || d.available)).map(([cat, list]) => (
        <div key={cat}>
          <h3 className="uppercase tracking-widest text-xs text-cocoa/60 mb-1">{cat}</h3>
          <div className="flex flex-col gap-1.5">
            {list.map((d) => {
              const q = cart[d.id] || 0
              return (
                <div key={d.id} className={`flex items-center gap-2 rounded-xl bg-white/70 ring-1 ring-cocoa/10 px-3 py-2 ${!d.available ? 'opacity-60' : ''}`}>
                  <div className="flex-1 font-semibold">{d.name}{!d.available && <span className="pill bg-cocoa/10 text-cocoa/70 ml-2">out</span>}</div>
                  <button className="btn-soft w-10 h-10 !px-0" onClick={() => bump(d.id, -1)} disabled={!q}>−</button>
                  <span className="w-6 text-center font-semibold">{q || ''}</span>
                  <button className="btn-soft w-10 h-10 !px-0" onClick={() => bump(d.id, 1)}>+</button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}

function NewOrder({ pin, me, drinks, onPlaced, onError }: { pin: string; me: string; drinks: Drink[]; onPlaced: (o: Order) => void; onError: (m: string) => void }) {
  const [guest, setGuest] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const lines: CartLine[] = Object.entries(cart).filter(([, q]) => q > 0).map(([drink_id, qty]) => ({ drink_id, qty }))
  const submit = async () => {
    setBusy(true)
    try {
      onPlaced(await api.bar.placeOrder(pin, guest.trim(), me, lines))
      setGuest('')
      setCart({})
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Did not save')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-cocoa/60">Someone asked you for a drink? Put it in the queue so whoever's at the bar sees it.</p>
      <input className="input" placeholder="Whose drink?" value={guest} maxLength={60} onChange={(e) => setGuest(e.target.value)} />
      <DrinkPicker drinks={drinks} cart={cart} setCart={setCart} showUnavailable />
      <button className="btn-primary text-lg" disabled={!guest.trim() || !lines.length || busy} onClick={submit}>
        {busy ? 'Adding…' : 'Add to queue'}
      </button>
    </div>
  )
}

// ---- Menu management ----

function MenuManager({ pin, me, drinks, tally, onChange, onError, onShowDrink }: { pin: string; me: string; drinks: Drink[]; tally: Tally; onChange: () => void; onError: (m: string) => void; onShowDrink: (id: string) => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [instructions, setInstructions] = useState('')
  const [cat, setCat] = useState('Cocktails')
  const [busy, setBusy] = useState(false)
  const cats = [...new Set(['Cocktails', 'Mixers', 'Beer & Wine', 'Soft', ...drinks.map((d) => d.category)])]

  const add = async () => {
    setBusy(true)
    try {
      await api.bar.addDrink(pin, { name: name.trim(), description: desc.trim(), category: cat, added_by: me, instructions: instructions.trim() })
      setName(''); setDesc(''); setInstructions('')
      onChange()
    } catch (e) { onError(e instanceof Error ? e.message : 'Did not save') } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-2">
        <h2 className="font-semibold">Add a drink</h2>
        <input className="input" placeholder="Name (e.g. Espresso Martini)" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="What's in it (optional)" value={desc} maxLength={120} onChange={(e) => setDesc(e.target.value)} />
        <textarea
          className="input min-h-[7rem] text-base"
          placeholder={"How to make it (optional)\ne.g. 50ml bourbon, sugar cube, 2 dashes bitters. Stir over ice, orange peel."}
          value={instructions}
          maxLength={2000}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`pill !py-1.5 !px-3 ring-1 ${cat === c ? 'bg-cocoa text-cream ring-cocoa' : 'bg-white ring-cocoa/15'}`}>{c}</button>
          ))}
        </div>
        <button className="btn-primary" disabled={!name.trim() || busy} onClick={add}>{busy ? 'Adding…' : 'Add to menu'}</button>
      </section>

      <section>
        <h2 className="uppercase tracking-widest text-xs text-cocoa/60 mb-2">On the menu · tap a drink for the recipe</h2>
        <div className="flex flex-col gap-1.5">
          {drinks.map((d) => (
            <button key={d.id} onClick={() => onShowDrink(d.id)} className={`text-left flex items-center gap-3 rounded-xl ring-1 px-3 py-2.5 ${d.available ? 'bg-white/70 ring-cocoa/10' : 'bg-cocoa/5 ring-cocoa/10 opacity-70'}`}>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{d.name}</div>
                <div className="text-xs text-cocoa/50">{d.category}{d.description && ` · ${d.description}`}{!d.instructions && ' · no recipe yet'}</div>
              </div>
              <span className="pill bg-cocoa/10 text-cocoa/70" title="Ordered tonight">{tally[d.id] || 0} ordered</span>
              <span className={`pill ${d.available ? 'bg-sage/20 text-sage' : 'bg-cocoa/10 text-cocoa/70'}`}>{d.available ? 'Available' : 'Run out'}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

// ---- Drink recipe sheet ----

function DrinkSheet({ pin, drink, ordered, onClose, onChange, onRemoved, onError }: {
  pin: string; drink: Drink; ordered: number; onClose: () => void; onChange: () => void; onRemoved: () => void; onError: (m: string) => void
}) {
  const [editing, setEditing] = useState(!drink.instructions)
  const [text, setText] = useState(drink.instructions)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try { await fn() } catch (e) { onError(e instanceof Error ? e.message : 'Did not save') } finally { setBusy(false) }
  }
  const save = () => run(async () => { await api.bar.updateDrink(pin, drink.id, { instructions: text.trim() }); setEditing(false); onChange() })
  const toggle = () => run(async () => { await api.bar.updateDrink(pin, drink.id, { available: !drink.available }); onChange() })
  const remove = () => run(async () => { await api.bar.removeDrink(pin, drink.id); onRemoved() })

  return (
    <div className="fixed inset-0 z-20 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={drink.name}>
      <button className="absolute inset-0 bg-cocoa/40" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-lg bg-cream rounded-t-3xl sm:rounded-3xl shadow-xl p-5 pb-8 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-2xl leading-tight">{drink.name}</h2>
            <p className="text-sm text-cocoa/60 mt-0.5">{drink.category}{drink.description && ` · ${drink.description}`}</p>
          </div>
          <button className="btn-soft w-10 h-10 !px-0 text-xl shrink-0" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          <span className="pill bg-amber/20 text-amber !text-sm !px-3 !py-1">{ordered} ordered tonight</span>
          <span className={`pill !text-sm !px-3 !py-1 ${drink.available ? 'bg-sage/20 text-sage' : 'bg-cocoa/10 text-cocoa/70'}`}>{drink.available ? 'Available' : 'Run out'}</span>
        </div>

        <section className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="uppercase tracking-widest text-xs text-cocoa/60">How to make it</h3>
            {!editing && <button className="btn-ghost !py-0 text-sm" onClick={() => setEditing(true)}>Edit</button>}
          </div>
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                className="input min-h-[9rem] text-base"
                autoFocus
                placeholder={"Measures, method, glass, garnish.\ne.g. 50ml bourbon, sugar cube, 2 dashes bitters. Stir over ice, orange peel."}
                value={text}
                maxLength={2000}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save recipe'}</button>
                {drink.instructions && <button className="btn-ghost" onClick={() => { setText(drink.instructions); setEditing(false) }}>Cancel</button>}
              </div>
            </div>
          ) : (
            <p className="card whitespace-pre-wrap text-lg leading-relaxed">{drink.instructions}</p>
          )}
        </section>

        <div className="mt-6 flex gap-2 items-center">
          <button className="btn-soft flex-1" disabled={busy} onClick={toggle}>{drink.available ? 'Mark run out' : 'Back on the menu'}</button>
          {confirmRemove ? (
            <>
              <button className="btn-primary !bg-red-700" disabled={busy} onClick={remove}>{busy ? 'Removing…' : 'Yes, remove'}</button>
              <button className="btn-ghost" onClick={() => setConfirmRemove(false)}>Keep</button>
            </>
          ) : (
            <button className="btn-ghost text-red-700" onClick={() => setConfirmRemove(true)}>Remove</button>
          )}
        </div>
        {confirmRemove && <p className="text-xs text-cocoa/60 mt-2">Takes it off the menu for good. Past orders keep the name.</p>}
      </div>
    </div>
  )
}

// ---- Chime on new orders ----

let audioCtx: AudioContext | null = null
function beep() {
  if (!audioCtx) return
  const o = audioCtx.createOscillator()
  const g = audioCtx.createGain()
  o.type = 'sine'
  o.frequency.value = 880
  g.gain.setValueAtTime(0.0001, audioCtx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5)
  o.connect(g).connect(audioCtx.destination)
  o.start()
  o.stop(audioCtx.currentTime + 0.5)
}

function ChimeToggle() {
  const [on, setOn] = useState(() => !!audioCtx)
  const toggle = () => {
    if (audioCtx) { audioCtx.close(); audioCtx = null; setOn(false); return }
    audioCtx = new AudioContext()
    audioCtx.resume()
    setOn(true)
    beep()
  }
  return (
    <button onClick={toggle} className={`rounded-full w-11 h-11 text-lg ring-1 ${on ? 'bg-amber text-white ring-amber' : 'bg-white/70 ring-cocoa/15'}`} aria-label="Toggle new-order chime" title="Chime on new orders">
      {on ? '🔔' : '🔕'}
    </button>
  )
}

function useNewOrderChime(orders: Order[]) {
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    const ids = new Set(orders.filter((o) => o.status === 'new').map((o) => o.id))
    if (seen.current) {
      for (const id of ids) if (!seen.current.has(id)) { beep(); break }
    }
    seen.current = ids
  }, [orders])
}
