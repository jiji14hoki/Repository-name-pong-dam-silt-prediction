/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#0a1f3d', 800: '#0f2d56', 700: '#16417a' },
        reservoir: { 500: '#1f6fb2', 400: '#3b8ccb', 300: '#7fb4de' },
        teal: { 600: '#2b8a8a', 500: '#3aa0a0' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'] },
    },
  },
  plugins: [],
}
