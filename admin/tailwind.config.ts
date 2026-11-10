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
      // The storefront's single most distinctive rule: strictly geometric,
      // near-zero corners everywhere — nothing softens into a pill/blob.
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "2px",
        md: "2px",
        lg: "3px",
        xl: "4px",
        "2xl": "4px",
        "3xl": "4px",
        full: "2px",
      },
      boxShadow: {
        // The brand uses flat hairline borders, not elevation — kept only
        // for any leftover `shadow-sm` usage on unmigrated pages, and
        // deliberately unchanged (not deeper) so it stays unobtrusive.
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.03)",
      },
    },
  },
  plugins: [],
};

export default config;
