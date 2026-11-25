/** @type {import('tailwindcss').Config} */
// Design tokens: the Aria & Jansen stationery palette, brought back for Demi & Ryleigh
// (2026-11-25). Colour names are shared with the classes used across the app; `stone`
// and `mist` are the A&J "cocoa/60" and "sand/70" baked into solid colours.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F3E8DB',   // warm ivory, page background
        ivory: '#F3E8DB',   // cards and sheets: same paper, a fine taupe rule instead of a tint
        sand: '#DDC9B5',    // secondary surfaces
        taupe: '#A58E7B',   // borders (used at /30–/60)
        peach: '#EBC3A5',   // decorative only
        cocoa: '#42362F',   // espresso, body text
        espresso: '#42362F',
        stone: '#897D74',   // muted text
        amber: '#B85E28',   // burnt orange, sparing accents
        sage: '#7E8C74',    // "made" states only
        mist: '#E5D5C5',    // cancelled / run out
      },
      fontFamily: {
        display: ['"League Spartan"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
    },
  },
  plugins: [],
}
