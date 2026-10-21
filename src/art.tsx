import type { ReactNode } from 'react'

// All the artwork is inline SVG, drawn in one style (thin cocoa line, soft amber and
// terracotta fills, no background) so it sits on the cream page instead of looking
// pasted on. A drink gets its icon by matching its name; anything unknown gets the tumbler.

const LINE = '#4A3A2E'
const AMBER = '#D9A05A'
const AMBER_DARK = '#B56B3A'
const BROWN = '#7A4A2B'
const ICE = '#FBF3E2'
const TERRACOTTA = '#C9684A'
const PALE = '#F3E6C8'
const LEMON = '#EDD27A'
const LIME = '#B7C27C'
const RED_WINE = '#8E3A3F'
const WHITE_WINE = '#EBD89A'
const FOAM = '#FBF3E2'
const CRANBERRY = '#B23A4E'
const ORANGE = '#E4913F'
const PINEAPPLE = '#E8C65A'
const WATER = '#EEF0EA'

type IconProps = { size: number; className?: string }

const Svg = ({ size, className = '', children }: IconProps & { children: ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    stroke={LINE}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    {children}
  </svg>
)

// ---- Glass shapes ----

// Short tumbler: rim at y=16, base at y=50. Liquid from `level` down.
function Tumbler({ liquid, level = 29, children }: { liquid: string; level?: number; children?: ReactNode }) {
  return (
    <>
      <path d={`M${16.6 + (level - 16) * 0.09} ${level} L18.4 49 H45.6 L${47.4 - (level - 16) * 0.09} ${level} Z`} fill={liquid} stroke="none" />
      {children}
      <path d="M15 16 L18 50 Q18.2 52 20.2 52 H43.8 Q45.8 52 46 50 L49 16" />
      <ellipse cx="32" cy="16" rx="17" ry="2.8" fill={ICE} fillOpacity="0.5" />
      <path d="M20 49 H44" strokeOpacity="0.35" />
    </>
  )
}

function IceCubes({ a = true, b = true }: { a?: boolean; b?: boolean }) {
  return (
    <>
      {a && <rect x="21" y="30" width="10" height="10" rx="2" transform="rotate(-12 26 35)" fill={ICE} fillOpacity="0.85" strokeWidth="1.1" />}
      {b && <rect x="33" y="33" width="9" height="9" rx="2" transform="rotate(14 37.5 37.5)" fill={ICE} fillOpacity="0.85" strokeWidth="1.1" />}
    </>
  )
}

// Tall highball: rim y=10, base y=54.
function Highball({ liquid, level = 22, children }: { liquid: string; level?: number; children?: ReactNode }) {
  return (
    <>
      <path d={`M${21.5 + (level - 10) * 0.045} ${level} L23.5 53 H40.5 L${42.5 - (level - 10) * 0.045} ${level} Z`} fill={liquid} stroke="none" />
      {children}
      <path d="M21 10 L23 54 Q23 56 25 56 H39 Q41 56 41 54 L43 10" />
      <ellipse cx="32" cy="10" rx="11" ry="2" fill={ICE} fillOpacity="0.5" />
    </>
  )
}

function Straw({ x = 38 }: { x?: number }) {
  return <path d={`M${x} 4 L${x - 6} 44`} stroke={TERRACOTTA} strokeWidth="2.2" />
}

function Bubbles({ color = LINE }: { color?: string }) {
  return (
    <g fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.55">
      <circle cx="28" cy="30" r="1.4" /><circle cx="35" cy="40" r="1.1" /><circle cx="31" cy="47" r="1.6" /><circle cx="37" cy="26" r="1" /><circle cx="26" cy="42" r="0.9" />
    </g>
  )
}

// Stemmed wine glass: bowl rim y=12, bowl bottom y=36, foot y=57.
function WineGlass({ liquid, level = 22, children }: { liquid: string; level?: number; children?: ReactNode }) {
  return (
    <>
      <path d={`M${18.6 + Math.max(0, level - 18) * 0.12} ${level} Q19 36 32 37 Q45 36 ${45.4 - Math.max(0, level - 18) * 0.12} ${level} Z`} fill={liquid} stroke="none" />
      {children}
      <path d="M19 12 Q18 36 32 37 Q46 36 45 12 Z" />
      <path d="M32 37 V54" /><path d="M22 57 Q32 53 42 57" />
      <path d="M22 16 Q21.5 24 23 30" stroke={ICE} strokeOpacity="0.9" strokeWidth="1.2" />
    </>
  )
}

// Big round balloon glass (gin copa).
function Balloon({ liquid, level = 24, children }: { liquid: string; level?: number; children?: ReactNode }) {
  return (
    <>
      <path d={`M${15.5 + Math.max(0, level - 16) * 0.1} ${level} Q15 42 32 42 Q49 42 ${48.5 - Math.max(0, level - 16) * 0.1} ${level} Z`} fill={liquid} stroke="none" />
      {children}
      <path d="M16 14 Q13 42 32 42 Q51 42 48 14 Z" />
      <ellipse cx="32" cy="14" rx="16" ry="2.4" fill={ICE} fillOpacity="0.5" />
      <path d="M32 42 V54" /><path d="M23 57 Q32 53 41 57" />
    </>
  )
}

// Snifter for brandy and cognac: wide low bowl on a short stem.
function Snifter({ liquid }: { liquid: string }) {
  return (
    <>
      <path d="M13.5 34 Q16 44 32 44 Q48 44 50.5 34 Z" fill={liquid} stroke="none" />
      <path d="M22 12 Q10 22 13 34 Q16 44 32 44 Q48 44 51 34 Q54 22 42 12 Z" />
      <ellipse cx="32" cy="12" rx="10" ry="2" fill={ICE} fillOpacity="0.5" />
      <path d="M32 44 V52" /><path d="M23 55 Q32 51 41 55" />
      <path d="M18 20 Q15 26 16 32" stroke={ICE} strokeOpacity="0.9" strokeWidth="1.2" />
    </>
  )
}

// Flute: narrow, tall.
function Flute({ liquid }: { liquid: string }) {
  return (
    <>
      <path d="M25.6 18 L27 42 Q32 44 37 42 L38.4 18 Z" fill={liquid} stroke="none" />
      <g fill="none" stroke={LINE} strokeWidth="1" strokeOpacity="0.55">
        <circle cx="30" cy="24" r="1.1" /><circle cx="34" cy="30" r="1.3" /><circle cx="30.5" cy="36" r="1" /><circle cx="33.5" cy="39" r="0.9" />
      </g>
      <path d="M25 8 L27 42 Q32 45 37 42 L39 8" />
      <ellipse cx="32" cy="8" rx="7" ry="1.6" fill={ICE} fillOpacity="0.5" />
      <path d="M32 44 V54" /><path d="M23 57 Q32 53 41 57" />
    </>
  )
}

// Martini glass.
function Martini({ liquid, children }: { liquid: string; children?: ReactNode }) {
  return (
    <>
      <path d="M15.5 17 L32 36 L48.5 17 Z" fill={liquid} stroke="none" />
      {children}
      <path d="M12 14 L32 37 L52 14 Z" />
      <path d="M12 14 Q32 17.5 52 14" strokeOpacity="0.5" />
      <path d="M32 37 V54" /><path d="M22 57 Q32 53 42 57" />
    </>
  )
}

// Coupe for the sour.
function Coupe({ liquid, children }: { liquid: string; children?: ReactNode }) {
  return (
    <>
      <path d="M15 20 Q18 36 32 36 Q46 36 49 20 Z" fill={liquid} stroke="none" />
      {children}
      <path d="M13 16 Q14 36 32 36 Q50 36 51 16 Z" />
      <path d="M32 36 V54" /><path d="M22 57 Q32 53 42 57" />
    </>
  )
}

// Pint glass.
function Pint({ liquid, children }: { liquid: string; children?: ReactNode }) {
  return (
    <>
      <path d="M20 20 L22.5 52 H41.5 L44 20 Z" fill={liquid} stroke="none" />
      {children}
      <path d="M19 10 L22 53 Q22 55 24 55 H40 Q42 55 42 53 L45 10 Z" />
      <path d="M19 10 Q32 13 45 10" strokeOpacity="0.5" />
    </>
  )
}

// ---- Garnish ----

function CitrusWheel({ cx, cy, r = 6, color = LEMON, segments = '#C4A33A' }: { cx: number; cy: number; r?: number; color?: string; segments?: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} strokeWidth="1.1" />
      <circle cx={cx} cy={cy} r={r * 0.75} fill="none" stroke={segments} strokeWidth="0.8" />
      <path d={`M${cx - r * 0.75} ${cy} H${cx + r * 0.75} M${cx} ${cy - r * 0.75} V${cy + r * 0.75} M${cx - r * 0.53} ${cy - r * 0.53} L${cx + r * 0.53} ${cy + r * 0.53} M${cx + r * 0.53} ${cy - r * 0.53} L${cx - r * 0.53} ${cy + r * 0.53}`} stroke={segments} strokeWidth="0.8" />
    </g>
  )
}

function Mint() {
  return (
    <g fill={LIME} strokeWidth="1.1">
      <path d="M40 22 Q46 14 48 6 Q40 8 38 18 Z" /><path d="M40 22 Q32 16 30 8 Q38 10 40 20 Z" />
      <path d="M40 22 Q43 20 45 14" fill="none" strokeOpacity="0.6" />
    </g>
  )
}

function Cherry({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <path d={`M${cx} ${cy - 3} Q${cx + 2} ${cy - 10} ${cx + 7} ${cy - 11}`} />
      <circle cx={cx} cy={cy} r="3.4" fill={TERRACOTTA} strokeWidth="1.1" />
    </g>
  )
}

// ---- The icons ----

const ICONS: Record<string, (p: IconProps) => ReactNode> = {
  whiskey: (p) => (
    <Svg {...p}><Tumbler liquid={AMBER}><IceCubes /></Tumbler></Svg>
  ),
  bourbon: (p) => (
    <Svg {...p}><Tumbler liquid={AMBER_DARK} level={27}><IceCubes a b /></Tumbler></Svg>
  ),
  gin: (p) => (
    <Svg {...p}>
      <Balloon liquid={PALE}>
        <rect x="22" y="26" width="9" height="9" rx="2" transform="rotate(-10 26.5 30.5)" fill={ICE} strokeWidth="1.1" />
        <rect x="32" y="30" width="8" height="8" rx="2" transform="rotate(16 36 34)" fill={ICE} strokeWidth="1.1" />
        <CitrusWheel cx={41} cy={18} r={6.5} color={LIME} segments="#7E8C4A" />
      </Balloon>
    </Svg>
  ),
  vodka: (p) => (
    <Svg {...p}>
      <Highball liquid={WATER}>
        <rect x="25" y="28" width="8" height="8" rx="1.8" transform="rotate(-8 29 32)" fill={ICE} strokeWidth="1.1" />
        <rect x="28" y="40" width="8" height="8" rx="1.8" transform="rotate(12 32 44)" fill={ICE} strokeWidth="1.1" />
        <Straw x={41} />
        <CitrusWheel cx={26} cy={17} r={5} color={LIME} segments="#7E8C4A" />
      </Highball>
    </Svg>
  ),
  rum: (p) => (
    <Svg {...p}>
      <Tumbler liquid={AMBER}><IceCubes a b={false} /></Tumbler>
      <Mint />
    </Svg>
  ),
  brandy: (p) => (
    <Svg {...p}><Snifter liquid={AMBER} /></Svg>
  ),
  cognac: (p) => (
    <Svg {...p}><Snifter liquid={AMBER_DARK} /></Svg>
  ),
  'espresso martini': (p) => (
    <Svg {...p}>
      <Martini liquid={BROWN}>
        <path d="M15.5 17 Q32 24 48.5 17 Q32 21 15.5 17 Z" fill={FOAM} fillOpacity="0.9" stroke="none" />
        <g fill={BROWN} stroke="none"><ellipse cx="29" cy="19" rx="2" ry="1.3" transform="rotate(-20 29 19)" /><ellipse cx="33.5" cy="18.4" rx="2" ry="1.3" transform="rotate(15 33.5 18.4)" /><ellipse cx="31" cy="21.2" rx="2" ry="1.3" transform="rotate(5 31 21.2)" /></g>
      </Martini>
    </Svg>
  ),
  spritz: (p) => (
    <Svg {...p}>
      <WineGlass liquid={ORANGE} level={18}>
        <rect x="24" y="22" width="8" height="8" rx="1.8" transform="rotate(-12 28 26)" fill={ICE} fillOpacity="0.85" strokeWidth="1.1" />
        <rect x="33" y="26" width="7" height="7" rx="1.8" transform="rotate(14 36.5 29.5)" fill={ICE} fillOpacity="0.85" strokeWidth="1.1" />
        <CitrusWheel cx={41} cy={17} r={6} color={ORANGE} segments="#B2621F" />
      </WineGlass>
    </Svg>
  ),
  sour: (p) => (
    <Svg {...p}>
      <Coupe liquid={LEMON}>
        <path d="M15 20 Q32 26 49 20 Q32 23 15 20 Z" fill={FOAM} stroke="none" />
        <path d="M15.5 21 Q24 25 32 24.5 Q40 25 48.5 21" stroke={FOAM} strokeWidth="2.5" />
        <Cherry cx={38} cy={24} />
      </Coupe>
    </Svg>
  ),
  beer: (p) => (
    <Svg {...p}>
      <Pint liquid={AMBER}>
        <path d="M20 20 Q25 15 32 19 Q39 15 44 20 Q39 24 32 22 Q25 24 20 20 Z" fill={FOAM} stroke="none" />
        <path d="M19.6 14 Q24 10 28 13 Q32 9 36 13 Q40 10 44.4 14 Q44 19 32 19.5 Q20 19 19.6 14 Z" fill={FOAM} strokeWidth="1.2" />
        <Bubbles />
      </Pint>
      <path d="M45 22 Q54 22 54 31 Q54 40 45 40" />
    </Svg>
  ),
  'red wine': (p) => (
    <Svg {...p}><WineGlass liquid={RED_WINE} level={22} /></Svg>
  ),
  'white wine': (p) => (
    <Svg {...p}><WineGlass liquid={WHITE_WINE} level={22} /></Svg>
  ),
  'sparkling wine': (p) => (
    <Svg {...p}><Flute liquid={WHITE_WINE} /></Svg>
  ),
  lemonade: (p) => (
    <Svg {...p}>
      <Highball liquid={PALE}>
        <Bubbles />
        <rect x="26" y="36" width="8" height="8" rx="1.8" transform="rotate(10 30 40)" fill={ICE} strokeWidth="1.1" />
        <Straw x={40} />
        <CitrusWheel cx={26} cy={18} r={5.5} />
      </Highball>
    </Svg>
  ),
  'orange juice': (p) => (
    <Svg {...p}>
      <Highball liquid={ORANGE}>
        <Straw x={40} />
        <CitrusWheel cx={25} cy={17} r={5.5} color={ORANGE} segments="#B2621F" />
      </Highball>
    </Svg>
  ),
  'pineapple juice': (p) => (
    <Svg {...p}>
      <Highball liquid={PINEAPPLE}>
        <Straw x={40} />
        <path d="M22 20 L29 12 L30 20 Z" fill={LIME} strokeWidth="1.1" />
        <path d="M24 15 L25 9 M27.5 14 L30 8" stroke="#7E8C4A" strokeWidth="1.1" />
      </Highball>
    </Svg>
  ),
  'cranberry juice': (p) => (
    <Svg {...p}>
      <Highball liquid={CRANBERRY}>
        <rect x="26" y="30" width="8" height="8" rx="1.8" transform="rotate(-10 30 34)" fill={ICE} fillOpacity="0.85" strokeWidth="1.1" />
        <Straw x={40} />
        <circle cx="25" cy="17" r="2.6" fill={CRANBERRY} strokeWidth="1" /><circle cx="29" cy="15" r="2.2" fill={CRANBERRY} strokeWidth="1" />
      </Highball>
    </Svg>
  ),
  juice: (p) => (
    <Svg {...p}>
      <Highball liquid={ORANGE}>
        <Straw x={40} />
        <CitrusWheel cx={25} cy={17} r={5.5} color={ORANGE} segments="#B2621F" />
      </Highball>
    </Svg>
  ),
  water: (p) => (
    <Svg {...p}>
      <Highball liquid={WATER}>
        <Bubbles />
        <rect x="25" y="26" width="8" height="8" rx="1.8" transform="rotate(-8 29 30)" fill={ICE} strokeWidth="1.1" />
        <rect x="28" y="40" width="8" height="8" rx="1.8" transform="rotate(12 32 44)" fill={ICE} strokeWidth="1.1" />
        <CitrusWheel cx={26} cy={16} r={5} color={LIME} segments="#7E8C4A" />
      </Highball>
    </Svg>
  ),
  soft: (p) => (
    <Svg {...p}>
      <Highball liquid={BROWN}>
        <Bubbles color={ICE} />
        <rect x="26" y="34" width="8" height="8" rx="1.8" transform="rotate(10 30 38)" fill={ICE} fillOpacity="0.8" strokeWidth="1.1" />
        <Straw x={40} />
      </Highball>
    </Svg>
  ),
  coffee: (p) => (
    <Svg {...p}>
      <path d="M17 24 L20 48 Q20.5 50 22.5 50 H41.5 Q43.5 50 44 48 L47 24 Z" fill={ICE} />
      <path d="M18.6 29 Q32 32 45.4 29 L43 48 H21 Z" fill={BROWN} stroke="none" />
      <path d="M47 28 Q56 28 55 36 Q54 43 46 42" />
      <path d="M27 14 Q25 18 27 21 M33 12 Q31 17 33 21" strokeOpacity="0.5" />
    </Svg>
  ),
  tumbler: (p) => (
    <Svg {...p}><Tumbler liquid={AMBER}><IceCubes /></Tumbler></Svg>
  ),
}

// First matching rule wins, so the specific names sit above the general ones.
const RULES: [RegExp, keyof typeof ICONS][] = [
  [/espresso|martini/, 'espresso martini'],
  [/sour/, 'sour'],
  [/spritz|aperol/, 'spritz'],
  [/sparkling wine|prosecco|champagne|bubbles|bubbly/, 'sparkling wine'],
  [/red wine|shiraz|pinot noir|merlot|cab/, 'red wine'],
  [/white wine|sauv|chardonnay|pinot gris|ros[ée]/, 'white wine'],
  [/\bwine\b/, 'red wine'],
  [/beer|lager|ale|cider|pilsner|ipa/, 'beer'],
  [/orange/, 'orange juice'],
  [/pineapple/, 'pineapple juice'],
  [/cranberry/, 'cranberry juice'],
  [/juice/, 'juice'],
  [/lemonade/, 'lemonade'],
  [/coke|cola|ginger|soft|soda|tonic/, 'soft'],
  [/water/, 'water'],
  [/coffee|flat white|latte|tea\b/, 'coffee'],
  [/whisk/, 'whiskey'],
  [/bourbon/, 'bourbon'],
  [/gin\b/, 'gin'],
  [/vodka/, 'vodka'],
  [/rum/, 'rum'],
  [/brandy/, 'brandy'],
  [/cognac/, 'cognac'],
]

export const iconFor = (name: string): keyof typeof ICONS => {
  const n = name.trim().toLowerCase()
  for (const [re, key] of RULES) if (re.test(n)) return key
  return 'tumbler'
}

export function Glass({ name, size = 56, className = '' }: { name: string; size?: number; className?: string }) {
  return <>{ICONS[iconFor(name)]({ size, className })}</>
}

// Florals, candles and glassware across the top of a screen, like the board's spread.
export function HeaderArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 340 170" fill="none" stroke={LINE} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={`block mx-auto w-full max-w-[340px] h-auto ${className}`} aria-hidden="true">
      {/* bottle */}
      <path d="M36 66 V44 Q36 40 40 40 H50 Q54 40 54 44 V66 Q62 72 62 84 V150 Q62 154 58 154 H32 Q28 154 28 150 V84 Q28 72 36 66 Z" fill="#E7B08A" fillOpacity="0.8" />
      <rect x="38" y="33" width="14" height="8" rx="2" fill={TERRACOTTA} strokeWidth="1.1" />
      <rect x="33" y="100" width="24" height="28" rx="2" fill={ICE} strokeWidth="1" />
      <path d="M37 112 H53 M37 118 H49" strokeOpacity="0.4" strokeWidth="1" />
      {/* left candle */}
      <path d="M86 52 V112" stroke="#E8A0A0" strokeWidth="6" />
      <path d="M86 52 V112" strokeWidth="1" strokeOpacity="0.4" />
      <path d="M86 46 Q82 40 86 34 Q90 40 86 46 Z" fill={LEMON} strokeWidth="1" />
      <path d="M78 112 H94 M86 112 V136 M76 142 Q86 134 96 142" />
      {/* right candle */}
      <path d="M258 48 V108" stroke="#E8A0A0" strokeWidth="6" />
      <path d="M258 48 V108" strokeWidth="1" strokeOpacity="0.4" />
      <path d="M258 42 Q254 36 258 30 Q262 36 258 42 Z" fill={LEMON} strokeWidth="1" />
      <path d="M250 108 H266 M258 108 V132 M248 138 Q258 130 268 138" />
      {/* coupe, between the candle and the vase */}
      <path d="M100 124 Q104 146 118 146 Q132 146 136 124 Z" fill="#F0C9C4" />
      <path d="M118 146 V158 M108 162 Q118 157 128 162" />
      {/* small wine glass, between the vase and the right candle */}
      <path d="M222 128 Q220 150 234 150 Q248 150 246 128 Z" fill={WATER} />
      <path d="M234 150 V160 M225 164 Q234 160 243 164" />
      {/* vase */}
      <path d="M156 116 Q152 146 180 148 Q208 146 204 116 Z" fill="#CBD6A4" fillOpacity="0.9" />
      <path d="M180 148 V158 M164 164 Q180 158 196 164" />
      <path d="M160 122 Q158 140 176 144" stroke={ICE} strokeWidth="1.2" />
      {/* stems and leaves */}
      <g stroke="#7E8C4A" strokeWidth="1.2">
        <path d="M168 116 Q150 96 132 86" /><path d="M192 116 Q208 96 228 80" /><path d="M180 116 Q178 80 184 52" /><path d="M174 116 Q160 70 144 56" />
        <path d="M140 90 Q132 96 126 94 Q130 86 140 90 Z" fill={LIME} /><path d="M214 92 Q222 90 226 84 Q216 82 214 92 Z" fill={LIME} /><path d="M182 78 Q188 72 194 74 Q190 80 182 78 Z" fill={LIME} /><path d="M156 76 Q148 76 146 70 Q154 68 156 76 Z" fill={LIME} />
      </g>
      {/* flowers */}
      <g strokeWidth="1.1">
        {/* yellow sprigs */}
        <g fill={LEMON}><circle cx="128" cy="68" r="4.5" /><circle cx="135" cy="60" r="4.5" /><circle cx="142" cy="68" r="4.5" /><circle cx="135" cy="76" r="4.5" /><circle cx="135" cy="68" r="4.5" fill="#E3A84A" /></g>
        <g fill={LEMON}><circle cx="222" cy="54" r="4" /><circle cx="229" cy="47" r="4" /><circle cx="236" cy="54" r="4" /><circle cx="229" cy="61" r="4" /><circle cx="229" cy="54" r="4" fill="#E3A84A" /></g>
        {/* blue hydrangea, low in the bunch */}
        <g fill="#9FB0C6"><circle cx="150" cy="100" r="6" /><circle cx="161" cy="95" r="6" /><circle cx="158" cy="107" r="6" /><circle cx="146" cy="110" r="5" /><circle cx="168" cy="106" r="5" /></g>
        <g fill="#9FB0C6"><circle cx="206" cy="100" r="6" /><circle cx="215" cy="108" r="5.5" /><circle cx="199" cy="110" r="5.5" /><circle cx="214" cy="94" r="5" /></g>
        {/* roses */}
        <g fill="#E8A0A0"><circle cx="154" cy="76" r="14" /><path d="M147 74 Q154 66 161 74 Q157 82 149 79" fill="none" strokeOpacity="0.6" /><path d="M151 70 Q158 70 158 78" fill="none" strokeOpacity="0.6" /></g>
        <g fill="#F0B59E"><circle cx="182" cy="98" r="13" /><path d="M175 96 Q182 88 189 96 Q185 103 177 100" fill="none" strokeOpacity="0.6" /></g>
        <g fill="#E8A0A0"><circle cx="208" cy="76" r="12" /><path d="M202 75 Q208 68 214 75 Q210 81 204 78" fill="none" strokeOpacity="0.6" /></g>
        <g fill={TERRACOTTA} fillOpacity="0.85"><circle cx="181" cy="62" r="12" /><path d="M175 61 Q181 54 187 61 Q184 67 177 64" fill="none" stroke={ICE} strokeOpacity="0.7" /><path d="M178 57 Q185 57 185 65" fill="none" stroke={ICE} strokeOpacity="0.7" /></g>
        <g fill="#F0B59E"><circle cx="166" cy="48" r="8" /><path d="M162 47 Q166 42 170 47 Q168 51 163 49" fill="none" strokeOpacity="0.6" /></g>
      </g>
      {/* flute, top right */}
      <path d="M290 48 L293 98 Q300 101 307 98 L310 48 Z" fill="#F0C9C4" />
      <path d="M300 100 V110 M292 114 Q300 110 308 114" />
      {/* cake slice on a plate, bottom right */}
      <ellipse cx="300" cy="158" rx="24" ry="5" fill={ICE} />
      <path d="M284 136 L312 128 L316 152 L288 158 Z" fill="#F3DDB0" />
      <path d="M284 136 L312 128 L316 138 L288 146 Z" fill="#F0C9C4" />
      <path d="M298 132 L302 154" strokeOpacity="0.4" />
      <circle cx="304" cy="124" r="3" fill={TERRACOTTA} strokeWidth="1" />
    </svg>
  )
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
