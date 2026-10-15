import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Pure white canvas — brand palette is Tiffany Blue + white.
        paper: "#FFFFFF",
        // Deep graphite/near-black for all copy.
        ink: "#1A1A1A",
        graphite: "#595959",
        hairline: "#E3EFEE",
        // Header/nav background — near-black, so white logo/text and the
        // Tiffany accent both read clearly against it (kept as `navy` for
        // drop-in compatibility with every existing `bg-navy` usage).
        navy: "#141414",
        // The one permitted accent — Tiffany Blue. Used strictly for CTAs,
        // discount tags and micro-indicators. Never as a large fill.
        hermes: {
          50: "#EAFBFA",
          100: "#CFF3F0",
          300: "#6FD6CE",
          500: "#0ABAB5",
          600: "#099B97",
          700: "#077A77",
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
