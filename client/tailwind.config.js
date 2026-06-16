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
        // Primary brand color — blue
        brand: {
          DEFAULT: "#2f6bff",
          light: "#5b8cff",
          dark: "#1e4fd6",
        },
        // secondary accent
        pai: {
          cyan: "#22d3ee",
        },
        up: "#26d07c",
        down: "#ff5a6a",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(47,107,255,0.45)",
      },
    },
  },
  plugins: [],
};
