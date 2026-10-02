import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
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
          cream: "#FFF6E8",
          navy: "#123B7A",
          ink: "#1A1A1A",
          muted: "#6B7280",
          error: "#DC2626",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        display: ["var(--font-brand-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-brand-body)", "system-ui", "sans-serif"],
        hand: ["var(--font-brand-hand)", "cursive"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
