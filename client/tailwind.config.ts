import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Warm ivory canvas — never sterile white, never cool grey.
        paper: "#FAF9F6",
        // Deep graphite/near-black for all copy.
        ink: "#1A1A1A",
        graphite: "#5A564F",
        hairline: "#E7E1D6",
        // Header/nav background — deep indigo-black, distinct from `ink`.
        navy: "#131026",
        // The one permitted accent — used strictly for CTAs, discount tags
        // and micro-indicators. Never as a large fill.
        hermes: {
          50: "#FDECE0",
          100: "#FAD3B8",
          300: "#F5A46A",
          500: "#F9511D",
          600: "#D85A0F",
          700: "#B3480D",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.03em",
        luxe: "0.02em",
        wide2: "0.14em",
      },
      // House style is strictly geometric — cap every rounded-* utility at
      // a hairline radius so nothing in the app can accidentally regress
      // to soft/pill shapes.
      borderRadius: {
        none: "0px",
        sm: "2px",
        DEFAULT: "2px",
        md: "2px",
        lg: "3px",
        xl: "4px",
        "2xl": "4px",
        "3xl": "4px",
        full: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
