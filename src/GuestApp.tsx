import { useMemo, useState } from 'react'
import { api, deviceId, minutesAgo, store, stored, type Order, type Strength } from './api'
import { bumpCart, cartCount, cartLines, drinkStrength, groupByTab, itemLabel, setStrength, type Cart } from './cart'
import { CartSummary, DrinkRows } from './DrinkRows'
import { usePoll } from './usePoll'

const NAME_KEY = 'aj_guest_name'

export default function GuestApp() {
  const [name, setName] = useState(() => stored(NAME_KEY))
  if (!name) return <Join onJoin={(n) => { store(NAME_KEY, n); setName(n) }} />
  return <Menu name={name} onChangeName={() => { store(NAME_KEY, ''); setName('') }} />
}

function Join({ onJoin }: { onJoin: (name: string) => void }) {
  const [value, setValue] = useState('')
  const device = useMemo(deviceId, [])
  const menu = usePoll(api.menu, 30000)
  const mine = usePoll(() => api.myOrders(device), 15000, [device])
  const groups = groupByTab(menu.data?.drinks ?? [], menu.data?.categories ?? []).filter(([, list]) => list.length)
  const recent = (mine.data?.orders ?? []).slice(0, 5)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = value.trim()
    if (n) onJoin(n)
  }
  return (
    <main className="min-h-dvh flex flex-col items-center px-4 pt-10 pb-10 max-w-lg mx-auto">
      <Header />
      <form onSubmit={submit} className="card w-full max-w-sm mt-8 flex flex-col gap-4">
        <label className="text-lg font-semibold">What's your name?</label>
        <input
          className="input"
          autoFocus
          autoComplete="given-name"
          placeholder="e.g. Sam"
          value={value}
          maxLength={60}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="btn-primary text-lg" disabled={!value.trim()}>Let's drink</button>
        <p className="text-sm text-cocoa/60">So the bartenders know whose drink is whose. Your phone remembers it.</p>
      </form>

      {recent.length > 0 && (
        <section className="w-full mt-8">
          <h2 className="font-display text-xl mb-2">Recent orders from this phone</h2>
          <div className="flex flex-col gap-2">
            {recent.map((o) => <GuestOrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}

      <section className="w-full mt-8">
        <h2 className="font-display text-xl mb-2">On the menu tonight</h2>
        {!menu.data && !menu.error && <p className="text-cocoa/60">Loading the menu…</p>}
        {menu.error && !menu.data && <p className="text-cocoa/60">Can't reach the bar right now.</p>}
        {groups.map(([cat, list]) => (
          <div key={cat} className="mb-4">
            <h3 className="uppercase tracking-widest text-xs text-cocoa/60 mb-2">{cat}</h3>
            <div className="flex flex-col gap-2">
              {list.map((d) => (
                <div key={d.id} className={`card py-3 ${d.available ? '' : 'opacity-60'}`}>
                  <div className="font-semibold leading-tight">{d.name}</div>
                  {d.description && <div className="text-sm text-cocoa/60">{d.description}</div>}
                  {!d.available && <span className="pill bg-cocoa/10 text-cocoa/70 mt-1">Run out, sorry</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {menu.data && groups.length === 0 && <p className="text-cocoa/60">The bartenders are still writing the list.</p>}
      </section>

      <a href="/bar" className="btn-ghost mt-10 text-sm">Bartender login</a>
    </main>
  )
}

function Header() {
  return (
    <div className="text-center">
      <p className="uppercase tracking-[0.3em] text-xs text-cocoa/60">The wedding of</p>
      <h1 className="font-display text-4xl mt-1">Aria &amp; Jansen</h1>
    </div>
  )
}

function Menu({ name, onChangeName }: { name: string; onChangeName: () => void }) {
  const device = useMemo(deviceId, [])
  const menu = usePoll(api.menu, 15000)
  const mine = usePoll(() => api.myOrders(device), 5000, [device])
  const [cart, setCart] = useState<Cart>({})
  const [tab, setTab] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const drinks = menu.data?.drinks ?? []
  const settings = menu.data?.settings
  const categories = menu.data?.categories ?? []
  const mixers = menu.data?.mixers ?? []
  const spiritsCategory = menu.data?.spirits_category ?? 'Spirits'
  const strengths = menu.data?.strengths ?? []
  const tabs = groupByTab(drinks, categories)
  const activeTab = tabs.find(([c]) => c === tab)?.[0] ?? tabs[0]?.[0] ?? null
  const activeDrinks = tabs.find(([c]) => c === activeTab)?.[1] ?? []
  const count = cartCount(cart)
  const open = settings?.ordering_open !== false

  // New lines take the strength already chosen for that spirit, so Light/Stiff applies to every mixer of it.
  const bump = (drink_id: string, mixer: string | null, delta: number) =>
    setCart((c) => bumpCart(c, drink_id, mixer, delta, drinkStrength(c, drink_id)))
  const strengthFor = (drink_id: string, st: Strength | null) => setCart((c) => setStrength(c, drink_id, st))

  const flash = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 3500)
  }

  const placeOrder = async () => {
    const lines = cartLines(cart)
    if (!lines.length || busy) return
    setBusy(true)
    try {
      const order = await api.placeOrder(name, device, lines)
      setCart({})
      mine.setData((d) => ({ orders: [order, ...(d?.orders ?? [])] }))
      flash('ok', 'Ordered! A bartender will find you.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'That did not go through, try again')
      menu.refresh()
    } finally {
      setBusy(false)
    }
  }

  const orders = mine.data?.orders ?? []
  const openOrders = orders.filter((o) => ['new', 'making', 'ready'].includes(o.status))
  const doneOrders = orders.filter((o) => !['new', 'making', 'ready'].includes(o.status)).slice(0, 3)

  return (
    <main className="min-h-dvh pb-28 px-4 pt-6 max-w-lg mx-auto">
      <Header />
      <p className="text-center mt-3 text-cocoa/70">
        Hey {name}.{' '}
        <button className="underline underline-offset-2" onClick={onChangeName}>Not you?</button>
      </p>

      {settings?.last_orders && (
        <Banner tone="amber">Last orders! Get them in now.</Banner>
      )}
      {!open && (
        <Banner tone="cocoa">The bar's paused ordering for a few minutes. Hang tight.</Banner>
      )}
      {menu.error && !menu.data && (
        <Banner tone="cocoa">Can't reach the bar right now. Signal might be patchy, keep this page open.</Banner>
      )}

      {openOrders.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-xl mb-2">Your drinks</h2>
          <div className="flex flex-col gap-2">
            {openOrders.map((o) => <GuestOrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-display text-xl mb-2">Menu</h2>
        {!menu.data && !menu.error && <p className="text-cocoa/60">Loading the menu…</p>}

        {tabs.length > 0 && (
          <div className="flex gap-1 p-1 rounded-2xl bg-sand/60 mb-4">
            {tabs.map(([cat]) => (
              <button
                key={cat}
                onClick={() => setTab(cat)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${activeTab === cat ? 'bg-white shadow-sm text-cocoa' : 'text-cocoa/60'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {activeTab && (
          <>
            {activeTab === spiritsCategory && activeDrinks.length > 0 && (
              <p className="text-sm text-cocoa/60 mb-3">Pick a spirit, then what you'd like it with.</p>
            )}
            <DrinkRows
              key={activeTab}
              drinks={activeDrinks}
              cart={cart}
              onBump={bump}
              onStrength={strengthFor}
              isSpirit={activeTab === spiritsCategory}
              mixers={mixers}
              strengths={activeTab === spiritsCategory ? strengths : []}
              canOrder={(d) => d.available && open}
            />
          </>
        )}
      </section>

      {count > 0 && (
        <section className="mt-6">
          <CartSummary cart={cart} drinks={drinks} onBump={bump} label={itemLabel} />
        </section>
      )}

      {doneOrders.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-xl mb-2">Earlier</h2>
          <div className="flex flex-col gap-2 opacity-70">
            {doneOrders.map((o) => <GuestOrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}

      {count > 0 && open && (
        <div className="fixed inset-x-0 bottom-0 p-4 bg-gradient-to-t from-cream via-cream to-transparent">
          <button className="btn-primary w-full max-w-lg mx-auto flex text-lg shadow-lg" onClick={placeOrder} disabled={busy}>
            {busy ? 'Sending…' : `Order ${count} drink${count === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {toast && (
        <div className={`fixed top-4 inset-x-4 mx-auto max-w-md rounded-xl px-4 py-3 text-center font-semibold shadow-lg ${toast.kind === 'ok' ? 'bg-sage text-white' : 'bg-red-700 text-white'}`}>
          {toast.text}
        </div>
      )}
    </main>
  )
}

function Banner({ tone, children }: { tone: 'amber' | 'cocoa'; children: React.ReactNode }) {
  const cls = tone === 'amber' ? 'bg-amber text-white' : 'bg-cocoa text-cream'
  return <div className={`mt-4 rounded-xl px-4 py-3 text-center font-semibold ${cls}`}>{children}</div>
}

function GuestOrderCard({ order }: { order: Order }) {
  const label: Record<Order['status'], string> = {
    new: 'Waiting for a bartender',
    making: order.claimed_by ? `${order.claimed_by} is on it` : 'Being made',
    ready: order.claimed_by ? `Ready, ${order.claimed_by} is bringing it over` : 'Ready, coming your way',
    delivered: 'Delivered. Cheers!',
    cancelled: 'Cancelled',
  }
  const tone: Record<Order['status'], string> = {
    new: 'bg-sand text-cocoa',
    making: 'bg-amber/20 text-amber',
    ready: 'bg-sage/20 text-sage',
    delivered: 'bg-cocoa/10 text-cocoa/70',
    cancelled: 'bg-cocoa/10 text-cocoa/70',
  }
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold">
          {order.items.map((i) => (i.qty > 1 ? `${i.qty}× ` : '') + itemLabel(i.drink_name, i.mixer, i.strength)).join(', ')}
        </div>
        <span className="text-xs text-cocoa/50 whitespace-nowrap">{minutesAgo(order.created_at)} min ago</span>
      </div>
      <span className={`pill mt-2 ${tone[order.status]}`}>{label[order.status]}</span>
    </div>
  )
}
