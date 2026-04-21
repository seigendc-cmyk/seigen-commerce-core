import type { Config } from "tailwindcss";

/**
 * Brand separation (SOT):
 * - `brand.*` = **public** seiGEN Commerce corporate (Orange + Charcoal Grey) — landing, marketing, signup CTAs.
 * - `teal-*`, `lime-*`, `vc-*`, `shadow-vc-*` = **internal** Vendor Core / dashboard / back office only.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#E85D04",
          "orange-hover": "#D45404",
          charcoal: "#1A1A1A",
          "charcoal-soft": "#2D2D2D",
          surface: "#242424",
          muted: "#A3A3A3",
        },
        vc: {
          teal: {
            DEFAULT: "#14b8a6",
            muted: "#5eead4",
            deep: "#0f766e",
          },
          lime: {
            DEFAULT: "#84cc16",
            bright: "#a3e635",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-montserrat)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        "vc-card": "0 1px 0 rgb(255 255 255 / 0.6) inset, 0 1px 2px rgb(15 23 42 / 0.06), 0 8px 24px rgb(15 23 42 / 0.06)",
        "vc-glow-teal": "0 0 0 1px rgb(20 184 166 / 0.25), 0 12px 40px rgb(15 118 110 / 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
