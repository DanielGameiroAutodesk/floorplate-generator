# Troubleshooting Guide

This guide covers common issues encountered when using the Floorplate Generator extension and their solutions.

## Baking Issues

### Building appears in wrong position

**Symptom**: After baking, the building is offset from where the original footprint was.

**Possible Causes & Solutions**:

1. **Coordinates not centered**: The FloorStack API expects coordinates centered at origin.
   - Check that vertex coordinates range from `-halfWidth` to `+halfWidth` in X
   - Check that vertex coordinates range from `-halfDepth` to `+halfDepth` in Y
   - The `convertFloorPlanToFloorStackPlan()` function should apply centering automatically

2. **Missing position compensation**: Even with centered coordinates, the API places a corner at the transform origin.
   ```typescript
   // Apply position compensation
   const offsetX = (-halfWidth) * cos - (-halfDepth) * sin;
   const offsetY = (-halfWidth) * sin + (-halfDepth) * cos;
   const adjustedCenterX = centerX - offsetX;
   const adjustedCenterY = centerY - offsetY;
   ```

3. **Wrong building selected**: Ensure you're selecting the correct building footprint before generating.

### Building appears one dimension offset

**Symptom**: Building is offset by exactly its width or depth.

**Cause**: Wrong corner used in offset compensation formula.

**Solution**: The formula should use the southwest corner `(-halfWidth, -halfDepth)`:
```typescript
// CORRECT: Southwest corner
const offsetX = (-halfWidth) * cos - (-halfDepth) * sin;
const offsetY = (-halfWidth) * sin + (-halfDepth) * cos;

// WRONG: Northwest corner (causes full-depth offset)
// const offsetX = (-halfWidth) * cos - halfDepth * sin;
// const offsetY = (-halfWidth) * sin + halfDepth * cos;
```

### Building appears rotated incorrectly

**Symptom**: Building is rotated but not aligned with the original footprint.

**Possible Causes**:
1. **Transform matrix format**: Forma uses column-major 4x4 matrices
2. **Rotation direction**: Counter-clockwise rotation in the XY plane

**Solution**: Use this transform format:
```typescript
const transform = [
  cos, sin, 0, 0,     // Column 0: X basis
  -sin, cos, 0, 0,    // Column 1: Y basis
  0, 0, 1, 0,         // Column 2: Z basis (up)
  x, y, z, 1          // Column 3: Translation
];
```

### Authentication dialog appears when baking

**Symptom**: Forma prompts for OAuth login when clicking "Bake".

**Cause**: Using SDK version < 0.90.0 or falling back to BasicBuilding API.

**Solution**:
1. Update to SDK v0.90.0 or later: `npm install forma-embedded-view-sdk@^0.90.0`
2. Check if plan-based FloorStack is being used (console logs should show "Building created with X units")
3. If falling back to polygon mode, check for errors in the plan creation

---

## FloorStack API Issues

### Plan-based creation fails (falls back to polygon mode)

**Symptom**: Console shows "Plan-based FloorStack failed" and building has no unit subdivisions.

**Possible Causes**:

1. **Invalid vertex IDs**: Vertex IDs must match pattern `[a-zA-Z0-9-]{2,20}`
   - Check that IDs like `v0`, `v1`, `v2` are being generated correctly

2. **Polygon winding order**: Polygons must be counterclockwise
   - Use `ensureCounterClockwise()` helper function

3. **Vertex references**: All vertex IDs in polygons must exist in the vertices array
   - Check that deduplication isn't removing needed vertices

4. **SDK version**: Ensure using v0.90.0+ which supports the `plans` parameter

**Debugging**:
```typescript
// Enable debug logging in bake-building.ts
console.log('Plan:', JSON.stringify(plan, null, 2));
```

### Units not showing subdivisions

**Symptom**: Building is created but appears as solid mass without unit colors.

**Cause**: May be using polygon-based FloorStack instead of plan-based.

**Solution**: Check console for:
- "Building created with X units (URN: ...)" = plan-based (correct)
- "Building created without unit subdivisions (URN: ...)" = polygon fallback

### Holes not rendering

**Symptom**: Units with holes appear solid.

**Cause**: Wrong holes format.

**Solution**: Holes must be `string[][]` (array of arrays):
```typescript
// CORRECT
holes: [['h1', 'h2', 'h3', 'h4']]  // One hole with 4 vertices

// WRONG
holes: ['h1', 'h2', 'h3', 'h4']    // Flat array
```

---

## Extension Development Issues

### Extension not loading

**Symptom**: Extension panel doesn't appear in Forma.

**Possible Causes**:

1. **manifest.json errors**: Check JSON syntax is valid
2. **Wrong port**: Localhost extension must match the configured port
3. **HTTPS required**: Some Forma features require HTTPS even for localhost

**Solution**: Check browser console for specific errors.

### API calls failing with 401

**Symptom**: Forma API calls return 401 Unauthorized.

**Cause**: Session not authenticated or using wrong endpoint.

**Solutions**:
1. **Production**: Use `credentials: 'include'` with Forma proxy URL
2. **Localhost**: Use Bearer token with direct API endpoint
3. Check if `Forma.getProjectId()` returns a valid ID

### Transform not applying

**Symptom**: Building appears at origin (0, 0, 0) regardless of transform.

**Possible Causes**:
1. Transform array has wrong length (must be exactly 16 elements)
2. Transform is identity matrix
3. Translation values in wrong positions

**Solution**: Verify transform format:
```typescript
// Column-major 4x4 matrix - translation in positions [12], [13], [14]
const transform: [number, ...] = [
  m00, m10, m20, m30,  // Column 0
  m01, m11, m21, m31,  // Column 1
  m02, m12, m22, m32,  // Column 2
  tx,  ty,  tz,  1     // Column 3 (translation)
];
```

---

## Common Error Messages

### "Failed during request action elements/floor-stack-v2/create-from-floors"

**Cause**: FloorStack API rejected the request.

**Debugging Steps**:
1. Check that `floors` array is not empty
2. If using `plans`, verify all `planId` references match plan IDs
3. Check that polygon vertices form valid closed shapes
4. Verify floor heights are positive numbers

### "Cannot read property 'urn' of undefined"

**Cause**: API call succeeded but returned unexpected format.

**Solution**: Add error handling:
```typescript
const result = await Forma.elements.floorStack.createFromFloors({ floors, plans });
if (!result || !result.urn) {
  throw new Error('FloorStack API returned invalid response');
}
```

### "units intersects" or overlapping polygon error

**Cause**: Unit polygons share interior space.

**Solutions**:
1. Check vertex deduplication is working correctly
2. Verify units don't overlap in the source FloorPlanData
3. Use `coordKey()` to ensure vertices are properly shared at boundaries

---

## Performance Issues

### Generation takes too long

**Symptom**: Clicking "Generate" hangs for more than 5 seconds.

**Possible Causes**:
1. Very large building footprint
2. Many unit types configured
3. Strict egress constraints that are hard to satisfy

**Solutions**:
1. Reduce building complexity
2. Simplify unit mix
3. Relax egress constraints temporarily

### Memory issues

**Symptom**: Browser becomes unresponsive or crashes.

**Solutions**:
1. Reduce number of generated variants
2. Clear saved layouts occasionally
3. Refresh the extension tab

---

## Getting Help

If your issue isn't covered here:

1. **Check console logs**: Most errors include descriptive messages
2. **Review BAKING_WORKFLOW.md**: Detailed technical documentation
3. **Enable debug logging**: Uncomment debug console.log statements in bake-building.ts
4. **File an issue**: https://github.com/DanielGameiroAutodesk/floorplate-generator/issues
