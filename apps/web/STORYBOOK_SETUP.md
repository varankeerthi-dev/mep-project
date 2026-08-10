# Storybook Setup Guide

## Prerequisites

Storybook is not yet installed in this project. The story files have been created and are ready to use once Storybook is set up.

## Installation

Run the following commands from the `apps/web` directory:

```bash
# Install Storybook dependencies
npm install --save-dev \
  @storybook/react \
  @storybook/react-vite \
  @storybook/addon-links \
  @storybook/addon-essentials \
  @storybook/addon-interactions \
  @storybook/addon-a11y \
  @storybook/test \
  storybook
```

Or using the Storybook CLI (recommended):

```bash
npx storybook@latest init
```

## Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

## Configuration

The following files have been created:

- `.storybook/main.ts` — Framework config (React + Vite)
- `.storybook/preview.ts` — Global decorators, backgrounds, a11y config
- `src/components/ui/Button.stories.tsx` — Button component stories

## Story Coverage

The Button story file covers:

| Category | Stories |
| --- | --- |
| Variants | Primary, Secondary, Outline, Ghost, Destructive, Link, All Variants |
| Sizes | XS, SM, MD, LG, All Sizes, Icon Sizes |
| States | Disabled, Loading, All States, States Per Variant |
| Icons | Left Icon, Right Icon, Icon Only, Standard Icons |
| Text | Long Text / Truncation |
| Layout | Full Width |
| Patterns | Action Hierarchy, Variant × Size Matrix |
| IconButton | Variants, Disabled |
| Dark Mode | All variants on dark background |
| Playground | Interactive controls |

## Running

```bash
# Start Storybook dev server
npm run storybook

# Build static Storybook
npm run build-storybook
```

Storybook will be available at `http://localhost:6006`.

## Adding New Stories

1. Create a `ComponentName.stories.tsx` file next to the component
2. Import the component and define meta
3. Export stories for each variant/state/combination
4. Stories auto-appear in Storybook sidebar

## Visual Regression

Once Storybook is running, use Chromatic or Percy for visual regression:

```bash
# Install Chromatic
npm install --save-dev chromatic

# Run Chromatic
npx chromatic --project-token=<your-token>
```
