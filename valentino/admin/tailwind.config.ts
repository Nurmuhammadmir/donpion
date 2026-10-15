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
        hairline: "#e3efee",
        hermes: {
          50: "#eafbfa",
          100: "#cff3f0",
          300: "#6fd6ce",
          500: "#0ABAB5",
          600: "#099b97",
          700: "#077a77",
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
