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
        // PAI neon brand gradient endpoints
        pai: {
          pink: "#ff3df0",
          purple: "#9b4dff",
          cyan: "#1fd3ff",
        },
        up: "#26d07c",
        down: "#ff5a6a",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(255,61,240,0.35)",
      },
    },
  },
  plugins: [],
};
