/** @type {import('tailwindcss').Config} */
// ============================================
// DESIGN.md compliance — Phase 5.4 (T11)
// ============================================
// Tailwind v4 reads design tokens from `@theme inline` in
// src/index.css. This file is kept for shadcn compatibility
// (the shadcn components consume CSS variables declared here).
//
// We mirror the DESIGN.md tokens below so the v3 tooling and
// IDE autocompletion stay useful. The single source of truth
// is the @theme block in index.css.
//
// Palette mapping (DESIGN.md §2):
//   canvas     #F9FAFB   background surface
//   pure       #FFFFFF   card / container
//   ink        #18181B   primary text (zinc-950 equivalent)
//   steel      #71717A   secondary text (zinc-500 equivalent)
//   whisper    rgba(226,232,240,0.5)  card border
//   executive  #2563EB   accent CTA / focus ring
//   success    #059669   positive
//   warning    #D97706   caution
//   critical   #DC2626   error / overdue
//
// Typography (DESIGN.md §3):
//   display  Geist (loaded via @fontsource-variable/geist)
//   body     Satoshi — NOT INSTALLED. Falls back to Inter.
//   mono     JetBrains Mono (loaded for code/numerics)
//
// Satoshi gap: add `@fontsource-variable/satoshi` to
// package.json and update --font-body in index.css to
// switch the body font. Out of scope for v1.
// ============================================
module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // Legacy shadcn inter token — kept for shadcn primitives.
        inter: ['Inter', 'system-ui', 'sans-serif'],
        // DESIGN.md §3 — display / body / mono tokens.
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        // DESIGN.md §2 — palette tokens (mirror of @theme inline in index.css).
        canvas: "var(--color-canvas)",
        pure: "var(--color-pure)",
        ink: "var(--color-ink)",
        steel: "var(--color-steel)",
        whisper: "var(--color-whisper)",
        executive: "var(--color-executive)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        critical: "var(--color-critical)",
        // shadcn / existing — kept for compatibility.
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary-shadcn))",
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
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
