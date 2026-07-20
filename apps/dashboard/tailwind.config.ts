import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        navy: {
          DEFAULT: '#0B1F3A',
          50: '#E8EEF5',
          100: '#C5D2E3',
          700: '#15345C',
          900: '#0B1F3A',
        },
        brand: {
          DEFAULT: '#00A651',
          50: '#E8F8EF',
          100: '#C5EDD6',
          500: '#00A651',
          600: '#008F45',
          700: '#007A3B',
        },
        muted: {
          DEFAULT: '#F4F6F8',
          foreground: '#5B6B7C',
        },
        border: '#E2E8F0',
        card: '#FFFFFF',
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'Segoe UI', 'sans-serif'],
        display: ['var(--font-syne)', 'var(--font-outfit)', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 8px 24px rgba(11, 31, 58, 0.08)',
      },
      backgroundImage: {
        'pitch-mesh':
          'radial-gradient(ellipse at top left, rgba(0,166,81,0.14), transparent 50%), radial-gradient(ellipse at top right, rgba(11,31,58,0.1), transparent 45%)',
      },
    },
  },
  plugins: [],
};

export default config;
