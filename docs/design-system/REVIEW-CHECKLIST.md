# Design System Review Checklist

This checklist helps review the Floorplate Generator extension for Forma Design System compliance.

---

## Quick Status

| Aspect | Current | Forma Standard | Status |
|--------|---------|----------------|--------|
| Primary color | `#4f46e5` (indigo) | `#0696D7` (blue) | Needs update |
| Text color | `#3C3C3C` | `#3C3C3C` | OK |
| Background | `#1a1a1a` (dark) | `#FFFFFF` (white) | Needs update |
| Font | System fonts | Artifakt Element | Needs update |
| Spacing | Magic numbers | 4px grid | Needs update |
| Components | Custom styled | Weave components | Review needed |

---

## Files to Review

### 1. Main Panel - [src/extension/index.html](../../src/extension/index.html)

**Size:** ~1550 lines (5000+ lines CSS embedded)

#### Colors
- [ ] Replace `#4f46e5` (indigo) with `#0696D7` (Forma blue)
- [ ] Replace `#1a1a1a` dark backgrounds with `#FFFFFF` white
- [ ] Update text colors to use `#3C3C3C` (default) and `#747474` (dim)
- [ ] Update link colors to `#006EAF`
- [ ] Review secondary colors (red, green, orange, purple)

#### Typography
- [ ] Add Artifakt Element font family
- [ ] Update header sizes (12px bold, 11px semi-bold)
- [ ] Update body text (11px regular, 18px line-height)
- [ ] Remove any ALL CAPS text
- [ ] Remove any italic text

#### Spacing
- [ ] Replace magic numbers with 4px grid values
- [ ] Set panel padding to 16px
- [ ] Set element spacing to multiples of 4px
- [ ] Review component margins and padding

#### Components
- [ ] Consider replacing custom buttons with `<weave-button>`
- [ ] Consider replacing custom dropdowns with `<weave-select>`
- [ ] Consider replacing custom checkboxes with `<weave-checkbox>`
- [ ] Consider replacing custom inputs with `<weave-input>`
- [ ] Consider replacing custom sliders with `<weave-slider>`

#### Content
- [ ] Review button labels for action verbs
- [ ] Check for sentence case (not Title Case)
- [ ] Review error messages for helpfulness
- [ ] Check for emojis (should be removed)

---

### 2. Floating Panel - [src/extension/floorplate-panel.html](../../src/extension/floorplate-panel.html)

**Size:** ~375 lines

#### Same as Main Panel
- [ ] Colors
- [ ] Typography
- [ ] Spacing
- [ ] Components
- [ ] Content

---

### 3. Metrics Panel - [src/extension/components/MetricsPanel.ts](../../src/extension/components/MetricsPanel.ts)

**Size:** ~240 lines (inline styles)

- [ ] Replace hardcoded color hex values
- [ ] Update spacing values to 4px grid
- [ ] Review typography sizes
- [ ] Consider extracting styles to CSS

---

### 4. SVG Renderer - [src/extension/components/FloorplateSVG.ts](../../src/extension/components/FloorplateSVG.ts)

**Size:** ~450 lines

- [ ] Review unit colors (these may be intentionally different for visualization)
- [ ] Review text labels in SVG for typography compliance
- [ ] Check any UI elements for color compliance

---

## Add Design System Setup

### Step 1: Add Base CSS

In both HTML files, add to `<head>`:

```html
<link rel="stylesheet" href="https://app.autodeskforma.eu/design-system/v2/forma/styles/base.css"/>
```

### Step 2: Add Component Scripts (if using Weave components)

```html
<script type="module" src="https://app.autodeskforma.eu/design-system/v2/weave/components/button/weave-button.js"></script>
<script type="module" src="https://app.autodeskforma.eu/design-system/v2/weave/components/dropdown/weave-select.js"></script>
<script type="module" src="https://app.autodeskforma.eu/design-system/v2/weave/components/checkbox/weave-checkbox.js"></script>
<script type="module" src="https://app.autodeskforma.eu/design-system/v2/weave/components/input/weave-input.js"></script>
<script type="module" src="https://app.autodeskforma.eu/design-system/v2/weave/components/slider/weave-slider.js"></script>
```

### Step 3: Add CSS Variables

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

  /* Spacing */
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

## Color Migration Guide

### Find and Replace

| Current | Replace With | Token |
|---------|--------------|-------|
| `#4f46e5` | `#0696D7` | Active/primary |
| `#1a1a1a` | `#FFFFFF` | Background |
| `#374151` | `#3C3C3C` | Text default |
| `#6b7280` | `#747474` | Text dim |
| `#9ca3af` | `#ABABAB` | Placeholder |
| `#e5e7eb` | `#D9D9D9` | Border |

### Search Commands

```bash
# Find current primary color
grep -r "#4f46e5" src/

# Find dark backgrounds
grep -r "#1a1a1a" src/

# Find all hex colors
grep -rE "#[0-9a-fA-F]{6}" src/
```

---

## Typography Migration

### Current → Forma

| Current | Forma |
|---------|-------|
| Various fonts | Artifakt Element |
| Various sizes | 11px (body), 12px (header) |
| Various weights | Regular, Semi-bold, Bold |
| Inconsistent line heights | 18px for body |

---

## Spacing Migration

### Current → Forma (4px grid)

| Current | Forma |
|---------|-------|
| `padding: 12px` | `padding: var(--forma-space-3)` or `12px` |
| `padding: 16px` | `padding: var(--forma-space-4)` or `16px` |
| `padding: 20px` | `padding: var(--forma-space-4)` or `16px` |
| `margin: 8px` | `margin: var(--forma-space-2)` or `8px` |
| `gap: 10px` | `gap: var(--forma-space-2)` or `8px` |

---

## Component Migration Examples

### Button

**Before:**
```html
<button class="generate-btn">Generate Floorplate</button>
```

**After:**
```html
<weave-button variant="solid">Generate floorplate</weave-button>
```

### Select

**Before:**
```html
<select class="core-select">
  <option value="North">North</option>
  <option value="South">South</option>
</select>
```

**After:**
```html
<weave-select>
  <weave-select-option value="North">North</weave-select-option>
  <weave-select-option value="South">South</weave-select-option>
</weave-select>
```

### Checkbox

**Before:**
```html
<label>
  <input type="checkbox" class="smart-defaults">
  Use smart defaults
</label>
```

**After:**
```html
<weave-checkbox label="Use smart defaults"></weave-checkbox>
```

---

## Manual Review Required

### Templates.pdf

**Location:** `Forma UI Design Documentation/Extension Guides/Templates.pdf`
**Size:** 19.5MB (too large for automated processing)

This file contains detailed UI templates and examples that should be reviewed manually for:
- Complete extension layouts
- Detailed component configurations
- Advanced patterns

---

## Verification Steps

After making changes:

1. **Visual check** - Does it look consistent with Forma?
2. **Color check** - Run `grep -r "#4f46e5" src/` (should return empty)
3. **Typography check** - Verify fonts load correctly
4. **Component check** - Test all interactive elements
5. **Content check** - Verify sentence case and wording
6. **Spacing check** - Verify 16px padding on panels

---

## Resources

- [Forma Design System Storybook](https://app.autodeskforma.eu/design-system/v2/docs/)
- [Autodesk Weave Storybook](https://storybook.weave.autodesk.com/)
- [Shadow Study Example](https://github.com/autodesk-platform-services/aps-forma-extension-shadow-study)
- [Forma Developer Docs](https://aps.autodesk.com/en/docs/forma/v1/overview/welcome-to-forma/)
