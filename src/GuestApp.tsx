import { useMemo, useState } from 'react'
import { api, deviceId, minutesAgo, store, stored, type Drink, type Fulfilment, type Order, type Strength } from './api'
import { BackArrow, Check, CollectIcon, CoupleNames, DeliverIcon, Glass, HeaderArt } from './art'
import { bumpCart, cartCount, cartLines, groupByTab, itemLabel, type Cart } from './cart'
import { CartSummary, DrinkRows, MixerSheet } from './DrinkRows'
import { usePoll } from './usePoll'

const NAME_KEY = 'rj_guest_name'
const FULFILMENT_KEY = 'rj_fulfilment'
const TABLE_KEY = 'rj_table'

// Guest flow, as on the mood board: the bar menu → (spirit) choose your mixer → your order
// (collect or deliver, your name) → placed. No sign-in: the name is asked for with the order
// and remembered on the phone.
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
    <main className="min-h-dvh pb-28 px-5 pt-6 max-w-lg mx-auto">
      <HeaderArt />
      <div className="mt-2"><CoupleNames /></div>

      <div className="divider mt-8 pt-7 text-center">
        <h2 className="script text-[2.6rem]">the bar</h2>
        <p className="spaced text-sm text-cocoa mt-2">Drinks are on us</p>
      </div>

      {settings?.last_orders && <Banner tone="amber">Last orders! Get them in.</Banner>}
      {!open && <Banner tone="dark">The bar's taking a short break, back in a few minutes.</Banner>}
      {menu.error && !menu.data && <Banner tone="dark">Can't reach the bar right now, probably the signal. Hang about.</Banner>}

      {openOrders.length > 0 && (
        <section className="mt-8">
          <h3 className="label mb-3">Your drinks</h3>
          <div className="flex flex-col gap-2">
            {openOrders.map((o) => <GuestOrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}

      <section className="mt-8">
        {!menu.data && !menu.error && <p className="text-stone text-center">One moment…</p>}

        {tabs.length > 0 && (
          <div className="flex gap-5 border-b border-taupe/70 overflow-x-auto">
            {tabs.map(([cat]) => (
              <button
                key={cat}
                onClick={() => setTab(cat)}
                className={`pb-2.5 -mb-px whitespace-nowrap spaced text-[0.7rem] border-b-2 transition ${activeTab === cat ? 'border-espresso text-espresso' : 'border-transparent text-stone'}`}
                aria-pressed={activeTab === cat}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {activeTab && (
          <>
            <p className="text-sm text-stone mt-5 mb-1">
              {activeTab === spiritsCategory ? 'Pick a spirit, then choose your mixer.' : `Tap Add for anything you'd like.`}
            </p>
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
        <section className="mt-8">
          <h3 className="label mb-3">Earlier</h3>
          <div className="flex flex-col gap-2 opacity-70">
            {doneOrders.map((o) => <GuestOrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}

      <p className="mt-12 text-center text-xs text-stone">Nothing to pay. Just order and we'll sort the rest.</p>
      <a href="/bar" className="block mt-6 text-center text-xs text-stone/70 underline underline-offset-4">Bar staff</a>

      {count > 0 && open && !ordering && !choosing && (
        <div className="fixed inset-x-0 bottom-0 p-4 bg-gradient-to-t from-cream via-cream to-transparent">
          <div className="max-w-lg mx-auto fade-up">
            <button className="btn-primary w-full text-lg" onClick={() => setOrdering(true)}>
              View your order · {count} {count === 1 ? 'drink' : 'drinks'}
              <span className="ml-2" aria-hidden="true">›</span>
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
            flash('ok', order.fulfilment === 'deliver' ? `Order #${order.order_no} is in. We'll bring it to table ${order.table_no}.` : `Order #${order.order_no} is in. We'll call you when it's ready at the bar.`)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          onError={(m) => { flash('err', m); menu.refresh() }}
        />
      )}

      {toast && (
        <div className={`fixed top-4 inset-x-4 mx-auto max-w-md z-40 rounded-xl px-4 py-3 text-center fade-up ${toast.kind === 'ok' ? 'bg-sage text-ivory' : 'bg-amber text-ivory'}`}>
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
      <main className="min-h-dvh max-w-lg mx-auto px-5 pt-3 pb-12">
        <BackArrow onClick={onClose} label="Back to the menu" />
        <HeaderArt className="max-w-[260px] -mt-4" />
        <h2 className="script text-[2.9rem] text-center mt-1">Your Order</h2>

        <div className="mt-6">
          <CartSummary cart={cart} drinks={drinks} onBump={onBump} />
          {count === 0 && <button className="btn-soft mt-3" onClick={onClose}>Back to the menu</button>}
        </div>

        <h3 className="text-lg text-espresso mt-8">How would you like your drink?</h3>
        <div className="grid grid-cols-2 gap-3 mt-3" role="radiogroup">
          <FulfilmentCard
            selected={fulfilment === 'collect'}
            onPick={() => setFulfilment('collect')}
            icon={<CollectIcon />}
            title="Collect from bar"
            sub="I'll pick it up at the bar"
          />
          <FulfilmentCard
            selected={fulfilment === 'deliver'}
            onPick={() => setFulfilment('deliver')}
            icon={<DeliverIcon />}
            title="Deliver to my table"
            sub="Bring it to me"
          />
        </div>
        {fulfilment === 'deliver' && (
          <div className="mt-4 fade-up">
            <label className="text-lg text-espresso block mb-2" htmlFor="table-no">Table number</label>
            <input id="table-no" className="input" placeholder="e.g. 4" inputMode="numeric" value={table} maxLength={12} onChange={(e) => setTable(e.target.value)} />
          </div>
        )}

        <label className="text-lg text-espresso block mt-6 mb-2" htmlFor="guest-name">Your name</label>
        <input id="guest-name" className="input" placeholder="e.g. Sarah" autoComplete="given-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />

        <button className="btn-primary w-full text-lg mt-6" disabled={!ready || busy} onClick={place}>
          {busy ? 'Sending…' : !open ? 'Ordering is paused' : 'Place order — it’s on us!'}
          {!busy && open && <span className="ml-2" aria-hidden="true">›</span>}
        </button>
        {!name.trim() && count > 0 && <p className="text-xs text-stone text-center mt-2">Pop your name in so we know whose drink it is.</p>}
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
      className={`card relative flex flex-col items-center text-center gap-1 py-5 border ${selected ? 'border-amber' : 'border-transparent'}`}
    >
      <span className={`absolute top-2.5 right-2.5 ring-radio w-5 h-5 ${selected ? 'bg-amber border-amber text-ivory' : ''}`}>{selected && <Check />}</span>
      <span className="text-cocoa">{icon}</span>
      <span className="text-base text-espresso mt-1 leading-tight">{title}</span>
      <span className="text-xs text-stone leading-snug">{sub}</span>
    </button>
  )
}

function Banner({ tone, children }: { tone: 'amber' | 'dark'; children: React.ReactNode }) {
  const cls = tone === 'amber' ? 'bg-amber text-ivory' : 'bg-espresso text-ivory'
  return <div className={`mt-6 rounded-xl px-4 py-3 text-center ${cls}`}>{children}</div>
}

function GuestOrderCard({ order }: { order: Order }) {
  const made = order.fulfilment === 'deliver' ? `Made, on its way to table ${order.table_no}` : 'Made, come grab it at the bar'
  const label: Record<Order['status'], string> = {
    new: 'In the queue',
    making: 'Being made',
    ready: made,
    delivered: made,
    cancelled: 'Cancelled',
  }
  const tone: Record<Order['status'], string> = {
    new: 'bg-sand text-cocoa',
    making: 'bg-amber text-ivory',
    ready: 'bg-sage text-ivory',
    delivered: 'bg-sage text-ivory',
    cancelled: 'bg-mist text-stone',
  }
  const first = order.items[0]
  return (
    <div className="card flex items-center gap-3">
      {first && <Glass name={first.drink_name} size={44} />}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-stone">#{order.order_no} · {minutesAgo(order.created_at)} min ago · {order.fulfilment === 'deliver' ? `Table ${order.table_no}` : 'Collect at bar'}</div>
        <div className="text-base text-espresso leading-snug mt-0.5">
          {order.items.map((i) => (i.qty > 1 ? `${i.qty}× ` : '') + itemLabel(i.drink_name, i.mixer, i.strength)).join(', ')}
        </div>
        <span className={`pill mt-2 ${tone[order.status]}`}>{label[order.status]}</span>
      </div>
    </div>
  )
}
