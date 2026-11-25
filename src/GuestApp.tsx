import { useMemo, useState } from 'react'
import { api, deviceId, minutesAgo, store, stored, type Drink, type Fulfilment, type Order, type Strength } from './api'
import { BackArrow, Check, CollectIcon, CoupleNames, DeliverIcon } from './art'
import { bumpCart, cartCount, cartLines, groupByTab, itemLabel, type Cart } from './cart'
import { CartSummary, DrinkRows, MixerSheet } from './DrinkRows'
import { usePoll } from './usePoll'

const NAME_KEY = 'dr_guest_name'
const FULFILMENT_KEY = 'dr_fulfilment'
const TABLE_KEY = 'dr_table'

// Guest flow: the menu → (spirit) choose your mixer → your order (collect or deliver,
// your name) → placed. No sign-in: the name is asked for with the order and remembered
// on the phone. Styled in the Aria & Jansen stationery look.
export default function GuestApp() {
  const device = useMemo(deviceId, [])
  const menu = usePoll(api.menu, 15000)
  const mine = usePoll(() => api.myOrders(device), 5000, [device])
  const [cart, setCart] = useState<Cart>({})
  const [tab, setTab] = useState<string | null>(null)
  const [choosing, setChoosing] = useState<Drink | null>(null)
  const [ordering, setOrdering] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const drinks = menu.data?.drinks ?? []
  const settings = menu.data?.settings
  const categories = menu.data?.categories ?? []
  const spiritsCategory = menu.data?.spirits_category ?? 'Spirits'
  const tabs = groupByTab(drinks, categories)
  const activeTab = tabs.find(([c]) => c === tab)?.[0] ?? tabs[0]?.[0] ?? null
  const activeDrinks = tabs.find(([c]) => c === activeTab)?.[1] ?? []
  const count = cartCount(cart)
  const open = settings?.ordering_open !== false

  const bump = (drink_id: string, mixer: string | null, delta: number, strength: Strength | null) =>
    setCart((c) => bumpCart(c, drink_id, mixer, delta, strength))

  const flash = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 4000)
  }

  const orders = mine.data?.orders ?? []
  // A made drink stays under "Your drinks" for a few minutes so the guest sees it's done, then moves to Earlier.
  const recent = (o: Order) => Date.now() - new Date(o.updated_at).getTime() < 5 * 60000
  const openOrders = orders.filter((o) => ['new', 'making', 'ready'].includes(o.status) || (o.status === 'delivered' && recent(o)))
  const doneOrders = orders.filter((o) => !openOrders.includes(o)).slice(0, 3)

  return (
    <main className="min-h-dvh pb-28 px-6 pt-8 max-w-lg mx-auto">
      <CoupleNames />

      {settings?.last_orders && <Banner tone="amber">last orders! get 'em in.</Banner>}
      {!open && <Banner tone="dark">bar's taking a breather, back in a few.</Banner>}
      {menu.error && !menu.data && <Banner tone="dark">can't reach the bar right now, dodgy signal probably. hang about.</Banner>}

      {openOrders.length > 0 && (
        <section className="mt-8 divider pt-5">
          <h2 className="display text-2xl mb-3">your drinks.</h2>
          <div className="flex flex-col gap-2">
            {openOrders.map((o) => <GuestOrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}

      <section className="mt-8 divider pt-5">
        <h2 className="display text-2xl mb-3">menu.</h2>
        {!menu.data && !menu.error && <p className="text-stone">one sec…</p>}

        {tabs.length > 0 && (
          <div className="flex gap-6 border-b border-taupe/30 mb-5 overflow-x-auto">
            {tabs.map(([cat]) => (
              <button
                key={cat}
                onClick={() => setTab(cat)}
                className={`pb-2 -mb-px whitespace-nowrap tab border-b-2 transition ${activeTab === cat ? 'border-cocoa text-cocoa' : 'border-transparent text-cocoa/50'}`}
                aria-pressed={activeTab === cat}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {activeTab && (
          <>
            {activeTab === spiritsCategory && activeDrinks.length > 0 && (
              <p className="font-mono text-xs text-cocoa/60 mb-1">pick a spirit, then what you want with it.</p>
            )}
            <DrinkRows
              key={activeTab}
              drinks={activeDrinks}
              cart={cart}
              onBump={bump}
              onChoose={setChoosing}
              isSpirit={activeTab === spiritsCategory}
              canOrder={(d) => d.available && open}
            />
          </>
        )}
      </section>

      {doneOrders.length > 0 && (
        <section className="mt-8 divider pt-5">
          <h2 className="display text-2xl mb-3">earlier.</h2>
          <div className="flex flex-col gap-2 opacity-70">
            {doneOrders.map((o) => <GuestOrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}

      <a href="/bar" className="btn-ghost mt-12 text-sm px-0 font-mono lowercase">bar staff →</a>

      {count > 0 && open && !ordering && !choosing && (
        <div className="fixed inset-x-0 bottom-0 p-4 bg-gradient-to-t from-cream via-cream to-transparent">
          <div className="max-w-lg mx-auto fade-up">
            <button className="btn-primary w-full text-lg" onClick={() => setOrdering(true)}>
              view your order · {count} {count === 1 ? 'drink' : 'drinks'}
              <span className="ml-2" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

      {choosing && menu.data && (
        <MixerSheet
          drink={choosing}
          mixers={menu.data.mixers}
          otherMixer={menu.data.other_mixer}
          strengths={menu.data.strengths}
          cart={cart}
          onAdd={(mixer, strength) => { bump(choosing.id, mixer, 1, strength); setChoosing(null) }}
          onClose={() => setChoosing(null)}
        />
      )}

      {ordering && (
        <OrderSheet
          cart={cart}
          drinks={drinks}
          device={device}
          open={open}
          onBump={bump}
          onClose={() => setOrdering(false)}
          onPlaced={(order) => {
            setCart({})
            setOrdering(false)
            mine.setData((d) => ({ orders: [order, ...(d?.orders ?? [])] }))
            flash('ok', order.fulfilment === 'deliver' ? `on it! #${order.order_no} is coming to table ${order.table_no}.` : `on it! #${order.order_no}, we'll call you up to the bar.`)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          onError={(m) => { flash('err', m); menu.refresh() }}
        />
      )}

      {toast && (
        <div className={`fixed top-4 inset-x-4 mx-auto max-w-md z-40 rounded px-4 py-3 text-center font-semibold fade-up ${toast.kind === 'ok' ? 'bg-sage text-cream' : 'bg-amber text-cream'}`}>
          {toast.text}
        </div>
      )}
    </main>
  )
}

// ---- Your order ----

function OrderSheet({ cart, drinks, device, open, onBump, onClose, onPlaced, onError }: {
  cart: Cart
  drinks: Drink[]
  device: string
  open: boolean
  onBump: (drink_id: string, mixer: string | null, delta: number, strength: Strength | null) => void
  onClose: () => void
  onPlaced: (o: Order) => void
  onError: (m: string) => void
}) {
  const [name, setName] = useState(() => stored(NAME_KEY))
  const [fulfilment, setFulfilment] = useState<Fulfilment>(() => (stored(FULFILMENT_KEY) === 'deliver' ? 'deliver' : 'collect'))
  const [table, setTable] = useState(() => stored(TABLE_KEY))
  const [busy, setBusy] = useState(false)
  const count = cartCount(cart)
  const ready = count > 0 && name.trim().length > 0 && (fulfilment === 'collect' || table.trim().length > 0) && open

  const place = async () => {
    if (!ready || busy) return
    setBusy(true)
    try {
      const details = { guest_name: name.trim(), fulfilment, table_no: table.trim() }
      store(NAME_KEY, details.guest_name); store(FULFILMENT_KEY, fulfilment); store(TABLE_KEY, details.table_no)
      onPlaced(await api.placeOrder(details, device, cartLines(cart)))
    } catch (e) {
      onError(e instanceof Error ? e.message : "That didn't go through, give it another go")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 bg-cream overflow-y-auto" role="dialog" aria-modal="true" aria-label="Your order">
      <main className="min-h-dvh max-w-lg mx-auto px-6 pt-4 pb-12">
        <BackArrow onClick={onClose} label="Back to the menu" />
        <h2 className="display text-[2.5rem] mt-2">your order.</h2>

        <div className="mt-5 divider pt-2">
          <CartSummary cart={cart} drinks={drinks} onBump={onBump} />
          {count > 0 && <p className="font-mono text-xs text-cocoa/60 mt-2">tap − to drop one.</p>}
          {count === 0 && <button className="btn-soft mt-3" onClick={onClose}>back to the menu</button>}
        </div>

        <h3 className="display text-2xl mt-8 divider pt-5">how do you want it?</h3>
        <div className="grid grid-cols-2 gap-3 mt-4" role="radiogroup">
          <FulfilmentCard
            selected={fulfilment === 'collect'}
            onPick={() => setFulfilment('collect')}
            icon={<CollectIcon />}
            title="collect from the bar"
            sub="i'll come grab it"
          />
          <FulfilmentCard
            selected={fulfilment === 'deliver'}
            onPick={() => setFulfilment('deliver')}
            icon={<DeliverIcon />}
            title="bring it to my table"
            sub="we'll find you"
          />
        </div>
        {fulfilment === 'deliver' && (
          <div className="mt-5 fade-up">
            <label className="label block mb-2" htmlFor="table-no">table number</label>
            <input id="table-no" className="input" placeholder="e.g. 4" inputMode="numeric" value={table} maxLength={12} onChange={(e) => setTable(e.target.value)} />
          </div>
        )}

        <label className="display text-2xl block mt-8 divider pt-5 mb-3" htmlFor="guest-name">what's your name?</label>
        <input id="guest-name" className="input" placeholder="e.g. Sam" autoComplete="given-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />

        <button className="btn-primary w-full text-lg mt-6" disabled={!ready || busy} onClick={place}>
          {busy ? 'sending…' : !open ? "bar's paused" : 'complete order'}
        </button>
        {!name.trim() && count > 0 && <p className="font-mono text-xs text-cocoa/60 mt-2">pop your name in so we know whose drink it is.</p>}
      </main>
    </div>
  )
}

function FulfilmentCard({ selected, onPick, icon, title, sub }: { selected: boolean; onPick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button
      onClick={onPick}
      role="radio"
      aria-checked={selected}
      className={`card relative flex flex-col items-center text-center gap-1 py-5 transition ${selected ? '!bg-cocoa !border-cocoa text-cream' : 'text-cocoa'}`}
    >
      <span className={`absolute top-2.5 right-2.5 ring-radio w-5 h-5 ${selected ? 'bg-cream border-cream text-cocoa' : ''}`}>{selected && <Check />}</span>
      <span>{icon}</span>
      <span className="font-semibold mt-1 leading-tight">{title}</span>
      <span className={`font-mono text-[0.7rem] leading-snug ${selected ? 'text-cream/70' : 'text-cocoa/60'}`}>{sub}</span>
    </button>
  )
}

function Banner({ tone, children }: { tone: 'amber' | 'dark'; children: React.ReactNode }) {
  const cls = tone === 'amber' ? 'bg-amber text-cream' : 'bg-taupe text-cream'
  return <div className={`mt-5 rounded px-4 py-3 font-medium ${cls}`}>{children}</div>
}

function GuestOrderCard({ order }: { order: Order }) {
  const made = order.fulfilment === 'deliver' ? `made, on its way to table ${order.table_no}` : 'made, come grab it at the bar'
  const label: Record<Order['status'], string> = {
    new: 'in the queue',
    making: 'being made',
    ready: made,
    delivered: made,
    cancelled: 'cancelled',
  }
  const tone: Record<Order['status'], string> = {
    new: 'bg-sand text-cocoa',
    making: 'bg-amber/20 text-amber',
    ready: 'bg-sage/20 text-sage',
    delivered: 'bg-sage/20 text-sage',
    cancelled: 'bg-sand/70 text-cocoa/80',
  }
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold">
          {order.items.map((i) => (i.qty > 1 ? `${i.qty}× ` : '') + itemLabel(i.drink_name, i.mixer, i.strength)).join(', ')}
        </div>
        <span className="font-mono text-xs text-cocoa/50 whitespace-nowrap">#{order.order_no}</span>
      </div>
      <div className="font-mono text-[0.7rem] text-cocoa/50 mt-1">
        {minutesAgo(order.created_at)} min ago · {order.fulfilment === 'deliver' ? `table ${order.table_no}` : 'collect at bar'}
      </div>
      <span className={`pill mt-2 ${tone[order.status]}`}>{label[order.status]}</span>
    </div>
  )
}
