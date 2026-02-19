/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./entrypoints/popup/index.html",
    "./entrypoints/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
