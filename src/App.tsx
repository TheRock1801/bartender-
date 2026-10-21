import GuestApp from './GuestApp'
import BarApp from './BarApp'

// Two screens, picked by path. /bar for whoever is pouring, everything else for guests.
export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (path === '/bar') return <BarApp />
  return <GuestApp />
}
