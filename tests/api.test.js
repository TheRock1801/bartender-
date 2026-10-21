import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { buildApp } from '../api/index.js'
import { memoryStore } from '../lib/store.js'

const PIN = '4321'
let base
let server

before(async () => {
  const app = buildApp(memoryStore(), { barPin: PIN })
  server = createServer(app)
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())

async function call(path, { method = 'GET', body, pin } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(pin ? { 'x-bar-pin': pin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json() }
}

const guestOrder = (items, extra = {}) =>
  call('/api/orders', { method: 'POST', body: { guest_name: 'Sarah', device_id: 'dev-1', items, ...extra } })

test('menu is seeded with the mood-board spirits, four tabs, the mixer list and ordering open', async () => {
  const { status, body } = await call('/api/menu')
  assert.equal(status, 200)
  assert.deepEqual(body.categories, ['Spirits', 'Cocktails', 'Beer & Wine', 'Non-alcoholic'])
  assert.deepEqual(body.drinks.filter((d) => d.category === 'Spirits').map((d) => d.name), ['Whiskey', 'Bourbon', 'Gin', 'Vodka', 'Rum', 'Brandy', 'Cognac'])
  assert.deepEqual(body.mixers, ['Coke', 'Coke Zero', 'Lemonade', 'Dry Ginger Ale', 'Soda Water', 'Tonic Water', 'Ginger Beer', 'Orange juice', 'Pineapple juice', 'Cranberry juice', 'On the rocks'])
  assert.equal(body.other_mixer, 'Other')
  assert.deepEqual(body.strengths, ['light', 'stiff'])
  assert.deepEqual(body.fulfilments, ['collect', 'deliver'])
  assert.equal(body.settings.ordering_open, true)
})

test('bartender routes need the PIN', async () => {
  assert.equal((await call('/api/bar/orders')).status, 401)
  assert.equal((await call('/api/bar/orders', { pin: 'wrong' })).status, 401)
  assert.equal((await call('/api/bar/login', { method: 'POST', pin: PIN })).status, 200)
})

test('guest orders, bartender claims, readies, delivers; order numbers count up', async () => {
  const { drinks } = (await call('/api/menu')).body
  const spritz = drinks.find((d) => d.name === 'Aperol Spritz'), bourbon = drinks.find((d) => d.name === 'Bourbon')
  const placed = await guestOrder([{ drink_id: spritz.id, qty: 2 }, { drink_id: bourbon.id, qty: 1, mixer: 'Coke' }, { drink_id: spritz.id, qty: 1 }])
  assert.equal(placed.status, 201)
  assert.equal(placed.body.status, 'new')
  assert.equal(placed.body.order_no, 1)
  assert.equal(placed.body.fulfilment, 'collect')
  assert.equal(placed.body.table_no, null)
  // duplicate lines are merged
  assert.deepEqual(placed.body.items.map((i) => [i.drink_name, i.mixer, i.qty]), [['Aperol Spritz', null, 3], ['Bourbon', 'Coke', 1]])

  const second = await guestOrder([{ drink_id: spritz.id }])
  assert.equal(second.body.order_no, 2)

  const mine = await call('/api/orders/mine?device_id=dev-1')
  assert.equal(mine.body.orders.length, 2)
  assert.equal(mine.body.orders[0].order_no, 2) // newest first

  const queue = await call('/api/bar/orders', { pin: PIN })
  assert.equal(queue.body.orders.length, 2)

  const id = placed.body.id
  const claimed = await call(`/api/bar/orders/${id}`, { method: 'PATCH', pin: PIN, body: { action: 'claim', by: 'Rocky' } })
  assert.equal(claimed.body.status, 'making')
  assert.equal(claimed.body.claimed_by, 'Rocky')

  // someone else cannot steal it while in progress
  const steal = await call(`/api/bar/orders/${id}`, { method: 'PATCH', pin: PIN, body: { action: 'claim', by: 'Jess' } })
  assert.equal(steal.status, 409)

  const ready = await call(`/api/bar/orders/${id}`, { method: 'PATCH', pin: PIN, body: { action: 'ready', by: 'Rocky' } })
  assert.equal(ready.body.status, 'ready')
  const done = await call(`/api/bar/orders/${id}`, { method: 'PATCH', pin: PIN, body: { action: 'delivered', by: 'Jess' } })
  assert.equal(done.body.status, 'delivered')
  assert.equal(done.body.claimed_by, 'Rocky')

  // delivered orders leave the open queue but are still there with ?all=1, and the guest still sees them
  assert.equal((await call('/api/bar/orders', { pin: PIN })).body.orders.length, 1)
  assert.equal((await call('/api/bar/orders?all=1', { pin: PIN })).body.orders.length, 2)
  assert.equal((await call('/api/orders/mine?device_id=dev-1')).body.orders.find((o) => o.id === id).status, 'delivered')
})

test('deliver to table needs a table number; collect ignores one', async () => {
  const { drinks } = (await call('/api/menu')).body
  const beer = drinks.find((d) => d.name === 'Beer')
  const noTable = await guestOrder([{ drink_id: beer.id }], { fulfilment: 'deliver' })
  assert.equal(noTable.status, 400)
  assert.match(noTable.body.error, /table/i)
  assert.equal((await guestOrder([{ drink_id: beer.id }], { fulfilment: 'teleport' })).status, 400)

  const deliver = await guestOrder([{ drink_id: beer.id }], { fulfilment: 'deliver', table_no: ' 4 ' })
  assert.equal(deliver.status, 201)
  assert.equal(deliver.body.fulfilment, 'deliver')
  assert.equal(deliver.body.table_no, '4')

  const collect = await guestOrder([{ drink_id: beer.id }], { fulfilment: 'collect', table_no: '9' })
  assert.equal(collect.body.fulfilment, 'collect')
  assert.equal(collect.body.table_no, null)

  // a bartender's verbal order carries the same details
  const verbal = await call('/api/bar/orders', { method: 'POST', pin: PIN, body: { guest_name: 'Al', placed_by: 'Rocky', fulfilment: 'deliver', table_no: '12', items: [{ drink_id: beer.id }] } })
  assert.equal(verbal.status, 201)
  assert.equal(verbal.body.table_no, '12')
  assert.equal(verbal.body.placed_by, 'Rocky')
})

test('guest order is rejected without a name or with an empty cart', async () => {
  const { drinks } = (await call('/api/menu')).body
  assert.equal((await call('/api/orders', { method: 'POST', body: { guest_name: '', device_id: 'd', items: [{ drink_id: drinks[0].id }] } })).status, 400)
  assert.equal((await call('/api/orders', { method: 'POST', body: { guest_name: 'Al', device_id: 'd', items: [] } })).status, 400)
  assert.equal((await call('/api/orders', { method: 'POST', body: { guest_name: 'Al', device_id: 'd', items: [{ drink_id: 'nope' }] } })).status, 400)
})

test('run-out drinks cannot be ordered by guests but can be recorded by a bartender', async () => {
  const { drinks } = (await call('/api/menu')).body
  const wine = drinks.find((d) => d.name === 'Red wine')
  const off = await call(`/api/bar/drinks/${wine.id}`, { method: 'PATCH', pin: PIN, body: { available: false } })
  assert.equal(off.body.available, false)

  const guest = await guestOrder([{ drink_id: wine.id }])
  assert.equal(guest.status, 400)
  assert.match(guest.body.error, /run out/)

  const verbal = await call('/api/bar/orders', { method: 'POST', pin: PIN, body: { guest_name: 'Al', placed_by: 'Rocky', items: [{ drink_id: wine.id }] } })
  assert.equal(verbal.status, 201)

  await call(`/api/bar/drinks/${wine.id}`, { method: 'PATCH', pin: PIN, body: { available: true } })
})

test('pausing ordering blocks guests, resuming lets them through; last orders flag round-trips', async () => {
  const { drinks } = (await call('/api/menu')).body
  const paused = await call('/api/bar/settings', { method: 'PATCH', pin: PIN, body: { ordering_open: false, last_orders: true } })
  assert.deepEqual(paused.body, { ordering_open: false, last_orders: true })
  assert.equal((await call('/api/menu')).body.settings.last_orders, true)

  const blocked = await guestOrder([{ drink_id: drinks[0].id, mixer: 'Coke' }])
  assert.equal(blocked.status, 409)

  await call('/api/bar/settings', { method: 'PATCH', pin: PIN, body: { ordering_open: true } })
  const ok = await guestOrder([{ drink_id: drinks[0].id, mixer: 'Coke' }])
  assert.equal(ok.status, 201)
})

test('a bartender can add a drink and it shows on the guest menu immediately', async () => {
  const added = await call('/api/bar/drinks', { method: 'POST', pin: PIN, body: { name: 'Negroni', description: 'Gin, Campari, sweet vermouth', category: 'Cocktails', added_by: 'Rocky' } })
  assert.equal(added.status, 201)
  const { drinks } = (await call('/api/menu')).body
  const em = drinks.find((d) => d.name === 'Negroni')
  assert.ok(em)
  assert.equal(em.available, true)
  assert.equal(em.added_by, 'Rocky')
  assert.equal((await call('/api/bar/drinks', { method: 'POST', pin: PIN, body: { name: '  ' } })).status, 400)
  // unknown category falls back to Cocktails
  const odd = await call('/api/bar/drinks', { method: 'POST', pin: PIN, body: { name: 'Hot chocolate', category: 'Hot Drinks' } })
  assert.equal(odd.body.category, 'Cocktails')
})

test('drink instructions save on add and edit, tally counts non-cancelled orders, remove deletes', async () => {
  const added = await call('/api/bar/drinks', { method: 'POST', pin: PIN, body: { name: 'Margarita', category: 'Cocktails', instructions: '50 tequila\n25 lime\n20 triple sec, shake' } })
  assert.equal(added.status, 201)
  assert.equal(added.body.instructions, '50 tequila\n25 lime\n20 triple sec, shake')

  const edited = await call(`/api/bar/drinks/${added.body.id}`, { method: 'PATCH', pin: PIN, body: { instructions: 'Shake hard, salt rim' } })
  assert.equal(edited.body.instructions, 'Shake hard, salt rim')

  const o1 = await call('/api/orders', { method: 'POST', body: { guest_name: 'Tal', device_id: 'dev-t', items: [{ drink_id: added.body.id, qty: 2 }] } })
  const o2 = await call('/api/orders', { method: 'POST', body: { guest_name: 'Tal', device_id: 'dev-t', items: [{ drink_id: added.body.id, qty: 5 }] } })
  assert.equal(o1.status, 201)
  await call(`/api/bar/orders/${o2.body.id}`, { method: 'PATCH', pin: PIN, body: { action: 'cancel', by: 'Rocky' } })
  const queue = await call('/api/bar/orders', { pin: PIN })
  assert.equal(queue.body.tally[added.body.id], 2)

  const removed = await call(`/api/bar/drinks/${added.body.id}`, { method: 'DELETE', pin: PIN })
  assert.equal(removed.status, 200)
  assert.equal((await call(`/api/bar/drinks/${added.body.id}`, { method: 'DELETE', pin: PIN })).status, 404)
  const menu = await call('/api/menu')
  assert.ok(!menu.body.drinks.some((d) => d.id === added.body.id))
  // the past order still names the drink
  const all = await call('/api/bar/orders?all=1', { pin: PIN })
  const past = all.body.orders.find((o) => o.id === o1.body.id)
  assert.equal(past.items[0].drink_name, 'Margarita')
  assert.equal(past.items[0].drink_id, null)
})

test('spirits need a mixer from the list or "Other: …", other drinks refuse one, lines merge per mixer', async () => {
  const { drinks } = (await call('/api/menu')).body
  const bourbon = drinks.find((d) => d.name === 'Bourbon')
  const beer = drinks.find((d) => d.name === 'Beer')

  assert.equal((await guestOrder([{ drink_id: bourbon.id, qty: 1 }])).status, 400)
  assert.equal((await guestOrder([{ drink_id: bourbon.id, qty: 1, mixer: 'Milk' }])).status, 400)
  assert.equal((await guestOrder([{ drink_id: bourbon.id, qty: 1, mixer: 'Other' }])).status, 400)
  assert.equal((await guestOrder([{ drink_id: bourbon.id, qty: 1, mixer: 'Other: ' }])).status, 400)
  assert.equal((await guestOrder([{ drink_id: beer.id, qty: 1, mixer: 'Coke' }])).status, 400)

  const ok = await guestOrder([
    { drink_id: bourbon.id, qty: 1, mixer: 'Coke Zero' },
    { drink_id: bourbon.id, qty: 1, mixer: 'On the rocks' },
    { drink_id: bourbon.id, qty: 2, mixer: 'Coke Zero' },
    { drink_id: bourbon.id, qty: 1, mixer: 'Pineapple juice' },
    { drink_id: bourbon.id, qty: 1, mixer: 'Other:   lime  & a splash of soda ' },
    { drink_id: beer.id, qty: 1 },
  ])
  assert.equal(ok.status, 201)
  assert.deepEqual(ok.body.items.map((i) => [i.drink_name, i.mixer, i.qty]), [
    ['Bourbon', 'Coke Zero', 3],
    ['Bourbon', 'On the rocks', 1],
    ['Bourbon', 'Pineapple juice', 1],
    ['Bourbon', 'Other: lime & a splash of soda', 1],
    ['Beer', null, 1],
  ])

  // the tally counts the spirit regardless of mixer
  const queue = await call('/api/bar/orders', { pin: PIN })
  assert.ok(queue.body.tally[bourbon.id] >= 6)
})

test('light/stiff is kept per line, validated, and only allowed on spirits', async () => {
  const { drinks } = (await call('/api/menu')).body
  const gin = drinks.find((d) => d.name === 'Gin')
  const spritz = drinks.find((d) => d.name === 'Aperol Spritz')
  const beer = drinks.find((d) => d.name === 'Beer')

  assert.equal((await guestOrder([{ drink_id: gin.id, mixer: 'Tonic Water', strength: 'double' }])).status, 400)
  assert.equal((await guestOrder([{ drink_id: beer.id, strength: 'stiff' }])).status, 400)
  assert.equal((await guestOrder([{ drink_id: spritz.id, strength: 'stiff' }])).status, 400)

  const ok = await guestOrder([
    { drink_id: gin.id, mixer: 'Tonic Water', strength: 'stiff' },
    { drink_id: gin.id, mixer: 'Tonic Water' },
    { drink_id: gin.id, mixer: 'Tonic Water', strength: 'STIFF' },
    { drink_id: gin.id, mixer: 'On the rocks', strength: 'light', qty: 2 },
    { drink_id: spritz.id },
  ])
  assert.equal(ok.status, 201)
  assert.deepEqual(ok.body.items.map((i) => [i.drink_name, i.mixer, i.strength, i.qty]), [
    ['Gin', 'Tonic Water', 'stiff', 2],
    ['Gin', 'Tonic Water', null, 1],
    ['Gin', 'On the rocks', 'light', 2],
    ['Aperol Spritz', null, null, 1],
  ])
})
