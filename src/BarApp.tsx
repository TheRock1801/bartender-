import { useEffect, useRef, useState } from 'react'
import { api, clockTime, minutesAgo, store, stored, type Drink, type Fulfilment, type Order, type Settings, type Strength, type Tally } from './api'
import { CollectIcon, CoupleNames, DeliverIcon, Glass } from './art'
import { bumpCart, cartLines, groupByTab, itemLabel, type Cart } from './cart'
import { CartSummary, DrinkRows, MixerSheet } from './DrinkRows'
import { usePoll } from './usePoll'

const PIN_KEY = 'rj_bar_pin'

// One shared PIN, no bartender names: every phone behind the bar sees the same queue
// and anyone can move an order along.
export default function BarApp() {
  const [pin, setPin] = useState(() => stored(PIN_KEY))
  if (!pin) return <PinScreen onOk={(p) => { store(PIN_KEY, p); setPin(p) }} />
  return <Bar pin={pin} onLogout={() => { store(PIN_KEY, ''); setPin('') }} />
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
      <form onSubmit={submit} className="card w-full max-w-xs flex flex-col gap-3 p-6">
        <CoupleNames size="sm" />
        <h1 className="display text-2xl text-center mt-2">The Bar</h1>
        <input className="input tracking-[0.4em] text-center" inputMode="numeric" autoFocus placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
        {err && <p className="text-amber text-sm text-center">{err}</p>}
        <button className="btn-primary" disabled={!pin || busy}>Enter</button>
      </form>
    </main>
  )
}

type Tab = 'queue' | 'new' | 'menu'

function Bar({ pin, onLogout }: { pin: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('queue')
  // The whole night's orders, so the Delivered filter works; one evening's worth is small.
  const queue = usePoll(() => api.bar.orders(pin, true), 4000, [pin])
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
  const categories = menu.data?.categories ?? []
  const mixers = menu.data?.mixers ?? []
  const otherMixer = menu.data?.other_mixer ?? 'Other'
  const spiritsCategory = menu.data?.spirits_category ?? 'Spirits'
  const strengths = menu.data?.strengths ?? []
  const tally = queue.data?.tally ?? {}
  const newCount = orders.filter((o) => o.status === 'new').length
  const openDrink = openDrinkId ? drinks.find((d) => d.id === openDrinkId) ?? null : null

  useNewOrderChime(orders)

  const act = async (o: Order, action: string) => {
    try {
      const updated = await api.bar.act(pin, o.id, action)
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
      <header className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/art/header.png" alt="" className="w-[88px] h-auto" draggable={false} />
          <div>
            <h1 className="script text-[1.9rem]">Riley &amp; Jasmine</h1>
            <p className="text-xs text-stone">
              The Bar · <button className="underline underline-offset-4" onClick={onLogout}>log out</button>
            </p>
          </div>
        </div>
        <ChimeToggle />
      </header>

      {settings && (
        <div className="px-5 flex gap-2">
          <Toggle on={!settings.ordering_open} label={settings.ordering_open ? 'Pause ordering' : 'Paused · tap to resume'} onClick={() => toggleSetting({ ordering_open: !settings.ordering_open })} />
          <Toggle on={settings.last_orders} label={settings.last_orders ? 'Last orders ON' : 'Call last orders'} onClick={() => toggleSetting({ last_orders: !settings.last_orders })} />
        </div>
      )}

      {queue.error && <p className="mx-5 mt-3 rounded-xl bg-amber text-ivory px-3 py-2 text-sm">Connection trouble: {queue.error}. Showing the last known queue.</p>}

      <div className="px-5 mt-4">
        {tab === 'queue' && <Queue orders={orders} now={queue.data?.now} act={act} loading={!queue.data} onShowDrink={setOpenDrinkId} />}
        {tab === 'new' && <NewOrder pin={pin} drinks={drinks} categories={categories} mixers={mixers} otherMixer={otherMixer} spiritsCategory={spiritsCategory} strengths={strengths} onPlaced={(o) => { queue.setData((d) => d && { ...d, orders: [...d.orders, o] }); setTab('queue'); flash(`Added ${o.guest_name}'s order`) }} onError={flash} />}
        {tab === 'menu' && <MenuManager pin={pin} drinks={drinks} categories={categories} tally={tally} onChange={() => menu.refresh()} onError={flash} onShowDrink={setOpenDrinkId} />}
      </div>

      <nav className="fixed bottom-0 inset-x-0 bg-ivory/95 backdrop-blur border-t border-taupe/70">
        <div className="max-w-lg mx-auto grid grid-cols-3">
          <TabBtn active={tab === 'queue'} onClick={() => setTab('queue')}>Orders{newCount > 0 && <span className="ml-1.5 pill bg-amber text-ivory">{newCount}</span>}</TabBtn>
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

      {toast && <div className="fixed top-4 inset-x-4 mx-auto max-w-md z-40 rounded-xl bg-espresso text-ivory px-4 py-3 text-center fade-up">{toast}</div>}
    </main>
  )
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex-1 rounded-xl px-3 py-2 text-xs border ${on ? 'bg-amber text-ivory border-amber' : 'bg-transparent text-cocoa border-cocoa/30'}`}>
      {label}
    </button>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`py-4 spaced text-[0.7rem] flex items-center justify-center ${active ? 'text-espresso border-t-2 border-espresso -mt-px' : 'text-stone'}`}>
      {children}
    </button>
  )
}

// ---- Orders ----

type Filter = 'all' | 'new' | 'making' | 'delivered'

function Queue({ orders, now, act, loading, onShowDrink }: { orders: Order[]; now?: string; act: (o: Order, a: string) => void; loading: boolean; onShowDrink: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const nowMs = now ? new Date(now).getTime() : Date.now()
  const open = orders.filter((o) => ['new', 'making', 'ready'].includes(o.status))
  const by = (s: Order['status']) => orders.filter((o) => o.status === s)
  const counts: Record<Filter, number> = { all: open.length, new: by('new').length, making: by('making').length, delivered: by('delivered').length }
  const labels: Record<Filter, string> = { all: 'All orders', new: 'New', making: 'Preparing', delivered: 'Made' }
  const list = (filter === 'all' ? open : by(filter)).slice().sort((a, b) => b.created_at.localeCompare(a.created_at))

  if (loading) return <p className="text-stone">Loading…</p>

  return (
    <div>
      <div className="flex gap-4 border-b border-taupe/70 overflow-x-auto -mx-5 px-5">
        {(Object.keys(labels) as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`pb-2.5 -mb-px whitespace-nowrap spaced text-[0.66rem] border-b-2 ${filter === f ? 'border-espresso text-espresso' : 'border-transparent text-stone'}`} aria-pressed={filter === f}>
            {labels[f]} ({counts[f]})
          </button>
        ))}
      </div>

      {!list.length && <p className="pt-8 text-sm text-stone text-center">{filter === 'all' ? 'Nothing waiting. Go mingle.' : 'Nothing here.'}</p>}

      <div className="flex flex-col mt-1">
        {list.map((o) => (
          <OrderRow key={o.id} order={o} nowMs={nowMs} expanded={expanded === o.id} onToggle={() => setExpanded(expanded === o.id ? null : o.id)} act={act} onShowDrink={onShowDrink} />
        ))}
      </div>
    </div>
  )
}

function StatusPill({ order }: { order: Order }) {
  const cls: Record<Order['status'], string> = {
    new: 'bg-sand text-cocoa',
    making: 'bg-amber text-ivory',
    ready: 'bg-sage text-ivory',
    delivered: 'bg-sage text-ivory',
    cancelled: 'bg-mist text-stone line-through',
  }
  const text: Record<Order['status'], string> = { new: 'New', making: 'Preparing', ready: 'Made', delivered: 'Made', cancelled: 'Cancelled' }
  return (
    <span className={`pill !px-3 !py-2 !rounded-lg justify-center min-w-[6.2rem] ${cls[order.status]}`}>
      {text[order.status]}
      <svg className="ml-1.5 opacity-70" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </span>
  )
}

function OrderRow({ order, nowMs, expanded, onToggle, act, onShowDrink }: {
  order: Order; nowMs: number; expanded: boolean; onToggle: () => void; act: (o: Order, a: string) => void; onShowDrink: (id: string) => void
}) {
  const mins = minutesAgo(order.created_at, nowMs)
  const late = mins >= 10 && ['new', 'making'].includes(order.status)
  const first = order.items[0]
  return (
    <div className="row">
      <button className="w-full flex items-center gap-3 text-left" onClick={onToggle} aria-expanded={expanded}>
        <div className="w-14 shrink-0">
          <div className="text-base text-espresso">#{order.order_no}</div>
          <div className={`text-xs ${late ? 'text-amber' : 'text-stone'}`}>{clockTime(order.created_at)}</div>
        </div>
        {first && <Glass name={first.drink_name} size={40} />}
        <div className="flex-1 min-w-0">
          <div className="display text-xl leading-tight truncate">{order.guest_name}</div>
          <div className="text-xs text-stone truncate">
            {order.items.map((i) => (i.qty > 1 ? `${i.qty}× ` : '') + itemLabel(i.drink_name, i.mixer, i.strength)).join(', ')}
          </div>
        </div>
        <div className="w-[4.6rem] shrink-0 flex items-center gap-1.5 text-cocoa">
          {order.fulfilment === 'deliver' ? <DeliverIcon className="w-6 h-6 shrink-0" /> : <CollectIcon className="w-6 h-6 shrink-0" />}
          <div className="text-[0.68rem] leading-tight">
            {order.fulfilment === 'deliver' ? <>Deliver<br />Table {order.table_no}</> : <>Collect<br />at bar</>}
          </div>
        </div>
        <StatusPill order={order} />
      </button>

      {expanded && (
        <div className="mt-3 fade-up">
          <ul className="card py-3 text-base">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-0.5">
                <span className="text-stone w-7">{i.qty}×</span>
                {i.drink_id ? (
                  <button className="underline decoration-dotted underline-offset-4 text-left text-espresso" onClick={() => onShowDrink(i.drink_id!)}>{itemLabel(i.drink_name, i.mixer, i.strength)}</button>
                ) : <span>{itemLabel(i.drink_name, i.mixer, i.strength)}</span>}
                {i.strength && <span className="pill ml-1 capitalize bg-sage/20 text-sage">{i.strength} pour</span>}
              </li>
            ))}
            <li className="text-xs text-stone pt-2">
              {order.placed_by ? 'Typed in at the bar' : 'From the app'} · {mins} min ago
            </li>
          </ul>
          <div className="mt-3 flex gap-2 items-center flex-wrap">
            {order.status === 'new' && <button className="btn-primary flex-1" onClick={() => act(order, 'start')}>Making it</button>}
            {order.status === 'making' && <button className="btn-dark flex-1 !bg-sage" onClick={() => act(order, 'made')}>Made it</button>}
            {order.status === 'ready' && <button className="btn-dark flex-1 !bg-sage" onClick={() => act(order, 'made')}>Made it</button>}
            {order.status === 'making' && <button className="btn-ghost" onClick={() => act(order, 'putback')}>Put back</button>}
            {['new', 'making', 'ready'].includes(order.status) && <button className="btn-ghost" onClick={() => act(order, 'cancel')}>Cancel</button>}
            {['delivered', 'cancelled'].includes(order.status) && <button className="btn-soft flex-1" onClick={() => act(order, 'reopen')}>Reopen</button>}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- New (verbal) order ----

function NewOrder({ pin, drinks, categories, mixers, otherMixer, spiritsCategory, strengths, onPlaced, onError }: {
  pin: string; drinks: Drink[]; categories: string[]; mixers: string[]; otherMixer: string; spiritsCategory: string; strengths: Strength[]
  onPlaced: (o: Order) => void; onError: (m: string) => void
}) {
  const [guest, setGuest] = useState('')
  const [fulfilment, setFulfilment] = useState<Fulfilment>('collect')
  const [table, setTable] = useState('')
  const [cart, setCart] = useState<Cart>({})
  const [tab, setTab] = useState<string | null>(null)
  const [choosing, setChoosing] = useState<Drink | null>(null)
  const [busy, setBusy] = useState(false)
  const tabs = groupByTab(drinks, categories)
  const activeTab = tabs.find(([c]) => c === tab)?.[0] ?? tabs[0]?.[0] ?? null
  const activeDrinks = tabs.find(([c]) => c === activeTab)?.[1] ?? []
  const lines = cartLines(cart)
  const bump = (drink_id: string, mixer: string | null, delta: number, strength: Strength | null) =>
    setCart((c) => bumpCart(c, drink_id, mixer, delta, strength))
  const ready = guest.trim() && lines.length && (fulfilment === 'collect' || table.trim())

  const submit = async () => {
    setBusy(true)
    try {
      onPlaced(await api.bar.placeOrder(pin, { guest_name: guest.trim(), fulfilment, table_no: table.trim() }, lines))
      setGuest(''); setTable('')
      setCart({})
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Did not save')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-stone">Someone asked you for a drink? Put it in the queue so whoever's at the bar sees it.</p>
      <input className="input" placeholder="Whose drink?" value={guest} maxLength={60} onChange={(e) => setGuest(e.target.value)} />
      <div className="flex gap-2 items-center">
        {(['collect', 'deliver'] as Fulfilment[]).map((f) => (
          <button key={f} onClick={() => setFulfilment(f)} className={`rounded-lg border px-3 py-2 text-sm ${fulfilment === f ? 'bg-espresso text-ivory border-espresso' : 'border-cocoa/30 text-cocoa'}`} aria-pressed={fulfilment === f}>
            {f === 'collect' ? 'Collect at bar' : 'Deliver to table'}
          </button>
        ))}
        {fulfilment === 'deliver' && <input className="input !w-24 !py-2" placeholder="Table" inputMode="numeric" value={table} maxLength={12} onChange={(e) => setTable(e.target.value)} />}
      </div>

      {tabs.length > 0 && (
        <div className="flex gap-4 border-b border-taupe/70 overflow-x-auto">
          {tabs.map(([cat]) => (
            <button key={cat} onClick={() => setTab(cat)} className={`pb-2 -mb-px whitespace-nowrap spaced text-[0.66rem] border-b-2 ${activeTab === cat ? 'border-espresso text-espresso' : 'border-transparent text-stone'}`}>
              {cat}
            </button>
          ))}
        </div>
      )}
      {activeTab && (
        <DrinkRows
          key={activeTab}
          drinks={activeDrinks}
          cart={cart}
          onBump={bump}
          onChoose={setChoosing}
          isSpirit={activeTab === spiritsCategory}
          canOrder={() => true}
          compact
        />
      )}

      {lines.length > 0 && <CartSummary cart={cart} drinks={drinks} onBump={bump} />}

      <button className="btn-primary text-lg" disabled={!ready || busy} onClick={submit}>
        {busy ? 'Adding…' : 'Add to queue'}
      </button>

      {choosing && (
        <MixerSheet
          drink={choosing}
          mixers={mixers}
          otherMixer={otherMixer}
          strengths={strengths}
          cart={cart}
          onAdd={(mixer, strength) => { bump(choosing.id, mixer, 1, strength); setChoosing(null) }}
          onClose={() => setChoosing(null)}
        />
      )}
    </div>
  )
}

// ---- Menu management ----

function MenuManager({ pin, drinks, categories, tally, onChange, onError, onShowDrink }: { pin: string; drinks: Drink[]; categories: string[]; tally: Tally; onChange: () => void; onError: (m: string) => void; onShowDrink: (id: string) => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [instructions, setInstructions] = useState('')
  const [cat, setCat] = useState('Cocktails')
  const [busy, setBusy] = useState(false)
  const cats = categories.length ? categories : ['Spirits', 'Cocktails', 'Beer & Wine', 'Non-alcoholic']

  const add = async () => {
    setBusy(true)
    try {
      await api.bar.addDrink(pin, { name: name.trim(), description: desc.trim(), category: cat, added_by: 'Bar', instructions: instructions.trim() })
      setName(''); setDesc(''); setInstructions('')
      onChange()
    } catch (e) { onError(e instanceof Error ? e.message : 'Did not save') } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="display text-2xl mb-1">Add a drink</h2>
        <input className="input" placeholder={cat === 'Spirits' ? 'Spirit (e.g. Tequila)' : cat === 'Beer & Wine' ? 'e.g. Rosé, Pale ale' : cat === 'Non-alcoholic' ? 'e.g. Ginger beer' : 'Name (e.g. Negroni)'} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="What's in it (optional)" value={desc} maxLength={120} onChange={(e) => setDesc(e.target.value)} />
        <textarea
          className="input min-h-[7rem]"
          placeholder={"How to make it (optional)\ne.g. 50ml bourbon, sugar cube, 2 dashes bitters. Stir over ice, orange peel."}
          value={instructions}
          maxLength={2000}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-lg border px-3 py-1.5 text-xs ${cat === c ? 'bg-espresso text-ivory border-espresso' : 'border-cocoa/30 text-cocoa'}`}>{c}</button>
          ))}
        </div>
        {cat === 'Spirits' && <p className="text-xs text-stone">Guests choose the mixer themselves, so just the spirit's name here.</p>}
        <button className="btn-primary" disabled={!name.trim() || busy} onClick={add}>{busy ? 'Adding…' : 'Add to menu'}</button>
      </section>

      <section>
        <h2 className="display text-2xl mb-1">On the menu</h2>
        <p className="label mb-2">Tap a drink for the recipe</p>
        <div className="flex flex-col">
          {drinks.map((d) => (
            <button key={d.id} onClick={() => onShowDrink(d.id)} className={`text-left flex items-center gap-3 row py-3 w-full ${d.available ? '' : 'opacity-60'}`}>
              <Glass name={d.name} size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-base text-espresso">{d.name}</div>
                <div className="text-xs text-stone">{d.category}{d.description && ` · ${d.description}`}{!d.instructions && ' · no recipe yet'}</div>
              </div>
              <span className="pill bg-sand text-stone" title="Ordered tonight">{tally[d.id] || 0} ordered</span>
              <span className={`pill ${d.available ? 'bg-sage/20 text-sage' : 'bg-mist text-stone'}`}>{d.available ? 'Available' : 'Run out'}</span>
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
      <button className="absolute inset-0 bg-espresso/40" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-lg sheet rounded-b-none sm:rounded-b-2xl p-6 pb-8 max-h-[90dvh] overflow-y-auto fade-up">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <Glass name={drink.name} size={52} />
            <div>
              <h2 className="display text-3xl leading-none">{drink.name}</h2>
              <p className="text-xs text-stone mt-1.5">{drink.category}{drink.description && ` · ${drink.description}`}</p>
            </div>
          </div>
          <button className="btn-soft w-10 h-10 !px-0 !py-0 text-xl shrink-0" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          <span className="pill bg-amber/15 text-amber">{ordered} ordered tonight</span>
          <span className={`pill ${drink.available ? 'bg-sage/20 text-sage' : 'bg-mist text-stone'}`}>{drink.available ? 'Available' : 'Run out'}</span>
        </div>

        <section className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="label">How to make it</h3>
            {!editing && <button className="btn-ghost !py-0 text-xs" onClick={() => setEditing(true)}>Edit</button>}
          </div>
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                className="input min-h-[9rem]"
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
            <p className="rounded-xl bg-cream p-4 whitespace-pre-wrap text-base leading-relaxed">{drink.instructions}</p>
          )}
        </section>

        <div className="mt-6 flex gap-2 items-center">
          <button className="btn-soft flex-1" disabled={busy} onClick={toggle}>{drink.available ? 'Mark run out' : 'Back on the menu'}</button>
          {confirmRemove ? (
            <>
              <button className="btn-primary" disabled={busy} onClick={remove}>{busy ? 'Removing…' : 'Yes, remove'}</button>
              <button className="btn-ghost" onClick={() => setConfirmRemove(false)}>Keep</button>
            </>
          ) : (
            <button className="btn-ghost text-amber" onClick={() => setConfirmRemove(true)}>Remove</button>
          )}
        </div>
        {confirmRemove && <p className="text-xs text-stone mt-2">Takes it off the menu for good. Past orders keep the name.</p>}
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
    <button onClick={toggle} className={`rounded-xl w-11 h-11 inline-flex items-center justify-center border shrink-0 ${on ? 'bg-amber text-ivory border-amber' : 'bg-transparent text-cocoa border-cocoa/30'}`} aria-label="Toggle new-order chime" aria-pressed={on} title="Chime on new orders">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
        {!on && <path d="M4 4l16 16" />}
      </svg>
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
