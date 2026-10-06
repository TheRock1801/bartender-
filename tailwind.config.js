/** @type {import('tailwindcss').Config} */
// Design tokens. Colour names are kept from the first build (cream/sand/cocoa/amber)
// so existing classes keep working; their values now follow the stationery palette.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F3E8DB',   // warm ivory, page background
        ivory: '#F3E8DB',
        sand: '#DDC9B5',    // secondary surfaces
        taupe: '#A58E7B',   // feature sections, borders
        peach: '#EBC3A5',   // decorative headings / highlights
        cocoa: '#42362F',   // espresso, body text
        espresso: '#42362F',
        amber: '#B85E28',   // burnt orange, sparing accents + primary actions
        sage: '#7E8C74',    // muted, for "ready / delivered" states only
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
