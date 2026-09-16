import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      colors: {
        primary: "#2f5fa8",
        secondary: "#64748b",
        accent: "#0f8a5f",
        success: "#0f8a5f",
        danger: "#c0392b",
        warning: "#b8860b",
        prestige: "#0f172a",
      },

      borderRadius: {
        "2xl": "0.5rem",
        "3xl": "0.625rem",
        "4xl": "0.75rem",
        "5xl": "0.875rem",
      },

      boxShadow: {
        premium:
          "0 1px 2px rgba(15, 23, 42, 0.06)",

        high:
          "0 2px 8px rgba(15, 23, 42, 0.10)",

        "glow-primary":
          "0 0 0 rgba(0,0,0,0)",

        "glow-success":
          "0 0 0 rgba(0,0,0,0)",

        "inner-light":
          "inset 0 1px 1px rgba(255, 255, 255, 0.4)",
      },

      fontWeight: {
        black: "600",
      },

      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },

  plugins: [],
};

export default config;
