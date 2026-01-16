# Design Foundations

This document contains the core design tokens for the Forma Design System.

---

## Colors

The color scheme within Forma provides categories for commonly used colors.

### Surface Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--forma-surface-100` | `#FFFFFF` | Primary background (Level 100) |
| `--forma-surface-200` | `#F5F5F5` | Secondary background (Level 200) |
| `--forma-surface-250` | `#EEEEEE` | Tertiary background (Level 250) |
| `--forma-surface-300` | `#D9D9D9` | Border/divider (Level 300) |
| `--forma-surface-350` | `#CCCCCC` | Darker border (Level 350) |

### Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--forma-text-default` | `#3C3C3C` | Default text color |
| `--forma-text-dim` | `#747474` | Secondary/dim text |
| `--forma-text-placeholder` | `#ABABAB` | Placeholder text |
| `--forma-text-link` | `#006EAF` | Links and interactive text |

### Icon Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--forma-icon-default` | `#808080` | Default icon state |
| `--forma-icon-hover` | `#3C3C3C` | Icon hover state |
| `--forma-icon-on-default` | `#0696D7` | Active/selected icon |
| `--forma-icon-on-hover` | `#006EAF` | Active icon hover |

### Secondary Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--forma-red` | `#EB5555` | Errors, warnings |
| `--forma-blue` | `#3970B9` | Information |
| `--forma-green` | `#87B340` | Success, positive |
| `--forma-yellow` | `#FAA21B` | Warnings, caution |
| `--forma-turquoise` | `#32BCAD` | Accent color |

### Color Usage Guidelines

- **Primary colors** are white and gray - they provide simplicity, contrast, and accessibility
- **White** provides air and balance to brand communication
- **Blue** is the active color for selection and text links - use sparingly
- **Canvas** should have color; **panels** should be subtle

### CSS Variables

```css
:root {
  /* Surface */
  --forma-surface-100: #FFFFFF;
  --forma-surface-200: #F5F5F5;
  --forma-surface-250: #EEEEEE;
  --forma-surface-300: #D9D9D9;
  --forma-surface-350: #CCCCCC;

  /* Text */
  --forma-text-default: #3C3C3C;
  --forma-text-dim: #747474;
  --forma-text-placeholder: #ABABAB;
  --forma-text-link: #006EAF;

  /* Icons */
  --forma-icon-default: #808080;
  --forma-icon-hover: #3C3C3C;
  --forma-icon-on-default: #0696D7;
  --forma-icon-on-hover: #006EAF;

  /* Secondary */
  --forma-red: #EB5555;
  --forma-blue: #3970B9;
  --forma-green: #87B340;
  --forma-yellow: #FAA21B;
  --forma-turquoise: #32BCAD;
}
```

---

## Typography

The main font is **Artifakt Element** with defined styles for headers and body text.

### Header Styles

| Style | Weight | Size | Color |
|-------|--------|------|-------|
| Primary header | Bold | 12px | `#3C3C3C` |
| Secondary header | Semi-bold | 11px | `#3C3C3C` |

### Body Styles

| Style | Weight | Size | Line Height | Color |
|-------|--------|------|-------------|-------|
| Body text | Regular | 11px | 18px | `#3C3C3C` |
| Caption | Regular | 11px | 18px | `#3C3C3C` 70% |
| Link | Regular | 11px | - | `#006EAF` |
| Link (hover) | Regular underlined | 11px | - | `#006EAF` |

### Typography Don'ts

| Don't | Reason |
|-------|--------|
| Use colors other than black/white | Maintain consistency |
| Use ALL CAPS | Don't shout at users |
| Use emojis | Not appropriate for customer-facing UI |
| Use italic | Not part of the type system |
| Use underlined text (except links) | Underline reserved for links |
| Adjust letter or line spacing | Use defined styles only |
| Place text close to edges | Respect default 16px spacing |

### CSS Variables

```css
:root {
  --forma-font-family: 'Artifakt Element', sans-serif;

  /* Headers */
  --forma-header-primary-weight: 700;
  --forma-header-primary-size: 12px;
  --forma-header-secondary-weight: 600;
  --forma-header-secondary-size: 11px;

  /* Body */
  --forma-body-weight: 400;
  --forma-body-size: 11px;
  --forma-body-line-height: 18px;
}
```

---

## Spacing

Forma uses a **4px grid system** for consistent spacing throughout the interface.

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--forma-space-1` | 4px | Minimal spacing |
| `--forma-space-2` | 8px | Tight spacing |
| `--forma-space-3` | 12px | Compact spacing |
| `--forma-space-4` | **16px** | **Core spacing** (default) |
| `--forma-space-6` | 24px | Medium spacing |
| `--forma-space-8` | 32px | Large spacing |
| `--forma-space-10` | 40px | Extra large spacing |

### Panel Layout

- **Panel padding**: 16px on all sides
- **Element spacing**: 16px between major UI elements
- **4px grid**: All spacing defined in 4px increments

### CSS Variables

```css
:root {
  --forma-space-1: 4px;
  --forma-space-2: 8px;
  --forma-space-3: 12px;
  --forma-space-4: 16px;
  --forma-space-6: 24px;
  --forma-space-8: 32px;
  --forma-space-10: 40px;
}
```

---

## Icons

Forma uses a custom icon library designed for consistency and clarity.

### Icon Sizes

| Context | Size |
|---------|------|
| Default (UI elements) | **16px** |
| Toolbar / Analysis panel | **24px** |

### Available Icons

| Category | Icons |
|----------|-------|
| Actions | Plus/Add, Minus/Remove, Check, Close, Delete |
| Navigation | Expand/Open, Expand/Close, Arrow back, Arrow forward |
| Visibility | Eye visible, Eye hidden, Lock, Unlock |
| Tools | Edit, Draw, Search, Settings, Filter |
| Information | Help, Info, Spinner, Refresh |
| Layout | Shrink, Expand, Menu, More |
| Files | Download, External link, Export, User |

### Icon Don'ts

| Don't | Reason |
|-------|--------|
| Use colors other than default icon color | Maintain visual consistency |
| Place icons close to edges | Always use 16px spacing from edges |
| Combine elements with icons | Keep icons clean and simple |
| Edit or combine icons | Use single icons only as designed |
| Adjust stroke width | Maintains visual consistency |
| Use fills | Icons use strokes only |

---

## Grid System

The grid creates visual consistency throughout Forma.

### Panel Dimensions

| Element | Width |
|---------|-------|
| Side panel | 260px |
| Panel gap from edge | 16px |
| Internal padding | 16px |

### Grid Specifications

```
+--16--+--260--+--canvas--+--260--+--16--+
|      |       |          |       |      |
| gap  | left  |  main    | right | gap  |
|      | panel |  canvas  | panel |      |
+------+-------+----------+-------+------+
```

---

## Source

Extracted from:
- `Design Foundations/Colors.pdf`
- `Design Foundations/Colors-1.pdf`
- `Design Foundations/Typography.pdf`
- `Design Foundations/Icons.pdf`
- `Design Foundations/Layout.pdf`
