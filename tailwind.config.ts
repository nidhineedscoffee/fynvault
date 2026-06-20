import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#191c1e",
        paper: "#f7f9fb",
        line: "#c6c6cd",
        moss: "#515f74",
        fern: "#009668",
        mint: "#6ffbbe",
        rust: "#ba1a1a",
        coal: "#2d3133",
        slate: "#131b2e",
        cloud: "#f2f4f6",
        mist: "#e6e8ea",
        bluewash: "#d5e3fd"
      },
      boxShadow: {
        panel: "0 1px 0 rgba(15,23,42,0.04), 0 18px 48px rgba(15,23,42,0.08)"
      }
    }
  },
  plugins: []
};

export default config;
