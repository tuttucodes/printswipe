import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      colors: {
        paper: "#FAFAF7",
        ink: "#0A0A0A",
        hairline: "#1A1A1A",
        accent: "#EF3340",
        status: {
          scheduled: "#3B82A0",
          bundled: "#B8860B",
          printed: "#5B21B6",
          ready: "#15803D",
          collected: "#525252",
          failed: "#7F1D1D",
        },
      },
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sharp: "2px",
        pill: "9999px",
      },
      letterSpacing: {
        smallcaps: "0.18em",
      },
      boxShadow: {
        hairline: "inset 0 0 0 1px #1A1A1A",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "feed-in": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 200ms cubic-bezier(0.32, 0.72, 0, 1)",
        "feed-in": "feed-in 280ms cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
