/** @type {import('tailwindcss').Config} */
// Design tokens, sampled from the Riley & Jasmine mood board. Colour names are kept from the
// original app (cream/sand/cocoa/amber/sage) so shared classes keep working; the values are new.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F7E9CF',    // page background (warm cream, matches the artwork)
        ivory: '#FCF2DF',    // cards and sheets, a shade lighter than the page
        sand: '#EFDFC4',     // soft fills, pressed states
        taupe: '#D9C7A8',    // hairlines and borders
        peach: '#E9C4A3',    // decorative only
        cocoa: '#4A3A2E',    // body text
        espresso: '#3A2C22', // headings
        stone: '#8E8375',    // muted text
        amber: '#9B5233',    // terracotta: primary buttons, "Preparing"
        sage: '#7C7349',     // olive: "Ready"
        mist: '#E3DAD1',     // "Delivered"
      },
      fontFamily: {
        script: ['Italianno', '"Brush Script MT"', 'cursive'],
        display: ['"Cormorant Garamond"', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['Jost', '"Avenir Next"', 'Avenir', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
    },
  },
  plugins: [],
}
