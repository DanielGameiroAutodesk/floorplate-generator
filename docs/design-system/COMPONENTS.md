# Forma Design System Components

This document provides a comprehensive guide to using Forma Design System web components.

---

## Getting Started

### Step 1: Set up the Base CSS

Add this line to the `<head>` section of your HTML document:

```html
<head>
  <!-- Forma Design System Base Styles (required) -->
  <link rel="stylesheet" href="https://app.autodeskforma.eu/design-system/v2/forma/styles/base.css"/>
</head>
```

This provides foundation styles including typography, colors, and base element styling.

### Step 2: Import Component Modules

Add script imports for the components you need. Load them as ES modules:

```html
<head>
  <!-- Base CSS (required) -->
  <link rel="stylesheet" href="https://app.autodeskforma.eu/design-system/v2/forma/styles/base.css"/>

  <!-- Weave Web Components (import only what you need) -->
  <script type="module" src="https://app.autodeskforma.eu/design-system/v2/weave/components/button/weave-button.js"></script>
  <script type="module" src="https://app.autodeskforma.eu/design-system/v2/weave/components/dropdown/weave-select.js"></script>
  <script type="module" src="https://app.autodeskforma.eu/design-system/v2/weave/components/checkbox/weave-checkbox.js"></script>
  <script type="module" src="https://app.autodeskforma.eu/design-system/v2/weave/components/input/weave-input.js"></script>
  <script type="module" src="https://app.autodeskforma.eu/design-system/v2/weave/components/slider/weave-slider.js"></script>
</head>
```

### Step 3: Use Components in HTML

Add Weave components to your `<body>` like regular HTML elements:

```html
<body>
  <weave-button variant="solid">Generate</weave-button>
</body>
```

---

## CDN URLs Reference

| Resource | URL |
|----------|-----|
| Base CSS | `https://app.autodeskforma.eu/design-system/v2/forma/styles/base.css` |
| Button | `https://app.autodeskforma.eu/design-system/v2/weave/components/button/weave-button.js` |
| Dropdown | `https://app.autodeskforma.eu/design-system/v2/weave/components/dropdown/weave-select.js` |
| Checkbox | `https://app.autodeskforma.eu/design-system/v2/weave/components/checkbox/weave-checkbox.js` |
| Input | `https://app.autodeskforma.eu/design-system/v2/weave/components/input/weave-input.js` |
| Slider | `https://app.autodeskforma.eu/design-system/v2/weave/components/slider/weave-slider.js` |

---

## Component Reference

### Button (`<weave-button>`)

#### Props

| Prop | Type | Values | Default |
|------|------|--------|---------|
| `variant` | string | `"outlined"`, `"flat"`, `"solid"` | `"outlined"` |
| `density` | string | `"high"`, `"medium"` | `"medium"` |
| `type` | string | `"button"`, `"submit"`, `"reset"` | `"button"` |
| `iconposition` | string | `"left"`, `"right"` | `"left"` |
| `disabled` | boolean | `true`, `false` | `false` |

#### Usage Examples

```html
<!-- Solid button (primary action) -->
<weave-button variant="solid" onClick="handleGenerate()">
  Generate
</weave-button>

<!-- Outlined button (secondary action) -->
<weave-button variant="outlined" onClick="handleCancel()">
  Cancel
</weave-button>

<!-- Flat button (tertiary action) -->
<weave-button variant="flat" onClick="handleMore()">
  More options
</weave-button>

<!-- High density button -->
<weave-button variant="solid" density="high">
  Compact
</weave-button>
```

---

### Select (`<weave-select>`)

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `placeholder` | string | Placeholder text when no selection |
| `value` | string | Currently selected value |
| `disabled` | boolean | Disable the select |

#### Usage Examples

```html
<!-- Basic select -->
<weave-select placeholder="Select an option">
  <weave-select-option value="option1">Option 1</weave-select-option>
  <weave-select-option value="option2">Option 2</weave-select-option>
  <weave-select-option value="option3">Option 3</weave-select-option>
</weave-select>

<!-- Select with preselected value -->
<weave-select>
  <weave-select-option value="north" selected>North</weave-select-option>
  <weave-select-option value="south">South</weave-select-option>
</weave-select>
```

---

### Select Option (`<weave-select-option>`)

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `value` | string | Value to emit when selected |
| `selected` | boolean | Whether this option is selected |
| `disabled` | boolean | Disable this option |

---

### Checkbox (`<weave-checkbox>`)

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `checked` | boolean | Whether checkbox is checked |
| `label` | string | Label text for the checkbox |
| `disabled` | boolean | Disable the checkbox |

#### Usage Examples

```html
<!-- Checkbox with label -->
<weave-checkbox label="Enable feature"></weave-checkbox>

<!-- Pre-checked checkbox -->
<weave-checkbox label="Include in export" checked></weave-checkbox>

<!-- Checkbox without label (standalone) -->
<weave-checkbox></weave-checkbox>
```

---

### Input (`<weave-input>`)

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `type` | string | Input type (`"text"`, `"number"`, etc.) |
| `placeholder` | string | Placeholder text |
| `value` | string | Current value |
| `disabled` | boolean | Disable the input |

#### Usage Examples

```html
<!-- Text input -->
<weave-input type="text" placeholder="Enter name"></weave-input>

<!-- Numeric input -->
<weave-input type="number" placeholder="0" value="100"></weave-input>

<!-- Input with unit suffix (custom styling needed) -->
<div class="input-with-unit">
  <weave-input type="number" value="1.83"></weave-input>
  <span class="unit">m</span>
</div>
```

---

### Slider (`<weave-slider>`)

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `min` | number | Minimum value |
| `max` | number | Maximum value |
| `value` | number | Current value |
| `step` | number | Step increment |
| `disabled` | boolean | Disable the slider |

#### Usage Examples

```html
<!-- Basic slider -->
<weave-slider min="0" max="100" value="50"></weave-slider>

<!-- Slider with step -->
<weave-slider min="0" max="1" value="0.5" step="0.1"></weave-slider>

<!-- Slider with input (pattern from PDF) -->
<div class="slider-with-input">
  <weave-slider min="0" max="10" value="1"></weave-slider>
  <weave-input type="number" value="1"></weave-input>
  <span class="unit">m</span>
</div>
```

---

## Event Handling

### Button Click

```javascript
// Using addEventListener
document.querySelector('weave-button').addEventListener('click', (e) => {
  console.log('Button clicked');
});

// Using inline handler
// <weave-button onClick="handleClick()">
```

### Select Change

```javascript
document.querySelector('weave-select').addEventListener('change', (e) => {
  console.log('Selected value:', e.detail.value);
});
```

### Checkbox Change

```javascript
document.querySelector('weave-checkbox').addEventListener('change', (e) => {
  console.log('Checked:', e.target.checked);
});
```

### Input Change

```javascript
document.querySelector('weave-input').addEventListener('input', (e) => {
  console.log('Value:', e.target.value);
});
```

### Slider Change

```javascript
document.querySelector('weave-slider').addEventListener('input', (e) => {
  console.log('Slider value:', e.target.value);
});
```

---

## TypeScript Type Declarations

For TypeScript projects, create a `weave.d.ts` file:

```typescript
declare namespace JSX {
  interface IntrinsicElements {
    'weave-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      variant?: 'outlined' | 'flat' | 'solid';
      density?: 'high' | 'medium';
      type?: 'button' | 'submit' | 'reset';
      iconposition?: 'left' | 'right';
      disabled?: boolean;
    }, HTMLElement>;

    'weave-select': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      placeholder?: string;
      value?: string;
      disabled?: boolean;
      onChange?: (e: CustomEvent) => void;
    }, HTMLElement>;

    'weave-select-option': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      value?: string;
      selected?: boolean;
      disabled?: boolean;
    }, HTMLElement>;

    'weave-checkbox': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      checked?: boolean;
      label?: string;
      disabled?: boolean;
    }, HTMLElement>;

    'weave-input': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      type?: string;
      placeholder?: string;
      value?: string;
      disabled?: boolean;
    }, HTMLElement>;

    'weave-slider': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      min?: number;
      max?: number;
      value?: number;
      step?: number;
      disabled?: boolean;
    }, HTMLElement>;
  }
}
```

---

## Component Variants (from PDF)

| Component | Variants | Notes |
|-----------|----------|-------|
| Button | Solid, Outline | Primary vs secondary actions |
| Input | Normal (with unit), Numeric | Value + unit pattern |
| Dropdown | Box style | Use weave-select |
| Checkbox | Button, With label | Both styles available |
| Radio button | Button, With label | For mutually exclusive options |
| Slider | Basic, Slider + input | Combine with numeric input |
| Menu container | With title & close | Modal-like container |
| Tile | Horizontal, Vertical | Card layouts |

---

## External Resources

- **Forma Design System Storybook**: https://app.autodeskforma.eu/design-system/v2/docs/
- **Autodesk Weave Storybook**: https://storybook.weave.autodesk.com/
- **Example Extension**: https://github.com/autodesk-platform-services/aps-forma-extension-shadow-study

---

## Source

Extracted from:
- `Extension Guides/Common components.pdf`
- Shadow Study Example Extension
- Forma Design System CDN
