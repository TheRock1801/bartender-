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

test('menu is seeded with the two starting drinks and ordering open', async () => {
  const { status, body } = await call('/api/menu')
  assert.equal(status, 200)
  assert.deepEqual(body.drinks.map((d) => d.name), ['Whiskey Old Fashioned', 'Bourbon & Coke'])
  assert.equal(body.settings.ordering_open, true)
})

test('bartender routes need the PIN', async () => {
  assert.equal((await call('/api/bar/orders')).status, 401)
  assert.equal((await call('/api/bar/orders', { pin: 'wrong' })).status, 401)
  assert.equal((await call('/api/bar/login', { method: 'POST', pin: PIN })).status, 200)
})

test('guest orders a couple of drinks, bartender claims, makes, delivers', async () => {
  const { drinks } = (await call('/api/menu')).body
  const [of, bc] = drinks
  const placed = await call('/api/orders', {
    method: 'POST',
    body: { guest_name: 'Sam', device_id: 'dev-1', items: [{ drink_id: of.id, qty: 2 }, { drink_id: bc.id, qty: 1 }, { drink_id: of.id, qty: 1 }] },
  })
  assert.equal(placed.status, 201)
  assert.equal(placed.body.status, 'new')
  // duplicate lines are merged
  assert.deepEqual(placed.body.items.map((i) => [i.drink_name, i.qty]), [['Whiskey Old Fashioned', 3], ['Bourbon & Coke', 1]])

  const mine = await call('/api/orders/mine?device_id=dev-1')
  assert.equal(mine.body.orders.length, 1)

  const queue = await call('/api/bar/orders', { pin: PIN })
  assert.equal(queue.body.orders.length, 1)

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

  // delivered orders leave the open queue but the guest still sees them
  assert.equal((await call('/api/bar/orders', { pin: PIN })).body.orders.length, 0)
  assert.equal((await call('/api/orders/mine?device_id=dev-1')).body.orders[0].status, 'delivered')
})

test('guest order is rejected without a name or with an empty cart', async () => {
  const { drinks } = (await call('/api/menu')).body
  assert.equal((await call('/api/orders', { method: 'POST', body: { guest_name: '', device_id: 'd', items: [{ drink_id: drinks[0].id }] } })).status, 400)
  assert.equal((await call('/api/orders', { method: 'POST', body: { guest_name: 'Al', device_id: 'd', items: [] } })).status, 400)
  assert.equal((await call('/api/orders', { method: 'POST', body: { guest_name: 'Al', device_id: 'd', items: [{ drink_id: 'nope' }] } })).status, 400)
})

test('run-out drinks cannot be ordered by guests but can be recorded by a bartender', async () => {
  const { drinks } = (await call('/api/menu')).body
  const bc = drinks.find((d) => d.name === 'Bourbon & Coke')
  const off = await call(`/api/bar/drinks/${bc.id}`, { method: 'PATCH', pin: PIN, body: { available: false } })
  assert.equal(off.body.available, false)

  const guest = await call('/api/orders', { method: 'POST', body: { guest_name: 'Al', device_id: 'd2', items: [{ drink_id: bc.id }] } })
  assert.equal(guest.status, 400)
  assert.match(guest.body.error, /run out/)

  const verbal = await call('/api/bar/orders', { method: 'POST', pin: PIN, body: { guest_name: 'Al', placed_by: 'Rocky', items: [{ drink_id: bc.id }] } })
  assert.equal(verbal.status, 201)
  assert.equal(verbal.body.placed_by, 'Rocky')

  await call(`/api/bar/drinks/${bc.id}`, { method: 'PATCH', pin: PIN, body: { available: true } })
})

test('pausing ordering blocks guests, resuming lets them through; last orders flag round-trips', async () => {
  const { drinks } = (await call('/api/menu')).body
  const paused = await call('/api/bar/settings', { method: 'PATCH', pin: PIN, body: { ordering_open: false, last_orders: true } })
  assert.deepEqual(paused.body, { ordering_open: false, last_orders: true })
  assert.equal((await call('/api/menu')).body.settings.last_orders, true)

  const blocked = await call('/api/orders', { method: 'POST', body: { guest_name: 'Al', device_id: 'd3', items: [{ drink_id: drinks[0].id }] } })
  assert.equal(blocked.status, 409)

  await call('/api/bar/settings', { method: 'PATCH', pin: PIN, body: { ordering_open: true } })
  const ok = await call('/api/orders', { method: 'POST', body: { guest_name: 'Al', device_id: 'd3', items: [{ drink_id: drinks[0].id }] } })
  assert.equal(ok.status, 201)
})

test('a bartender can add a drink and it shows on the guest menu immediately', async () => {
  const added = await call('/api/bar/drinks', { method: 'POST', pin: PIN, body: { name: 'Espresso Martini', description: 'Vodka, coffee, Kahlua', category: 'Cocktails', added_by: 'Rocky' } })
  assert.equal(added.status, 201)
  const { drinks } = (await call('/api/menu')).body
  const em = drinks.find((d) => d.name === 'Espresso Martini')
  assert.ok(em)
  assert.equal(em.available, true)
  assert.equal(em.added_by, 'Rocky')
  assert.equal((await call('/api/bar/drinks', { method: 'POST', pin: PIN, body: { name: '  ' } })).status, 400)
})
