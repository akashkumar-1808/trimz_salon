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
        // Redesign tokens
        primary: {
          DEFAULT: '#E60023',
          hover: '#C9001F',
          light: '#FDECEF',
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          500: '#E60023',
          600: '#C9001F',
        },
        workspace: {
          bg: '#F7F6F5',
          card: '#FFFFFF',
          border: '#E8E5E3',
          hover: '#F5F4F3',
        },
        text: {
          primary: '#171717',
          secondary: '#737373',
          muted: '#929292',
        },
        sidebar: {
          start: '#191919',
          end: '#111111',
          border: '#262626',
          active: '#242424',
          text: '#A3A3A3',
          activeText: '#FFFFFF',
        },
        // Brand & dark fallbacks for smooth transition
        brand: {
          red: '#E60023',
          50: '#fdf2f2',
          100: '#fde8e8',
          200: '#fbd5d5',
          300: '#f8b4b4',
          400: '#f98080',
          500: '#E60023',
          600: '#C9001F',
          700: '#9b1c1c',
          800: '#771d1d',
          900: '#4a1d1d',
        },
        dark: {
          bg: '#F7F6F5', // mapped to light workspace
          surface: '#FFFFFF',
          card: '#FFFFFF',
          border: '#E8E5E3',
          muted: '#737373',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'sidebar-gradient': 'linear-gradient(180deg, #191919 0%, #111111 100%)',
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.02)',
        'card': '0 2px 6px 0 rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
};
