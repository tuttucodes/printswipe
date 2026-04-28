import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        paper: "#FFFFFF",
        ink: "#0A0A0A",
        hairline: "#E5E5E5",
        accent: "#E8523F",
        darkAccent: "#111111",
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
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Playfair Display", "ui-serif", "Georgia", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sharp: "2px",
        pill: "9999px",
        xl: "1rem",
        "2xl": "1.5rem",
      },
      letterSpacing: {
        smallcaps: "0.12em",
        tighter: "-0.04em",
      },
      boxShadow: {
        hairline: "inset 0 0 0 1px #E5E5E5",
        "glass-sm": "0 4px 30px rgba(0, 0, 0, 0.05)",
        "glass-md": "0 8px 32px rgba(0, 0, 0, 0.08)",
      },
      backgroundImage: {
        'mesh-gradient': "radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%), radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "feed-in": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 400ms cubic-bezier(0.16, 1, 0.3, 1)",
        "feed-in": "feed-in 280ms cubic-bezier(0.32, 0.72, 0, 1)",
        marquee: "marquee 25s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
