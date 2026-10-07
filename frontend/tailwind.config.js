/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fbf8f2',
          100: '#f6efdf',
          200: '#eddcb9',
          300: '#e1c38b',
          400: '#d5a75e',
          500: '#c58d3c',
          600: '#a9702e',
          700: '#865327',
          800: '#6d4325',
          900: '#5b3823',
          950: '#341d10',
          gold: '#D4AF37',
          bronze: '#CD7F32',
        },
        dark: {
          bg: '#0B0D11',
          surface: '#12161D',
          card: '#181D26',
          border: '#262D3B',
          muted: '#8A94A6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
