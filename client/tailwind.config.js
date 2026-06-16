/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Polymarket-style near-black surfaces
        ink: {
          950: "#0a0b0f",
          900: "#0e1016",
          850: "#13151d",
          800: "#181b24",
          700: "#222632",
          600: "#2d3340",
        },
        // Primary brand color — a calmer, refined blue
        brand: {
          DEFAULT: "#3a6ad0",
          light: "#7aa0ec",
          dark: "#284f9e",
        },
        // secondary accent
        pai: {
          cyan: "#22d3ee",
        },
        up: "#26d07c",
        down: "#ff5a6a",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 22px -6px rgba(58,106,208,0.35)",
      },
    },
  },
  plugins: [],
};
