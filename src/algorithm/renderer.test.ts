/**
 * Renderer Tests
 *
 * Tests for the floorplate rendering functions.
 */

import { renderFloorplate, renderFloorplateLayers, getUnitColor } from './renderer';
import { generateFloorplate } from './generator-core';
import { UnitType, FloorPlanData } from './types';
import { SIMPLE_FOOTPRINT } from '../../test/fixtures/footprints';
import { STANDARD_CONFIG, EGRESS_SPRINKLERED } from '../../test/fixtures/configs';

describe('renderFloorplate', () => {
  let testFloorplan: FloorPlanData;

  beforeAll(() => {
    // Generate a floorplan once for all tests
    testFloorplan = generateFloorplate(
      SIMPLE_FOOTPRINT,
      STANDARD_CONFIG,
      EGRESS_SPRINKLERED
    );
  });

  it('should return Float32Array for positions', () => {
    const meshData = renderFloorplate(testFloorplan);

    expect(meshData.positions).toBeInstanceOf(Float32Array);
  });

  it('should return Uint8Array for colors', () => {
    const meshData = renderFloorplate(testFloorplan);

    expect(meshData.colors).toBeInstanceOf(Uint8Array);
  });

  it('should have matching vertex counts (positions/3 === colors/4)', () => {
    const meshData = renderFloorplate(testFloorplan);

    const vertexCount = meshData.positions.length / 3;
    const colorVertexCount = meshData.colors.length / 4;

    expect(vertexCount).toBe(colorVertexCount);
  });

  it('should generate non-empty mesh data', () => {
    const meshData = renderFloorplate(testFloorplan);

    expect(meshData.positions.length).toBeGreaterThan(0);
    expect(meshData.colors.length).toBeGreaterThan(0);
  });

  it('should have vertex count that is multiple of 3 (triangles)', () => {
    const meshData = renderFloorplate(testFloorplan);

    const vertexCount = meshData.positions.length / 3;
    expect(vertexCount % 3).toBe(0); // Each triangle has 3 vertices
  });

  it('should respect elevation offset parameter', () => {
    const meshData1 = renderFloorplate(testFloorplan, 0.5);
    const meshData2 = renderFloorplate(testFloorplan, 1.5);

    // Z values should differ by approximately 1.0 (the difference in offset)
    // Check the first vertex's z coordinate
    const z1 = meshData1.positions[2];
    const z2 = meshData2.positions[2];

    expect(z2 - z1).toBeCloseTo(1.0, 1);
  });

  it('should produce valid RGBA colors (0-255)', () => {
    const meshData = renderFloorplate(testFloorplan);

    for (let i = 0; i < meshData.colors.length; i++) {
      expect(meshData.colors[i]).toBeGreaterThanOrEqual(0);
      expect(meshData.colors[i]).toBeLessThanOrEqual(255);
    }
  });
});

describe('renderFloorplateLayers', () => {
  let testFloorplan: FloorPlanData;

  beforeAll(() => {
    testFloorplan = generateFloorplate(
      SIMPLE_FOOTPRINT,
      STANDARD_CONFIG,
      EGRESS_SPRINKLERED
    );
  });

  it('should return separate mesh data for each layer', () => {
    const layers = renderFloorplateLayers(testFloorplan);

    expect(layers.corridor).toBeDefined();
    expect(layers.cores).toBeDefined();
    expect(layers.units).toBeDefined();
    expect(layers.borders).toBeDefined();
  });

  it('should have valid mesh data for corridor layer', () => {
    const layers = renderFloorplateLayers(testFloorplan);

    expect(layers.corridor.positions).toBeInstanceOf(Float32Array);
    expect(layers.corridor.colors).toBeInstanceOf(Uint8Array);
    expect(layers.corridor.positions.length).toBeGreaterThan(0);
  });

  it('should have valid mesh data for cores layer', () => {
    const layers = renderFloorplateLayers(testFloorplan);

    expect(layers.cores.positions).toBeInstanceOf(Float32Array);
    expect(layers.cores.colors).toBeInstanceOf(Uint8Array);
    // Cores should exist for any valid building
    expect(layers.cores.positions.length).toBeGreaterThan(0);
  });

  it('should have valid mesh data for units layer', () => {
    const layers = renderFloorplateLayers(testFloorplan);

    expect(layers.units.positions).toBeInstanceOf(Float32Array);
    expect(layers.units.colors).toBeInstanceOf(Uint8Array);
    expect(layers.units.positions.length).toBeGreaterThan(0);
  });

  it('should produce combined mesh equal to sum of layers', () => {
    const combined = renderFloorplate(testFloorplan);
    const layers = renderFloorplateLayers(testFloorplan);

    const layersTotalPositions =
      layers.corridor.positions.length +
      layers.cores.positions.length +
      layers.units.positions.length +
      layers.borders.positions.length;

    expect(combined.positions.length).toBe(layersTotalPositions);
  });
});

describe('getUnitColor', () => {
  it('should return valid RGBA color for Studio', () => {
    const color = getUnitColor(UnitType.Studio);

    expect(color.r).toBeGreaterThanOrEqual(0);
    expect(color.r).toBeLessThanOrEqual(255);
    expect(color.g).toBeGreaterThanOrEqual(0);
    expect(color.g).toBeLessThanOrEqual(255);
    expect(color.b).toBeGreaterThanOrEqual(0);
    expect(color.b).toBeLessThanOrEqual(255);
    expect(color.a).toBeGreaterThanOrEqual(0);
    expect(color.a).toBeLessThanOrEqual(255);
  });

  it('should return different colors for different unit types', () => {
    const studioColor = getUnitColor(UnitType.Studio);
    const oneBedColor = getUnitColor(UnitType.OneBed);
    const twoBedColor = getUnitColor(UnitType.TwoBed);
    const threeBedColor = getUnitColor(UnitType.ThreeBed);

    // At least one RGB component should differ between types
    const colorsMatch = (c1: typeof studioColor, c2: typeof studioColor) =>
      c1.r === c2.r && c1.g === c2.g && c1.b === c2.b;

    expect(colorsMatch(studioColor, oneBedColor)).toBe(false);
    expect(colorsMatch(oneBedColor, twoBedColor)).toBe(false);
    expect(colorsMatch(twoBedColor, threeBedColor)).toBe(false);
  });

  it('should return consistent color for same unit type', () => {
    const color1 = getUnitColor(UnitType.TwoBed);
    const color2 = getUnitColor(UnitType.TwoBed);

    expect(color1.r).toBe(color2.r);
    expect(color1.g).toBe(color2.g);
    expect(color1.b).toBe(color2.b);
    expect(color1.a).toBe(color2.a);
  });
});
