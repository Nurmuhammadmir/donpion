import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Same brand tokens as the storefront (client/tailwind.config.ts) —
        // the admin used to run its own unrelated blue/orange palette;
        // this is what makes "Витрина" actually look like the real site.
        paper: "#ffffff",
        canvas: "#FAF9F6",
        ink: "#1A1A1A",
        graphite: "#5A564F",
        hairline: "#E7E1D6",
        navy: "#131026",
        hermes: {
          50: "#FDECE0",
          100: "#FAD3B8",
          300: "#F5A46A",
          500: "#F9511D",
          600: "#D85A0F",
          700: "#B3480D",
        },
        // Kept for pages not yet migrated to the new palette above.
        sapphire: {
          50: "#eaf1fd",
          100: "#cfe0fa",
          300: "#5c8de8",
          500: "#164ec4",
          600: "#0f3a9c",
          700: "#0a2a73",
          900: "#071c4d",
        },
      },
      fontFamily: {
        display: ["\"Playfair Display\"", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        luxe: "0.02em",
        wide2: "0.14em",
      },
      // The admin is its own product, not a mirror of the storefront's
      // sharp-geometric print-brand look — soft, rounded, Apple-like
      // instead: generous radii, real (if gentle) elevation.
      borderRadius: {
        none: "0",
        sm: "8px",
        DEFAULT: "10px",
        md: "12px",
        lg: "14px",
        xl: "18px",
        "2xl": "22px",
        "3xl": "28px",
        full: "9999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(17,17,17,0.04), 0 1px 1px rgba(17,17,17,0.03)",
        DEFAULT: "0 2px 10px rgba(17,17,17,0.06), 0 1px 2px rgba(17,17,17,0.04)",
        md: "0 6px 20px rgba(17,17,17,0.08), 0 2px 6px rgba(17,17,17,0.04)",
        lg: "0 16px 40px rgba(17,17,17,0.14), 0 4px 10px rgba(17,17,17,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
