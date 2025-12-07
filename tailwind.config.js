/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        primary: 'var(--color-primary)',
        muted: 'var(--color-muted)',
        inverse: 'var(--color-inverse)',
        'bg-inverse': 'var(--color-bg-inverse)',
        accent: 'var(--color-accent)',
      }
    }
  },
  plugins: [],
}
