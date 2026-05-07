# Design System: MEP Project Reports & Management

## 1. Visual Theme & Atmosphere

A restrained, gallery-airy interface with confident asymmetric layouts and fluid spring-physics motion. The atmosphere is clinical yet warm — like a well-lit architecture studio. Density sits at 4 (Daily App Balanced) with variance at 8 (Offset Asymmetric) and motion at 6 (Fluid CSS). The design emphasizes data clarity over decorative elements, using generous whitespace and precise typography to create a sense of professional calm. Every element has purpose and breathing room.

## 2. Color Palette & Roles

- **Canvas White** (#F9FAFB) — Primary background surface, subtle warmth
- **Pure Surface** (#FFFFFF) — Card and container fill, clean data tables
- **Charcoal Ink** (#18181B) — Primary text, Zinc-950 depth for headlines
- **Muted Steel** (#71717A) — Secondary text, descriptions, metadata, timestamps
- **Whisper Border** (rgba(226,232,240,0.5)) — Card borders, 1px structural lines
- **Executive Blue** (#2563EB) — Single accent for CTAs, active states, focus rings
- **Success Green** (#059669) — Positive indicators, completed states
- **Warning Amber** (#D97706) — Caution states, pending items
- **Critical Red** (#DC2626) — Error states, overdue items

## 3. Typography Rules

- **Display:** Geist — Track-tight, controlled scale, weight-driven hierarchy. No screaming sizes.
- **Body:** Satoshi — Relaxed leading (1.6), 65ch max-width, neutral secondary color
- **Mono:** JetBrains Mono — For code, metadata, timestamps, high-density numbers
- **Scale:** clamp(1rem, 2.5vw, 1.125rem) for body, clamp(1.5rem, 4vw, 2rem) for h3
- **Banned:** Inter font, generic system fonts for premium contexts. Serif fonts banned in dashboards.

## 4. Component Stylings

* **Buttons:** Flat, no outer glow. Tactile -1px translate on active. Executive Blue fill for primary, ghost/outline for secondary. Minimum 44px tap targets.
* **Cards:** Generously rounded corners (2.5rem). Diffused whisper shadow. Used only when elevation serves hierarchy. High-density: replace with border-top dividers.
* **Inputs:** Label above, error below. Focus ring in Executive Blue. No floating labels. Clean, minimal styling.
* **Tables:** ERP-style with clean headers, subtle row borders, status badges. No zebra striping.
* **Loaders:** Skeletal shimmer matching exact layout dimensions. No circular spinners.
* **Empty States:** Composed, illustrated compositions — not just "No data" text.
* **Status Badges:** Rounded-full, semantic colors, minimal text.

## 5. Layout Principles

CSS Grid over Flexbox math. Asymmetric splits for Hero sections. Strict single-column collapse below 768px. Max-width containment (1400px centered). Generous internal padding (clamp(1.5rem, 4vw, 2.5rem)). No flexbox percentage math. No overlapping elements — every element occupies its own clear spatial zone.

### Grid System
- **Desktop:** 12-column grid, asymmetric content blocks
- **Tablet:** 8-column grid, adaptive layouts
- **Mobile:** Single-column, full-width elements

### Spacing Philosophy
- **Micro:** 0.25rem (4px) — tight component internals
- **Small:** 0.5rem (8px) — element spacing
- **Medium:** 1rem (16px) — component padding
- **Large:** 1.5rem (24px) — section spacing
- **XL:** 2rem (32px) — page sections
- **XXL:** clamp(3rem, 8vw, 6rem) — major sections

## 6. Motion & Interaction

Spring physics for all interactive elements (stiffness: 100, damping: 20). Staggered cascade reveals for list items. Perpetual micro-loops on active dashboard components. Hardware-accelerated transforms only. Isolated Client Components for CPU-heavy animations.

### Animation Library
- **Fade In:** `opacity: 0 → 1` with `translateY(8px → 0)`
- **Slide In:** `translateX(-16px → 0)` for side panels
- **Scale In:** `scale(0.95 → 1)` for modals
- **Hover:** `scale(1.02)` with `transition: transform 0.2s spring`
- **Active:** `scale(0.98)` with `transition: transform 0.1s ease-out`

## 7. Component-Specific Rules

### Reports Dashboard
- **Metric Cards:** 2.5rem rounded, subtle shadow, hover state
- **Report Categories:** Grid with asymmetric spacing, no 3-column equal layouts
- **Quick Actions:** Floating action button in Executive Blue

### Invoice Reports
- **Table Headers:** Sticky, background: Canvas White, border-bottom: Whisper Border
- **Status Cells:** Semantic color badges, consistent sizing
- **Filter Panel:** Slide-in from right, backdrop blur

### PDF Export
- **Button States:** Loading → Success → Error states
- **Progress Bar:** Executive Blue fill, Whisper Border track

## 8. Responsive Rules

Every design works across all viewports:

### Mobile-First Collapse (< 768px)
- All multi-column layouts collapse to single column
- No horizontal scroll — critical failure if present
- Touch targets minimum 44px
- Typography minimum 1rem/14px

### Tablet (768px - 1024px)
- 2-column layouts where appropriate
- Adaptive navigation
- Maintained spacing ratios

### Desktop (> 1024px)
- Full asymmetric layouts
- Hover states enabled
- Maximum density utilization

## 9. Anti-Patterns (Banned)

**NEVER USE:**
- Emojis anywhere in the interface
- Inter font for premium contexts
- Generic serif fonts (Times New Roman, Georgia, Garamond)
- Pure black (#000000) — use Charcoal Ink instead
- Neon/outer glow shadows on any element
- Oversaturated accent colors (>80% saturation)
- Excessive gradient text on large headers
- Custom mouse cursors
- Overlapping elements — clean spatial separation always
- 3-column equal card layouts ("feature rows")
- Generic placeholder names ("John Doe", "Acme", "Nexus")
- Fake round numbers ("99.99%", "50%") — use realistic data
- AI copywriting clichés ("Elevate", "Seamless", "Unleash", "Next-Gen")
- Filler UI text: "Scroll to explore", "Swipe down", scroll arrows, bouncing chevrons
- Broken image links — use picsum.photos or SVG avatars
- Centered Hero sections for high-variance projects
- Floating labels in forms
- Zebra striping in tables
- Circular loading spinners

## 10. Data Visualization Rules

- **Charts:** Minimal, data-first approach. Executive Blue primary, neutral grays secondary
- **Grid Lines:** Whisper Border, subtle
- **Axis Labels:** Muted Steel, minimal font size
- **Interactive Elements:** Hover states with spring physics
- **Legends:** Inline where possible, separate only when necessary

## 11. Form & Input Patterns

- **Labels:** Above inputs, never floating
- **Placeholders:** Descriptive, not label substitutes
- **Validation:** Inline error messages below fields
- **Success States:** Green checkmark, subtle animation
- **Multi-select:** Clean pill-based interface
- **Date Ranges:** Preset options + custom range picker

## 12. Navigation Architecture

- **Primary Nav:** Horizontal, Executive Blue accent for active
- **Secondary Nav:** Vertical sidebar, subtle hierarchy
- **Breadcrumbs:** Minimal, semantic structure
- **Mobile Menu:** Slide-in from left, backdrop blur

## 13. Performance Guidelines

- **Images:** WebP format, lazy loading, proper sizing
- **Fonts:** Variable fonts for performance where possible
- **Animations:** Transform and opacity only
- **JavaScript:** Isolated Client Components for heavy interactions
- **CSS:** Utility-first with component overrides

This design system enforces a premium, data-focused aesthetic that prioritizes clarity and professional polish over decorative elements. Every rule serves to prevent generic AI design patterns and ensure consistent, high-quality output across all components.
