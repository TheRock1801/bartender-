// The illustrations, cropped from the mood board (public/art). A drink gets its own glass
// when there is one for its name; everything else shares the tumbler.
const GLASSES: Record<string, string> = {
  whiskey: '/art/glass-whiskey.png',
  whisky: '/art/glass-whiskey.png',
  bourbon: '/art/glass-bourbon.png',
  gin: '/art/glass-gin.png',
  vodka: '/art/glass-vodka.png',
  rum: '/art/glass-rum.png',
  'dark rum': '/art/glass-rum.png',
  brandy: '/art/glass-brandy.png',
  cognac: '/art/glass-cognac.png',
}

export const glassFor = (name: string) => GLASSES[name.trim().toLowerCase()] ?? '/art/glass-hero.png'

export function Glass({ name, size = 56, className = '' }: { name: string; size?: number; className?: string }) {
  return <img src={glassFor(name)} alt="" width={size} height={size} className={`object-contain shrink-0 ${className}`} draggable={false} />
}

// Florals, candles and glassware across the top of a screen.
export function HeaderArt({ className = '' }: { className?: string }) {
  return <img src="/art/header.png" alt="" className={`block mx-auto w-full max-w-[340px] h-auto ${className}`} draggable={false} />
}

// Script couple name with the date beneath, as on the invitation.
export function CoupleNames({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  return (
    <div className="text-center">
      <h1 className={`script ${size === 'lg' ? 'text-[3.4rem]' : 'text-[2.1rem]'}`}>Riley &amp; Jasmine</h1>
      <p className={`spaced text-stone ${size === 'lg' ? 'text-sm mt-2' : 'text-[0.65rem] mt-0.5'}`}>03 . 11 . 2026</p>
    </div>
  )
}

export function BackArrow({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="w-11 h-11 -ml-2 inline-flex items-center justify-center text-cocoa" aria-label={label}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
  )
}

export function CollectIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h14l-7 8z" /><path d="M12 12v7" /><path d="M8 19h8" /><path d="M7 6.5h10" />
    </svg>
  )
}

export function DeliverIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 17h18" /><path d="M5 17a7 7 0 0 1 14 0" /><path d="M12 10V8" /><circle cx="12" cy="7" r="1" /><path d="M2 20h20" />
    </svg>
  )
}

export function Check({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L19 7" /></svg>
  )
}
