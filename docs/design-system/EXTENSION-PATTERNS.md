# Extension Patterns

This document describes the different types of extensions in Forma and their UI placement patterns.

---

## Extension Types

Forma extensions are divided into three main categories:

### 1. Embedded Views

#### Floating Panels

Embedded views in floating panels are great for extensions with most types of functionality that doesn't fit other categories.

**Use when:**
- General-purpose functionality
- Custom workflows
- Interactive tools
- Data visualization

**Characteristics:**
- Appears over the canvas
- Has subtle drop shadow
- Can be positioned by user
- Contains custom UI content

```
+------------------+------------------+
|                  |                  |
|    Left Panel    |   Right Panel    |
|   (optional)     |   (optional)     |
|                  |                  |
|    +--------+    |                  |
|    |Floating|    |                  |
|    | Panel  |    |                  |
|    +--------+    |                  |
|                  |                  |
+------------------+------------------+
```

#### Analysis Extensions (Right Panel)

For extensions with analysis functionality, activated from the right side analysis area.

**Use when:**
- Performing analyses on the project
- Displaying analysis results
- Environmental studies
- Data calculations

**Characteristics:**
- UI stays inside right panel
- Integrated with analysis workflow
- Consistent placement

```
+----------------------------------+------+
|                                  |      |
|           Canvas                 | Anal |
|                                  | ysis |
|                                  | Panel|
|                                  |      |
+----------------------------------+------+
```

---

### 2. Generators

#### Tools (Right Panel)

Generators as tools are extensions activated from the toolbar, keeping the UI close to the right panel.

**Use when:**
- Creating or generating geometry
- Design tools
- Parametric generators
- Placement tools

**Characteristics:**
- Activated from toolbar
- UI in right panel area
- Close to generation actions

---

### 3. Data Providers

#### Floating Panel

Data providers in floating panels work best when:
- Extension handles large amounts of data
- Doesn't fit clearly into marketplace categories
- Needs more freedom for the UI

#### Data Marketplace (Library)

Most data providers are found in the Library tab where users can order data through the marketplace.

**Note:** These differ from typical extensions - contact Autodesk if you want to publish here.

---

## Panel Specifications

### Dimensions

| Element | Value |
|---------|-------|
| Side panel width | 260px |
| Panel gap from edge | 16px |
| Internal padding | 16px |
| Button height | 36px |
| Header height | 40px |

### Grid Layout

```
+--16--+--260--+---canvas---+--260--+--16--+
|      |       |            |       |      |
| gap  | left  |            | right | gap  |
|      | panel |            | panel |      |
|      |       |            |       |      |
|      |  12   |            |  12   |      |
|      |spacing|            |spacing|      |
+------+-------+------------+-------+------+
```

### Visual Hierarchy

- Panels have **subtle drop shadow** to reinforce floating effect
- **White background** for panel content
- **16px padding** on all sides
- **16px spacing** between major sections
- **12px spacing** between related elements

---

## This Extension's Pattern

The Floorplate Generator uses:

1. **Main Panel** (Embedded View - Floating Panel)
   - Contains configuration controls
   - Tab-based navigation (MIX, DIM, EGRESS, INSPECT)
   - Generate button at bottom

2. **Preview Panel** (Floating Panel)
   - Shows generated layouts
   - Option tabs for different strategies
   - Save/Bake actions

### Communication Pattern

```
Main Panel  <-- MessagePort -->  Preview Panel
    |                                 |
    |   1. Generate floorplate        |
    |   2. Send options to preview    |
    |   3. Display 3 layout options   |
    |   4. User selects option        |
    |   5. Render mesh on canvas      |
    |                                 |
```

---

## Best Practices

### Panel Design

1. **Keep panels narrow** - 260px is the standard width
2. **Use vertical scrolling** - Don't expand horizontally
3. **Group related controls** - Use sections with headers
4. **Show feedback** - Loading states, success messages

### Floating Panels

1. **Allow repositioning** - Users should be able to move panels
2. **Provide close button** - Standard X button in header
3. **Remember position** - Optional: persist user preferences
4. **Minimize when possible** - Collapse to reduce visual noise

### Integration

1. **Match Forma styling** - Use design system components
2. **Consistent interaction** - Follow Forma patterns
3. **Non-blocking** - Don't prevent canvas interaction when possible
4. **Contextual** - Show relevant UI based on user selection

---

## Source

Extracted from:
- `Extension Guides/Placement.pdf`
- `Extension Guides/Examples.pdf`
- `Extension Guides/Examples-1.pdf`
