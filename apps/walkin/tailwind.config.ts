import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-barlow)', 'Segoe UI', 'sans-serif'],
        display: ['var(--font-barlow-condensed)', 'var(--font-barlow)', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#00A651',
          600: '#008F45',
        },
        navy: {
          DEFAULT: '#0B1F3A',
          700: '#15345C',
        },
      },
    },
  },
  plugins: [],
};

export default config;
