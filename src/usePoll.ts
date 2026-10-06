import { useEffect, useRef, useState } from 'react'

// Polls `fn` every `ms` while the tab is visible. Simple and tolerant of flaky
// venue Wi-Fi: a failed poll keeps the last good data and sets `error`.
export function usePoll<T>(fn: () => Promise<T>, ms: number, deps: unknown[] = [], enabled = true) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!enabled) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = async () => {
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(run, ms)
        return
      }
      try {
        const d = await fnRef.current()
        if (alive) { setData(d); setError(null) }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Lost connection')
      }
      if (alive) timer = setTimeout(run, ms)
    }
    run()
    const onVisible = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); run() } }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, enabled, tick, ...deps])

  return { data, error, refresh: () => setTick((t) => t + 1), setData }
}
