# Forma Design System Documentation

This documentation provides a comprehensive guide for adopting the Autodesk Forma Design System in Forma extensions.

## Quick Start

### 1. Add Base CSS

```html
<link rel="stylesheet" href="https://app.autodeskforma.eu/design-system/v2/forma/styles/base.css"/>
```

### 2. Import Components

```html
<script type="module" src="https://app.autodeskforma.eu/design-system/v2/weave/components/button/weave-button.js"></script>
```

### 3. Use Components

```html
<weave-button variant="solid">Click me</weave-button>
```

---

## External Resources

| Resource | URL |
|----------|-----|
| Forma Design System Storybook | https://app.autodeskforma.eu/design-system/v2/docs/ |
| Autodesk Weave Storybook | https://storybook.weave.autodesk.com/ |
| Base CSS | https://app.autodeskforma.eu/design-system/v2/forma/styles/base.css |
| Example Extension | https://github.com/autodesk-platform-services/aps-forma-extension-shadow-study |
| Forma Developer Docs | https://aps.autodesk.com/en/docs/forma/v1/overview/welcome-to-forma/ |

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [FOUNDATIONS.md](FOUNDATIONS.md) | Colors, Typography, Spacing, Icons |
| [COMPONENTS.md](COMPONENTS.md) | Web Components with usage examples |
| [EXTENSION-PATTERNS.md](EXTENSION-PATTERNS.md) | Extension placement and patterns |
| [CONTENT-GUIDELINES.md](CONTENT-GUIDELINES.md) | Text, tone, and grammar rules |
| [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md) | Adoption checklist for this extension |

---

## Design Principles

### Keep it Simple

1. **Help the user progress** - Guide users from beginner to advanced workflows
2. **Focus on what's important NOW** - Reduce cognitive load, show content contextually
3. **Make the next action clear** - Prioritize clear over clever

### Stay Consistent

1. **Provide sense of familiarity** - Use established design patterns
2. **Build trust with strong brand** - Maintain consistent visual profile
3. **Cater to diverse needs** - Ensure accessibility for all abilities

### Make it Delightful

1. **Create enjoyable experience** - Leverage the aesthetic-usability effect
2. **Make big impact with small details** - Spacing, icons, animations, hover states
3. **Break complexity with visualization** - Use visuals to reduce cognitive load

### Be Innovative

1. **Think new** - Be curious, test new design ideas
2. **Adapt to change** - Technology supports UX, not the reverse
3. **Enable flexible workflows** - Don't force predefined workflows

---

## Interface Characteristics

- **Minimalistic** - Strip away unnecessary distractions
- **Friendly and human** - Soft, rounded, approachable design
- **Spacious** - Proper spacing communicates hierarchy
- **All-white surface** - Avoid gray backgrounds in panels
- **Thoughtful color use** - Color on canvas, subtle in panels

---

## Source Material

This documentation was extracted from:

- `Forma UI Design Documentation/Design Foundations/` - Colors, Typography, Icons, Layout
- `Forma UI Design Documentation/Extension Guides/` - Components, Placement, Examples
- `Forma UI Design Documentation/Forma UI Design Principles/` - Core design principles
- `Forma UI Design Documentation/Text Guidelines/` - Content and tone guidelines

**Note**: `Extension Guides/Templates.pdf` (19.5MB) requires manual review due to size.
