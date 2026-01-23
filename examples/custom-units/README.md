# Custom Unit Types Example

This example demonstrates how to configure custom unit types for the Floorplate Generator.

## What You'll Learn

- Defining unit types with custom dimensions (area in sq ft)
- Setting percentage targets for unit mix
- Configuring visualization colors
- Understanding advanced options like L-shape eligibility

## How to Use

1. Open `index.html` in a browser
2. Modify the default unit types or add new ones
3. Click "Preview Configuration" to see the generator-ready format
4. Copy the JSON config for use in the main extension

## Configuration Options

### Basic Options

| Option | Description | Example |
|--------|-------------|---------|
| Name | Display name for the unit type | "1BR", "Studio" |
| Area | Target area in square feet | 750 |
| Target % | Percentage of this type in the mix | 30 |
| Color | Hex color for visualization | #98FB98 |

### Advanced Options (Automatic Defaults)

| Option | Description | Default |
|--------|-------------|---------|
| `canBeLShaped` | Can this unit wrap around corners? | `true` if area >= 700 sq ft |
| `isCornerEligible` | Can this unit be placed at corners? | `true` |
| `minDepth` | Minimum unit depth | 6 ft (1.83m) |
| `maxDepth` | Maximum unit depth | 12 ft (3.66m) |

## Unit Type Guidelines

### US Multifamily Standards

| Type | Typical Area | Notes |
|------|--------------|-------|
| Studio | 400-550 sq ft | Single room + bath |
| 1BR | 650-850 sq ft | Separate bedroom |
| 2BR | 900-1200 sq ft | Two bedrooms |
| 3BR | 1100-1500 sq ft | Three bedrooms |

### Mix Recommendations

- **Urban high-rise**: More studios and 1BR (60-70%)
- **Suburban mid-rise**: More 2BR and 3BR (50-60%)
- **Mixed-income**: Balanced mix across all types

## Integration

To use this configuration in the main Floorplate Generator:

1. Generate the JSON configuration
2. Copy the config array
3. Pass it to `generateFloorplate()` as the `unitTypes` option

```javascript
import { generateFloorplate } from 'floorplate-generator';

const config = [/* your custom unit types */];

const floorplan = generateFloorplate(footprint, {
  unitTypes: config,
  corridorWidth: 1.83, // 6 ft
  egressConfig: { /* ... */ }
});
```

## SDK Version

Requires `forma-embedded-view-sdk` >= 0.90.0 for full functionality.
