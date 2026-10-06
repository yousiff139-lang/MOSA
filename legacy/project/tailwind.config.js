/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'theme-base': 'var(--color-bg-base)',
        'theme-solid': 'var(--color-bg-solid)',
      }
    },
  },
  plugins: [],
};
