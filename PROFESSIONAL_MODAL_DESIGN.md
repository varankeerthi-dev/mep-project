# Professional Enterprise Modal Design System
**Version:** 1.0 (High-Density / Rounded-None Aesthetic)

## 1. Visual Philosophy
*   **High-Density**: Minimize wasted whitespace to show more information without clutter.
*   **Precision**: Use fixed spacing (8px grid) and crisp, non-rounded edges (4px max) for a professional "command center" feel.
*   **Hierarchy**: Strong distinction between primary text, secondary metadata, and muted labels.

## 2. Color Tokens
| Token | Value | Usage |
| :--- | :--- | :--- |
| **Surface (Card)** | `#FFFFFF` | Main modal body background |
| **Surface (Page)** | `#F8F9FA` | Inputs, footers, and background contrasts |
| **Border** | `#E5E7EB` | Hairline dividers and input strokes |
| **Accent** | `#DC2626` | Destructive actions or critical status |
| **Text Primary** | `#111827` | Headlines and active input text |
| **Text Secondary** | `#6B7280` | Body text and sub-headers |
| **Text Muted** | `#9CA3AF` | Captions and inactive placeholders |

## 3. Typography (Inter Stack)
| Element | Size | Weight | Transformation |
| :--- | :--- | :--- | :--- |
| **Modal Title** | `1.125rem` (18px) | 700 | Sentence case |
| **Form Labels** | `0.75rem` (12px) | 600 | ALL CAPS / 0.04em track |
| **Input Text** | `0.875rem` (14px) | 400 | - |
| **Buttons** | `0.875rem` (14px) | 600 | - |
| **Monospace** | `0.8125rem` (13px) | 500 | (JetBrains Mono for IDs) |

## 4. Spacing & Layout
*   **Overlay**: `rgba(0,0,0,0.5)` with `backdrop-filter: blur(2px)`
*   **Container Width**: `640px` (Standard Form), `800px` (Data Rich), `1100px` (Dashboard)
*   **Main Padding**: `1.25rem` (20px) uniform.
*   **Form Grid Gap**: `1rem` (16px) between rows; `0.375rem` (6px) between label and input.
*   **Border Radius**: `0.375rem` (6px) for a subtle modern curve, or `0px` for the "Enterprise Command" look.

## 5. Component Anatomy

### Header
*   **Height**: `56px`
*   **Elements**: Title (Left), Close Button (Right - 32x32px ghost button)
*   **Separator**: `1px solid #E5E7EB`

### Form Inputs
*   **Height**: `38px` (High-density)
*   **State (Focus)**: `Border: 1px solid #DC2626`, `Background: #FFFFFF`
*   **Background (Default)**: `#F8F9FA` (Contrast against card surface)

### Footer
*   **Background**: `#F8F9FA`
*   **Height**: `64px`
*   **Layout**: `flex-end` alignment with `0.75rem` (12px) gap between actions.
