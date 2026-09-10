import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#ffffff",
        canvas: "#fafaf9",
        ink: "#161513",
        graphite: "#4a4744",
        hairline: "#eeece8",
        hermes: {
          50: "#fff3ea",
          100: "#ffe2cc",
          300: "#ff9d52",
          500: "#f2600c",
          600: "#d94f04",
          700: "#b33f03",
        },
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
    },
  },
  plugins: [],
};

export default config;
