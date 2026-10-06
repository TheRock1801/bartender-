// Local dev only. Vercel uses api/index.js directly.
import { createServer } from 'node:http'
import handler from './api/index.js'

const port = Number(process.env.PORT) || 3001
createServer((req, res) => handler(req, res)).listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}  (bar PIN: ${process.env.BAR_PIN || '1234'})`)
})
