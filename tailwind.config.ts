import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#ffb3b5",
        "primary-container": "#7a1f2b",
        "on-primary": "#ffffff",
        secondary: "#94979c",
        surface: "#0a0a0a",
        "surface-container-low": "#121212",
        "outline-variant": "rgba(255, 255, 255, 0.08)",
        "on-surface": "#e0e2e8",
        "on-background": "#e0e2e8",
        "accent-lime": "#d4ff33",
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
      },
      spacing: {
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "40px",
        xxl: "64px",
        section: "120px",
        "container-margin": "32px"
      },
      fontFamily: {
        "display-lg": ["Manrope", "var(--font-platform-sans)", "sans-serif"],
        "headline-lg": ["Manrope", "var(--font-platform-sans)", "sans-serif"],
        "body-lg": ["var(--font-platform-sans)", "sans-serif"],
        "data-mono": ["var(--font-platform-mono)", "monospace"]
      },
      fontSize: {
        "display-lg": ["64px", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "800" }],
        "headline-lg": ["36px", { lineHeight: "1.2", fontWeight: "700" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }]
      }
    }
  },
  plugins: []
};

export default config;
