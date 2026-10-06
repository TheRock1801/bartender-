import { useEffect, useMemo, useState } from 'react'
import { api, deviceId, minutesAgo, store, stored, storeJson, storedJson, type Drink, type Favourite, type Guest, type MenuPayload, type Order, type PrefKey, type Prefs, type Strength } from './api'
import { bumpCart, cartCount, cartLines, groupByTab, itemLabel, resolveMixer, setStrength, type Cart } from './cart'
import { CartSummary, DrinkRows } from './DrinkRows'
import { usePoll } from './usePoll'

const NAME_KEY = 'aj_guest_name'
const PREFS_KEY = 'aj_prefs'
const FAV_KEY = 'aj_fav'

const DEFAULT_PREFS: Prefs = { coke: 'fat', lemonade: 'fat', water: 'still' }
const fullPrefs = (p: Partial<Prefs> | null | undefined): Prefs | null => (p ? { ...DEFAULT_PREFS, ...p } : null)

export default function GuestApp() {
  const device = useMemo(deviceId, [])
  const [name, setName] = useState(() => stored(NAME_KEY))
  // The phone keeps a copy for instant load; the server copy (keyed by name) wins when it answers.
  const [prefs, setPrefs] = useState<Prefs | null>(() => storedJson<Prefs>(PREFS_KEY))
  const [fav, setFav] = useState<Favourite | null>(() => storedJson<Favourite>(FAV_KEY))
  const [editingFlavour, setEditingFlavour] = useState(false)

  const applyGuest = (gst: Guest) => {
    store(NAME_KEY, gst.name); setName(gst.name)
    const p = fullPrefs(gst.prefs)
    storeJson(PREFS_KEY, p); setPrefs(p)
    storeJson(FAV_KEY, gst.favourite); setFav(gst.favourite)
  }

  // Returning phone: refresh from the server. A name that predates the guest registry is registered now.
  useEffect(() => {
    if (!name) return
    let alive = true
    api.guests.me(name)
      .catch((e: Error & { status?: number }) => (e.status === 404 ? api.guests.join(name, device, true) : Promise.reject(e)))
      .then((gst) => { if (alive) applyGuest(gst) })
      .catch(() => { /* offline: keep the phone's copy */ })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])

  if (!name) return <Join device={device} onJoin={applyGuest} />
  if (!prefs || editingFlavour) {
    return (
      <Flavour
        name={name}
        prefs={prefs}
        fav={fav}
        onDone={(p, f) => {
          storeJson(PREFS_KEY, p); setPrefs(p)
          storeJson(FAV_KEY, f); setFav(f)
          setEditingFlavour(false)
          api.guests.save(name, { prefs: p, favourite: f }).catch(() => { /* phone copy still applies */ })
        }}
      />
    )
  }
  return (
    <Menu
      name={name}
      prefs={prefs}
      fav={fav}
      onChangeName={() => { store(NAME_KEY, ''); setName('') }}
      onEditFlavour={() => setEditingFlavour(true)}
    />
  )
}

function Header() {
  return (
    <div className="w-full">
      <p className="eyebrow">jansen and aria · drinks</p>
      <h1 className="display text-[2.75rem] mt-2">aria &amp; jansen.</h1>
    </div>
  )
}

// ---- Step 1: name ----

function Join({ device, onJoin }: { device: string; onJoin: (guest: Guest) => void }) {
  const [value, setValue] = useState('')
  const [initial, setInitial] = useState('')
  // taken: a guest with this name already exists. Either it's them (logged out, new phone) or another person.
  const [taken, setTaken] = useState<{ name: string; addInitial: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const menu = usePoll(api.menu, 30000)
  const mine = usePoll(() => api.ordersFromDevice(device), 15000, [device])
  const groups = groupByTab(menu.data?.drinks ?? [], menu.data?.categories ?? []).filter(([, list]) => list.length)
  const recent = (mine.data?.orders ?? []).slice(0, 5)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('')
    try { await fn() } catch (e) { setErr(e instanceof Error ? e.message : 'That did not go through, try again') } finally { setBusy(false) }
  }
  // Try a name: new -> join straight away; taken -> ask.
  const tryName = (n: string) => run(async () => {
    const found = await api.guests.lookup(n)
    if (found.exists) { setTaken({ name: found.name, addInitial: false }); return }
    onJoin(await api.guests.join(n, device))
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = value.trim()
    if (n) tryName(n)
  }
  const itsMe = () => taken && run(async () => onJoin(await api.guests.join(taken.name, device, true)))
  const withInitial = (e: React.FormEvent) => {
    e.preventDefault()
    const i = initial.trim().replace(/[^a-z]/gi, '').slice(0, 1).toUpperCase()
    if (taken && i) tryName(`${taken.name} ${i}`)
  }

  return (
    <main className="min-h-dvh flex flex-col px-6 pt-12 pb-12 max-w-lg mx-auto">
      <Header />
      {!taken ? (
        <form onSubmit={submit} className="w-full mt-10 flex flex-col gap-4 divider pt-6">
          <label className="display text-2xl" htmlFor="guest-name">what's your name?</label>
          <input
            id="guest-name"
            className="input"
            autoFocus
            autoComplete="given-name"
            placeholder="e.g. Sam"
            value={value}
            maxLength={60}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="btn-primary text-lg" disabled={!value.trim() || busy}>{busy ? 'one sec…' : "let's drink"}</button>
          {err && <p className="font-mono text-xs text-amber">{err}</p>}
          <p className="text-sm text-cocoa/60">Your name is your login. Type it again on any phone and your drinks and favourite come back.</p>
        </form>
      ) : !taken.addInitial ? (
        <section className="w-full mt-10 flex flex-col gap-4 divider pt-6">
          <h2 className="display text-2xl">there's already a {taken.name} here.</h2>
          <p className="text-sm text-cocoa/60">Is that you? Say yes and your drinks and favourite come back on this phone.</p>
          <button className="btn-primary text-lg" disabled={busy} onClick={itsMe}>{busy ? 'one sec…' : "yes, that's me"}</button>
          <button className="btn-soft" disabled={busy} onClick={() => setTaken({ ...taken, addInitial: true })}>no, I'm a different {taken.name}</button>
          <button className="btn-ghost self-start px-0 font-mono text-xs lowercase" onClick={() => { setTaken(null); setErr('') }}>← back</button>
          {err && <p className="font-mono text-xs text-amber">{err}</p>}
        </section>
      ) : (
        <form onSubmit={withInitial} className="w-full mt-10 flex flex-col gap-4 divider pt-6">
          <label className="display text-2xl" htmlFor="guest-initial">add your last name initial.</label>
          <p className="text-sm text-cocoa/60">So the bar can tell the two of you apart. You'll be "{taken.name} {initial.trim().slice(0, 1).toUpperCase() || '_'}".</p>
          <input
            id="guest-initial"
            className="input uppercase tracking-widest"
            autoFocus
            placeholder="B"
            value={initial}
            maxLength={1}
            onChange={(e) => setInitial(e.target.value)}
          />
          <button className="btn-primary text-lg" disabled={!initial.trim() || busy}>{busy ? 'one sec…' : "let's drink"}</button>
          <button type="button" className="btn-ghost self-start px-0 font-mono text-xs lowercase" onClick={() => { setTaken({ ...taken, addInitial: false }); setErr('') }}>← back</button>
          {err && <p className="font-mono text-xs text-amber">{err}</p>}
        </form>
      )}

      {recent.length > 0 && (
        <section className="w-full mt-10 divider pt-6">
          <h2 className="display text-2xl mb-3">recent orders from this phone.</h2>
          <div className="flex flex-col gap-2">
            {recent.map((o) => <GuestOrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}

      <section className="w-full mt-10 divider pt-6">
        <h2 className="display text-2xl mb-3">on the menu tonight.</h2>
        {!menu.data && !menu.error && <p className="text-cocoa/60">Loading the menu…</p>}
        {menu.error && !menu.data && <p className="text-cocoa/60">Can't reach the bar right now.</p>}
        {groups.map(([cat, list]) => (
          <div key={cat} className="mb-5">
            <h3 className="label mb-1">{cat.toLowerCase()}</h3>
            <div className="flex flex-col">
              {list.map((d) => (
                <div key={d.id} className={`row ${d.available ? '' : 'opacity-60'}`}>
                  <div className="font-semibold leading-tight">{d.name}</div>
                  {d.description && <div className="text-sm text-cocoa/60">{d.description}</div>}
                  {!d.available && <span className="pill bg-sand/70 text-cocoa/80 mt-1">Run out, sorry</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {menu.data && groups.length === 0 && <p className="text-cocoa/60">The bartenders are still writing the list.</p>}
      </section>

      <a href="/bar" className="btn-ghost mt-12 text-sm self-start px-0 font-mono lowercase">bartender login →</a>
    </main>
  )
}

// ---- Step 2: flavour + favourite ----

const PREF_LABELS: Record<PrefKey, { title: string; options: [string, string] }> = {
  coke: { title: 'coke', options: ['fat', 'skinny'] },
  lemonade: { title: 'lemonade', options: ['fat', 'skinny'] },
  water: { title: 'water', options: ['still', 'sparkling'] },
}

function Flavour({ name, prefs, fav, onDone }: {
  name: string
  prefs: Prefs | null
  fav: Favourite | null
  onDone: (prefs: Prefs, fav: Favourite | null) => void
}) {
  const menu = usePoll(api.menu, 30000)
  const [draft, setDraft] = useState<Prefs>(prefs ?? { coke: 'fat', lemonade: 'fat', water: 'still' })
  const [favDraft, setFavDraft] = useState<Favourite | null>(fav)
  const [picking, setPicking] = useState(false)
  const drinks = menu.data?.drinks ?? []
  const favDrink = favDraft ? drinks.find((d) => d.id === favDraft.drink_id) : undefined

  return (
    <main className="min-h-dvh flex flex-col px-6 pt-12 pb-12 max-w-lg mx-auto">
      <Header />
      <section className="mt-10 divider pt-6">
        <p className="eyebrow">hey {name}</p>
        <h2 className="display text-3xl mt-2">what's your flavour?</h2>
        <p className="text-sm text-cocoa/60 mt-2">Set once, remembered on this phone. The bar pours it your way without asking.</p>

        <div className="mt-6 flex flex-col gap-5">
          {(Object.keys(PREF_LABELS) as PrefKey[]).map((k) => (
            <div key={k}>
              <p className="label mb-2">{PREF_LABELS[k].title}</p>
              <Slide
                options={PREF_LABELS[k].options}
                value={draft[k]}
                onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 divider pt-6">
        <h2 className="display text-3xl">add your favourite.</h2>
        <p className="text-sm text-cocoa/60 mt-2">It sits at the top of your menu for a one-tap order.</p>

        {favDraft && favDrink && !picking ? (
          <div className="card mt-5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="label">your favourite</p>
              <p className="font-display font-bold text-xl tracking-tight mt-1">{itemLabel(favDrink.name, resolveMixer(favDraft.mixer, draft), favDraft.strength)}</p>
            </div>
            <button className="btn-soft py-2" onClick={() => setPicking(true)}>change</button>
          </div>
        ) : picking || !favDraft ? (
          menu.data ? (
            <FavouritePicker
              menu={menu.data}
              prefs={draft}
              initial={favDraft}
              onPick={(f) => { setFavDraft(f); setPicking(false) }}
              onCancel={favDraft ? () => setPicking(false) : undefined}
            />
          ) : (
            <p className="font-mono text-sm text-cocoa/60 mt-4">loading the menu…</p>
          )
        ) : null}
      </section>

      <div className="mt-10 flex flex-col gap-3">
        <button className="btn-primary text-lg" onClick={() => onDone(draft, favDraft)}>
          {favDraft ? 'done, show me the menu' : 'skip the favourite, show me the menu'}
        </button>
      </div>
    </main>
  )
}

// Two-option slide toggle: one row, a soft indicator slides under the chosen side.
function Slide({ options, value, onChange }: { options: [string, string]; value: string; onChange: (v: string) => void }) {
  const idx = options.indexOf(value)
  return (
    <div className="relative grid grid-cols-2 rounded border border-taupe/60 p-1 select-none" role="radiogroup">
      <div
        className="absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded bg-cocoa transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${idx <= 0 ? 0 : 'calc(100% + 0.25rem)'})`, left: '0.25rem' }}
        aria-hidden="true"
      />
      {options.map((o) => (
        <button
          key={o}
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={`relative z-10 py-2.5 font-mono text-sm lowercase transition-colors ${value === o ? 'text-cream' : 'text-cocoa/70'}`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

// Pick one drink (plus mixer and pour for a spirit) as the favourite.
function FavouritePicker({ menu, prefs, initial, onPick, onCancel }: {
  menu: MenuPayload
  prefs: Prefs
  initial: Favourite | null
  onPick: (f: Favourite) => void
  onCancel?: () => void
}) {
  const tabs = groupByTab(menu.drinks, menu.categories)
  const initialDrink = initial ? menu.drinks.find((d) => d.id === initial.drink_id) : undefined
  const [tab, setTab] = useState<string>(initialDrink?.category ?? tabs[0]?.[0] ?? '')
  const [drinkId, setDrinkId] = useState<string | null>(initial?.drink_id ?? null)
  const [mixer, setMixer] = useState<string | null>(initial?.mixer ?? null)
  const [strength, setStrengthPick] = useState<Strength | null>(initial?.strength ?? null)
  const drink = menu.drinks.find((d) => d.id === drinkId)
  const isSpirit = drink?.category === menu.spirits_category
  const ready = !!drink && (!isSpirit || !!mixer)
  const list = tabs.find(([c]) => c === tab)?.[1] ?? []

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="flex gap-6 border-b border-taupe/30 overflow-x-auto">
        {tabs.map(([cat]) => (
          <button key={cat} onClick={() => setTab(cat)} className={`pb-2 -mb-px whitespace-nowrap font-display font-bold text-base tracking-tight border-b-2 ${tab === cat ? 'border-cocoa text-cocoa' : 'border-transparent text-cocoa/50'}`}>
            {cat.toLowerCase()}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((d) => (
          <button
            key={d.id}
            onClick={() => { setDrinkId(d.id); if (d.category !== menu.spirits_category) { setMixer(null); setStrengthPick(null) } }}
            className={`rounded border px-3 py-2 font-semibold text-sm ${drinkId === d.id ? 'bg-cocoa text-cream border-cocoa' : 'border-taupe/60'}`}
          >
            {d.name}
          </button>
        ))}
        {!list.length && <p className="font-mono text-sm text-cocoa/60">nothing here yet.</p>}
      </div>

      {drink && isSpirit && (
        <>
          <div>
            <p className="label mb-2">pour</p>
            <div className="flex items-center gap-2">
              {menu.strengths.map((st) => (
                <button key={st} onClick={() => setStrengthPick(strength === st ? null : st)} className={`rounded border px-3 py-1.5 font-mono text-xs lowercase ${strength === st ? 'bg-amber text-cream border-amber' : 'border-taupe/60'}`} aria-pressed={strength === st}>{st}</button>
              ))}
              {!strength && <span className="font-mono text-xs text-cocoa/50">regular</span>}
            </div>
          </div>
          <div>
            <p className="label mb-2">{drink.name} with…</p>
            <div className="flex flex-wrap gap-2">
              {menu.mixers.map((m) => (
                <button key={m} onClick={() => setMixer(m)} className={`rounded border px-3 py-2 font-mono text-xs lowercase ${mixer === m ? 'bg-cocoa text-cream border-cocoa' : 'border-taupe/60'}`} aria-pressed={mixer === m}>
                  {m === 'Rocks' ? 'on the rocks' : (resolveMixer(m, prefs) ?? m).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={!ready} onClick={() => drink && onPick({ drink_id: drink.id, mixer: isSpirit ? mixer : null, strength: isSpirit ? strength : null })}>
          {drink ? `save ${itemLabel(drink.name, isSpirit ? resolveMixer(mixer, prefs) : null, isSpirit ? strength : null).toLowerCase()}` : 'pick a drink'}
        </button>
        {onCancel && <button className="btn-soft" onClick={onCancel}>cancel</button>}
      </div>
    </div>
  )
}

// ---- Step 3: the menu ----

function Menu({ name, prefs, fav, onChangeName, onEditFlavour }: {
  name: string
  prefs: Prefs
  fav: Favourite | null
  onChangeName: () => void
  onEditFlavour: () => void
}) {
  const device = useMemo(deviceId, [])
  const menu = usePoll(api.menu, 15000)
  const mine = usePoll(() => api.myOrders(name), 5000, [name])
  const [cart, setCart] = useState<Cart>({})
  const [tab, setTab] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState(false)
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
  const favDrink: Drink | undefined = fav ? drinks.find((d) => d.id === fav.drink_id) : undefined

  // Labels show the guest's own flavour ("Bourbon & Skinny Coke"); the order stores the base mixer
  // and the server resolves it the same way from the prefs we send.
  const label = (n: string, mixer: string | null, strength: Strength | null) => itemLabel(n, resolveMixer(mixer, prefs), strength)
  const mixerLabel = (m: string) => resolveMixer(m, prefs) ?? m

  const bump = (drink_id: string, mixer: string | null, delta: number, strength: Strength | null) =>
    setCart((c) => bumpCart(c, drink_id, mixer, delta, strength))
  // Changing the pour moves every line of that spirit already in the order.
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
      const order = await api.placeOrder(name, device, lines, prefs)
      setCart({})
      setReview(false)
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
    <main className="min-h-dvh pb-28 px-6 pt-8 max-w-lg mx-auto">
      <Header />
      <p className="mt-4 font-mono text-sm text-cocoa/70">
        hey {name}.{' '}
        <button className="underline underline-offset-4" onClick={onChangeName}>log out</button>
        {' · '}
        <button className="underline underline-offset-4" onClick={onEditFlavour}>your flavour</button>
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

      {fav && favDrink && (
        <section className="mt-8 divider pt-5">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="label">your favourite</p>
              <p className="font-display font-extrabold text-2xl tracking-tightest mt-1">{label(favDrink.name, fav.mixer, fav.strength)}</p>
              {!favDrink.available && <span className="pill bg-sand/70 text-cocoa/80 mt-1">Run out, sorry</span>}
            </div>
            <button
              className="btn-primary px-5"
              disabled={!favDrink.available || !open}
              onClick={() => bump(favDrink.id, fav.mixer, 1, fav.strength)}
            >
              add one
            </button>
          </div>
          <button className="btn-ghost px-0 mt-1 font-mono text-xs lowercase" onClick={onEditFlavour}>change favourite</button>
        </section>
      )}

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
        {!menu.data && !menu.error && <p className="text-cocoa/60">Loading the menu…</p>}

        {tabs.length > 0 && (
          <div className="flex gap-6 border-b border-taupe/30 mb-5 overflow-x-auto">
            {tabs.map(([cat]) => (
              <button
                key={cat}
                onClick={() => setTab(cat)}
                className={`pb-2 -mb-px whitespace-nowrap font-display font-bold text-lg tracking-tight border-b-2 transition ${activeTab === cat ? 'border-cocoa text-cocoa' : 'border-transparent text-cocoa/50'}`}
                aria-pressed={activeTab === cat}
              >
                {cat.toLowerCase()}
              </button>
            ))}
          </div>
        )}

        {activeTab && (
          <>
            {activeTab === spiritsCategory && activeDrinks.length > 0 && (
              <p className="font-mono text-xs text-cocoa/60 mb-3">pick a spirit, then what you'd like it with.</p>
            )}
            <DrinkRows
              key={activeTab}
              drinks={activeDrinks}
              cart={cart}
              onBump={bump}
              onStrength={strengthFor}
              isSpirit={activeTab === spiritsCategory}
              mixers={mixers}
              mixerLabel={mixerLabel}
              strengths={activeTab === spiritsCategory ? strengths : []}
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

      {count > 0 && open && !review && (
        <div className="fixed inset-x-0 bottom-0 p-4 bg-gradient-to-t from-cream via-cream to-transparent">
          <div className="max-w-lg mx-auto flex gap-2 fade-up">
            <button
              className="btn-soft px-4 text-lg font-mono !bg-cream"
              onClick={() => setReview(true)}
              aria-label={`Review your ${count} drink${count === 1 ? '' : 's'}`}
            >
              +{count}
            </button>
            <button className="btn-primary flex-1 text-lg" onClick={placeOrder} disabled={busy}>
              {busy ? 'sending…' : 'complete order'}
            </button>
          </div>
        </div>
      )}

      {review && (
        <div className="fixed inset-0 z-20 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Your order">
          <button className="absolute inset-0 bg-cocoa/40" onClick={() => setReview(false)} aria-label="Close" />
          <div className="relative w-full max-w-lg bg-cream rounded-t-lg border border-taupe/40 p-6 pb-8 max-h-[85dvh] overflow-y-auto fade-up">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="display text-3xl">your order.</h2>
              <button className="btn-soft w-10 h-10 !px-0 text-xl shrink-0" onClick={() => setReview(false)} aria-label="Close">×</button>
            </div>
            <CartSummary cart={cart} drinks={drinks} onBump={bump} label={label} title="" />
            <p className="font-mono text-xs text-cocoa/60 mt-3">tap − to take something off. everything at zero disappears.</p>
            <div className="mt-5 flex gap-2">
              <button className="btn-soft" onClick={() => setReview(false)}>add more</button>
              <button className="btn-primary flex-1 text-lg" onClick={placeOrder} disabled={busy || count === 0 || !open}>
                {busy ? 'sending…' : count === 0 ? 'nothing to order' : 'complete order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed top-4 inset-x-4 mx-auto max-w-md rounded px-4 py-3 text-center font-semibold fade-up ${toast.kind === 'ok' ? 'bg-sage text-cream' : 'bg-amber text-cream'}`}>
          {toast.text}
        </div>
      )}
    </main>
  )
}

function Banner({ tone, children }: { tone: 'amber' | 'cocoa'; children: React.ReactNode }) {
  const cls = tone === 'amber' ? 'bg-amber text-cream' : 'bg-taupe text-cream'
  return <div className={`mt-5 rounded px-4 py-3 font-medium ${cls}`}>{children}</div>
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
    delivered: 'bg-sand/70 text-cocoa/80',
    cancelled: 'bg-sand/70 text-cocoa/80',
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
