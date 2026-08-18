import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "text-brand-green",
    "text-brand-orange",
    "text-brand-blue",
    "text-brand-ink",
    "text-brand-muted",
    "bg-brand-green",
    "bg-brand-orange",
    "bg-brand-blue",
    "bg-brand-white",
    "border-brand-green",
    "border-brand-orange",
    "border-brand-blue",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#7EB341",
          orange: "#F79521",
          blue: "#1F82C5",
          white: "#FFFFFF",
          ink: "#1A1A1A",
          muted: "#6B7280",
          error: "#DC2626",
        },
      },
      fontFamily: {
        display: ["var(--font-brand-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-brand-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
