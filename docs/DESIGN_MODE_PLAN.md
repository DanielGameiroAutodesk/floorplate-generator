# Design Mode — Draw Line Building & Auto-Bake Apartments

## Context

Currently the extension requires users to first create a building in Forma (via site design), then select it, generate apartments, and bake. The new "Design" mode lets users draw a line building directly from the extension, skipping the manual building creation step. When the line is finished, the extension converts it to a footprint, generates apartments (Balanced strategy), and auto-bakes — producing a native Forma building in one action.

## UI Changes

### Button Layout (`index.html` generate-section, lines 1223-1231)

Replace the single `generate-btn` with two side-by-side buttons + a conditional width input:

```
┌─────────────────────────────────┐
│  [  Select  ]  [  Design  ]    │  ← two equal-width buttons
│                                 │
│  Building Width  [  40  ] ft   │  ← shown only when Design active
└─────────────────────────────────┘
```

- **Select** button: replaces old "Select Building" — identical behavior to current flow
- **Design** button: new mode — activates `Forma.designTool.getLine()`
- **Width input**: appears below buttons when Design is clicked; default 40 ft (≈12m)
- The Select button keeps the existing state machine: Select → Generate → Stop
- The Design button has its own states: Design → Drawing... → Generating... → Design

### CSS

- `.mode-buttons` — flex row with gap for the two buttons
- `.mode-btn` — flex:1 so both are equal width
- `.mode-btn-secondary` — outline/subdued style for the inactive mode button
- `.design-width-section` — margin-top spacing, hidden by default

## New Files

### `src/extension/utils/line-to-polygon.ts` (~50 lines)

Port of `designmode-master/packages/line-buildings-shared/src/.../bufferLine.ts` (102 lines). Only need:
- `getUnitVectorXY`, `getUnitNormalVectorXY`, `getUnitNormalVectors` (helpers)
- `getCornerShiftsOpen` (miter join computation for open polylines)
- `bufferOpenLine` (offset a polyline by a distance)
- `lineToFootprintPolygon(coordinates: Vec3[], width: number): {x,y}[]` — public function that buffers left side by +width/2 and right side by -width/2, returns closed polygon (left forward + right reversed)

Reference: `designmode-master/packages/line-buildings-shared/src/lineBuildingGenerator/lib/lineBuilding9000/bufferLine.ts`

### `src/extension/managers/design-manager.ts` (~120 lines)

Design mode lifecycle manager:

```
startDesignMode()
  → set state 'drawing', update button text
  → call Forma.designTool.getLine()
  → if cancelled (undefined): reset to idle
  → if line returned: set state 'generating'
  → call handleDesignGenerate(line)

handleDesignGenerate(line)
  → convert line + width to polygon via lineToFootprintPolygon()
  → determine if simple bar (2-pt line) or multi-wing (3+ pts)
  → build footprint / run appropriate generator variant
  → take first option (Balanced, index 0)
  → set state 'baking'
  → call bakeWithFloorStack(floorplan, { numFloors: state.stories, name: 'Design Building' })
  → reset state to idle
```

Reuses from generation-manager: `getUnitConfiguration`, `getEgressConfig`, `getUnitColors` (from `state/unit-config.ts`), and the algorithm entry points from `../../algorithm`.

Reuses from bake-building: `bakeWithFloorStack` — `originalBuildingPath` is already optional.

## Modified Files

### `src/extension/index.html`
- Replace `<button class="generate-btn" id="generate-btn">` with two-button layout + width input (lines 1224-1231)
- Add CSS for `.mode-buttons`, `.mode-btn`, `.mode-btn-secondary`, `.design-width-section`

### `src/extension/utils/dom-refs.ts`
- Rename `generateBtn` → `selectBtn` (id changes from `generate-btn` to `select-btn`)
- Add: `designBtn`, `designWidthSection`, `designWidthInput`

### `src/extension/state/ui-state.ts`
- Add `designWidth: number` to `UIState` (default: 40, in feet)

### `src/extension/main.ts`
- Update all `dom.generateBtn` references → `dom.selectBtn`
- Wire `dom.selectBtn.addEventListener('click', handleButtonClick)` (same logic as before)
- Wire `dom.designBtn.addEventListener('click', handleDesignClick)`
- Wire `dom.designWidthInput.addEventListener('input', ...)` to update `state.designWidth`
- Import and call `startDesignMode()` from design-manager in `handleDesignClick`
- Disable Select button during design drawing, re-enable after

### `src/extension/managers/index.ts`
- Re-export `startDesignMode` from design-manager

### `src/extension/managers/generation-manager.ts`
- No structural changes needed. Design manager calls algorithm functions directly (same imports).
- The generation-manager's `handleGenerate()` stays untouched — it's only used by the Select flow.

## Line → Footprint Geometry

For a 2-point straight line with width W:
```
Line: A ──────── B       Width: W

Result (rectangle):
  A+n*W/2 ─── B+n*W/2
  |                   |
  A-n*W/2 ─── B-n*W/2

  where n = unit normal to AB
```

For a 3+ point polyline (L-shape, etc.), miter joins at corners produce the correct polygon shape. The `getCornerShiftsOpen` function computes the bisector-based offset at each vertex.

## Generation Pipeline for Design Mode

Uses the **same floorplate algorithm** as the current Select flow:

- **2-point line → rectangle**: Build a `BuildingFootprint` object with width/depth from rectangle bounds, rotation from line angle. Call `generateFloorplateVariants()`.
- **3+ point line → complex polygon**: Pass polygon directly to `analyzeFootprint()` to detect wings, then `generateMultiWingFloorplateVariants()`.

The z-coordinate from `getLine()` gives terrain height → use as `floorZ`. Building height = `state.stories * 3.2m`.

## Auto-Bake

After generation, immediately call:
```typescript
bakeWithFloorStack(floorplan, {
  numFloors: state.stories,
  name: 'Design Building'
  // no originalBuildingPath — we're creating, not replacing
});
```

No floating panel, no option selection. The user sees the baked building appear in Forma.

## Implementation Order

1. **line-to-polygon.ts** — Port buffer geometry utility
2. **UI changes** — HTML buttons + width input + CSS + dom-refs + ui-state
3. **main.ts** — Rewire select button, add design button handler
4. **design-manager.ts** — Full lifecycle: getLine → polygon → generate → bake
5. **Clean up** — Remove debug logging from generation-manager.ts (separate concern, optional)

## Verification

1. **Select flow still works**: Click Select → pick building → Generate → verify apartments appear → Bake works
2. **Design straight line**: Click Design → draw 2-point line → verify rectangle footprint → apartments generated & baked
3. **Design L-shape**: Click Design → draw 3-point L-shaped line → verify L-shaped footprint → multi-wing apartments generated & baked
4. **Cancel**: Click Design → press Escape → verify returns to idle state
5. **Width input**: Change width → draw line → verify building uses updated width
