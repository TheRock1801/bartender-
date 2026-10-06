import { useMemo, useState } from 'react'
import { api, deviceId, groupByCategory, minutesAgo, store, stored, type CartLine, type Order } from './api'
import { usePoll } from './usePoll'

const NAME_KEY = 'aj_guest_name'

export default function GuestApp() {
  const [name, setName] = useState(() => stored(NAME_KEY))
  if (!name) return <Join onJoin={(n) => { store(NAME_KEY, n); setName(n) }} />
  return <Menu name={name} onChangeName={() => { store(NAME_KEY, ''); setName('') }} />
}

function Join({ onJoin }: { onJoin: (name: string) => void }) {
  const [value, setValue] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = value.trim()
    if (n) onJoin(n)
  }
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
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
  const [cart, setCart] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const drinks = menu.data?.drinks ?? []
  const settings = menu.data?.settings
  const groups = groupByCategory(drinks)
  const cartLines: CartLine[] = Object.entries(cart).filter(([, q]) => q > 0).map(([drink_id, qty]) => ({ drink_id, qty }))
  const cartCount = cartLines.reduce((n, l) => n + l.qty, 0)
  const open = settings?.ordering_open !== false

  const bump = (id: string, delta: number) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(10, (c[id] || 0) + delta)) }))

  const flash = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 3500)
  }

  const placeOrder = async () => {
    if (!cartLines.length || busy) return
    setBusy(true)
    try {
      const order = await api.placeOrder(name, device, cartLines)
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
        {groups.map(([cat, list]) => (
          <div key={cat} className="mb-5">
            <h3 className="uppercase tracking-widest text-xs text-cocoa/60 mb-2">{cat}</h3>
            <div className="flex flex-col gap-2">
              {list.map((d) => {
                const qty = cart[d.id] || 0
                const off = !d.available || !open
                return (
                  <div key={d.id} className={`card flex items-center gap-3 ${off ? 'opacity-60' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-lg leading-tight">{d.name}</div>
                      {d.description && <div className="text-sm text-cocoa/60">{d.description}</div>}
                      {!d.available && <span className="pill bg-cocoa/10 text-cocoa/70 mt-1">Run out, sorry</span>}
                    </div>
                    {off ? null : qty === 0 ? (
                      <button className="btn-soft px-5" onClick={() => bump(d.id, 1)}>Add</button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button className="btn-soft w-11 h-11 !px-0 text-xl" onClick={() => bump(d.id, -1)} aria-label="Fewer">−</button>
                        <span className="w-7 text-center text-lg font-semibold">{qty}</span>
                        <button className="btn-soft w-11 h-11 !px-0 text-xl" onClick={() => bump(d.id, 1)} aria-label="More">+</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      {doneOrders.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-xl mb-2">Earlier</h2>
          <div className="flex flex-col gap-2 opacity-70">
            {doneOrders.map((o) => <GuestOrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}

      {cartCount > 0 && open && (
        <div className="fixed inset-x-0 bottom-0 p-4 bg-gradient-to-t from-cream via-cream to-transparent">
          <button className="btn-primary w-full max-w-lg mx-auto flex text-lg shadow-lg" onClick={placeOrder} disabled={busy}>
            {busy ? 'Sending…' : `Order ${cartCount} drink${cartCount === 1 ? '' : 's'}`}
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
          {order.items.map((i) => (i.qty > 1 ? `${i.qty}× ` : '') + i.drink_name).join(', ')}
        </div>
        <span className="text-xs text-cocoa/50 whitespace-nowrap">{minutesAgo(order.created_at)} min ago</span>
      </div>
      <span className={`pill mt-2 ${tone[order.status]}`}>{label[order.status]}</span>
    </div>
  )
}
