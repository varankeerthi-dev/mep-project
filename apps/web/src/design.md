# Design System Notes

## CSS Specificity Issues & Solutions

### Global Border-Radius Reset Override

**Problem:**
`src/index.css` contains a global reset at line ~540:
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  border-radius: 0 !important;
}
```

This kills ALL `border-radius` on every element. Even Tailwind's `!important` modifier and inline `style` attributes cannot override CSS `!important` declarations.

**Solution:**
Add targeted CSS rules AFTER the global reset for specific selectors:
```css
.classification-card {
  border-radius: 14px !important;
}
```

### Tailwind Utility Override Issue

**Problem:**
Tailwind utility classes (e.g., `p-8`, `px-6`) can be overridden by other CSS rules with higher specificity in large stylesheets (3000+ lines).

**Example:**
```jsx
// This may NOT work if overridden by higher-specificity rules
<button className="p-8 ...">
```

**Solution:**
Use `!important` in the CSS file to ensure the rule wins:
```css
.classification-card {
  padding: 16px !important;
}
```

### When to Use `!important`

Use `!important` in `src/index.css` when:
1. Overriding global resets (like the `border-radius: 0` reset)
2. Tailwind utilities are being overridden by other CSS
3. Component-level styling needs to override base styles

### Pattern for CSS Overrides

```css
/* After the global reset section in index.css */
.component-name {
  border-radius: 14px !important;
  padding: 16px !important;
}

.component-name .child-element {
  border-radius: 9999px !important;
}
```

### Reference Files
- Global reset: `src/index.css` (line ~540)
- Existing overrides: `src/index.css` (line ~2080+)

## AI Slop Patterns to Avoid

### Left Border Accent on Cards

**Problem:**
AI often adds `border-l-[3px]` or similar left border accents to cards/sections for "visual hierarchy". This is a common AI slop pattern that:
- Adds unnecessary visual noise
- Doesn't improve usability
- Looks generic and templated

**Example of what NOT to do:**
```jsx
// ❌ AI slop — left border accent
<section className="border-l-[3px] border-l-[#6366F1] ...">
```

**Better approach:**
Use title color or subtle background variations instead of borders:
```jsx
// ✅ Clean — color on title text only
<section className="...">
  <h2 className="text-[#4F46E5]">Section Title</h2>
</section>
```

### Other AI Slop Patterns to Watch For
- Excessive gradients on simple elements
- Unnecessary shadows on every card
- Overuse of animations/transitions
- Decorative icons that don't add meaning
- Colorful borders on form fields
