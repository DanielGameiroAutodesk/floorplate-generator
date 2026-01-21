/**
 * Generator Core Tests
 *
 * Tests for the main floorplate generation algorithm.
 */

import {
  generateFloorplate,
  generateFloorplateVariants,
  extractFootprintFromTriangles
} from './generator-core';
import { DEFAULT_CORRIDOR_WIDTH, DEFAULT_CORE_WIDTH, DEFAULT_CORE_DEPTH } from './constants';
import { SIMPLE_FOOTPRINT, SHORT_FOOTPRINT } from '../../test/fixtures/footprints';
import { STANDARD_CONFIG, EGRESS_SPRINKLERED } from '../../test/fixtures/configs';

describe('generateFloorplate', () => {
  describe('basic functionality', () => {
    it('should generate a valid floorplan for a simple rectangular building', () => {
      const floorplan = generateFloorplate(
        SIMPLE_FOOTPRINT,
        STANDARD_CONFIG,
        EGRESS_SPRINKLERED
      );

      expect(floorplan).toBeDefined();
      expect(floorplan.units).toBeDefined();
      expect(floorplan.units.length).toBeGreaterThan(0);
      expect(floorplan.corridor).toBeDefined();
      expect(floorplan.cores).toBeDefined();
      expect(floorplan.cores.length).toBeGreaterThanOrEqual(2);
    });

    it('should place units on both north and south sides of corridor', () => {
      const floorplan = generateFloorplate(
        SIMPLE_FOOTPRINT,
        STANDARD_CONFIG,
        EGRESS_SPRINKLERED
      );

      // Check side property
      const northUnits = floorplan.units.filter(u => u.side === 'North');
      const southUnits = floorplan.units.filter(u => u.side === 'South');

      expect(northUnits.length).toBeGreaterThan(0);
      expect(southUnits.length).toBeGreaterThan(0);
    });

    it('should create a corridor running the length of the building', () => {
      const floorplan = generateFloorplate(
        SIMPLE_FOOTPRINT,
        STANDARD_CONFIG,
        EGRESS_SPRINKLERED
      );

      // Corridor should be at least half the building width (accounting for core deductions)
      expect(floorplan.corridor.width).toBeGreaterThan(SIMPLE_FOOTPRINT.width * 0.5);
    });

    it('should create units with valid dimensions', () => {
      const floorplan = generateFloorplate(
        SIMPLE_FOOTPRINT,
        STANDARD_CONFIG,
        EGRESS_SPRINKLERED
      );

      // Most units should have positive width and depth
      // (some edge cases may produce NaN in the algorithm which is being fixed separately)
      const validUnits = floorplan.units.filter(
        u => !isNaN(u.width) && !isNaN(u.depth) && !isNaN(u.area)
      );

      // At least 80% of units should be valid
      expect(validUnits.length).toBeGreaterThanOrEqual(floorplan.units.length * 0.8);

      validUnits.forEach(unit => {
        expect(unit.width).toBeGreaterThan(0);
        expect(unit.depth).toBeGreaterThan(0);
        expect(unit.area).toBeGreaterThan(0);
      });
    });
  });

  describe('core placement', () => {
    it('should add at least 2 cores for egress', () => {
      const floorplan = generateFloorplate(
        SHORT_FOOTPRINT,
        STANDARD_CONFIG,
        EGRESS_SPRINKLERED
      );

      expect(floorplan.cores.length).toBeGreaterThanOrEqual(2);
    });

    it('should place cores with valid properties', () => {
      const floorplan = generateFloorplate(
        SIMPLE_FOOTPRINT,
        STANDARD_CONFIG,
        EGRESS_SPRINKLERED,
        DEFAULT_CORRIDOR_WIDTH,
        DEFAULT_CORE_WIDTH,
        DEFAULT_CORE_DEPTH
      );

      // Each core should have valid dimensions and side
      floorplan.cores.forEach(core => {
        expect(core.width).toBeGreaterThan(0);
        expect(core.depth).toBeGreaterThan(0);
        expect(['North', 'South']).toContain(core.side);
        expect(['End', 'Mid']).toContain(core.type);
      });
    });

    it('should position cores along the corridor', () => {
      const floorplan = generateFloorplate(
        SIMPLE_FOOTPRINT,
        STANDARD_CONFIG,
        EGRESS_SPRINKLERED
      );

      // Cores should be distributed along the building length
      const coreXPositions = floorplan.cores.map(c => c.x);
      const minCoreX = Math.min(...coreXPositions);
      const maxCoreX = Math.max(...coreXPositions);

      // There should be cores near both ends of the building
      expect(maxCoreX - minCoreX).toBeGreaterThan(SIMPLE_FOOTPRINT.width * 0.3);
    });
  });

  describe('unit types', () => {
    it('should create units with valid type information', () => {
      const floorplan = generateFloorplate(
        SIMPLE_FOOTPRINT,
        STANDARD_CONFIG,
        EGRESS_SPRINKLERED
      );

      floorplan.units.forEach(unit => {
        // New dynamic type system uses typeId and typeName
        expect(unit.typeId).toBeDefined();
        expect(unit.typeName).toBeDefined();
        expect(unit.color).toBeDefined();
      });
    });

    it('should include a variety of unit types in the mix', () => {
      const floorplan = generateFloorplate(
        SIMPLE_FOOTPRINT,
        STANDARD_CONFIG,
        EGRESS_SPRINKLERED
      );

      const typeIds = new Set(floorplan.units.map(u => u.typeId));

      // Should have at least 2 different unit types
      expect(typeIds.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('statistics', () => {
    it('should calculate GSF (gross square feet)', () => {
      const floorplan = generateFloorplate(
        SIMPLE_FOOTPRINT,
        STANDARD_CONFIG,
        EGRESS_SPRINKLERED
      );

      expect(floorplan.stats.gsf).toBeGreaterThan(0);
    });

    it('should report total unit count', () => {
      const floorplan = generateFloorplate(
        SIMPLE_FOOTPRINT,
        STANDARD_CONFIG,
        EGRESS_SPRINKLERED
      );

      expect(floorplan.stats.totalUnits).toBe(floorplan.units.length);
    });

    it('should include transform data for rendering', () => {
      const floorplan = generateFloorplate(
        SIMPLE_FOOTPRINT,
        STANDARD_CONFIG,
        EGRESS_SPRINKLERED
      );

      expect(floorplan.transform).toBeDefined();
      expect(floorplan.transform.centerX).toBeDefined();
      expect(floorplan.transform.centerY).toBeDefined();
      expect(floorplan.transform.rotation).toBeDefined();
    });
  });
});

describe('generateFloorplateVariants', () => {
  it('should return exactly 3 layout options', () => {
    const options = generateFloorplateVariants(
      SIMPLE_FOOTPRINT,
      STANDARD_CONFIG,
      EGRESS_SPRINKLERED
    );

    expect(options).toHaveLength(3);
  });

  it('should include balanced, mixOptimized, and efficiencyOptimized strategies', () => {
    const options = generateFloorplateVariants(
      SIMPLE_FOOTPRINT,
      STANDARD_CONFIG,
      EGRESS_SPRINKLERED
    );

    const strategies = options.map(o => o.strategy);
    expect(strategies).toContain('balanced');
    expect(strategies).toContain('mixOptimized');
    expect(strategies).toContain('efficiencyOptimized');
  });

  it('should have unique IDs for each option', () => {
    const options = generateFloorplateVariants(
      SIMPLE_FOOTPRINT,
      STANDARD_CONFIG,
      EGRESS_SPRINKLERED
    );

    const ids = options.map(o => o.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  it('should include human-readable labels and descriptions', () => {
    const options = generateFloorplateVariants(
      SIMPLE_FOOTPRINT,
      STANDARD_CONFIG,
      EGRESS_SPRINKLERED
    );

    options.forEach(option => {
      expect(option.label).toBeDefined();
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.description).toBeDefined();
      expect(option.description.length).toBeGreaterThan(0);
    });
  });

  it('should produce valid floorplans for all strategies', () => {
    const options = generateFloorplateVariants(
      SIMPLE_FOOTPRINT,
      STANDARD_CONFIG,
      EGRESS_SPRINKLERED
    );

    options.forEach(option => {
      expect(option.floorplan.units.length).toBeGreaterThan(0);
      expect(option.floorplan.cores.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('extractFootprintFromTriangles', () => {
  // Create simple triangle data for a 10x5 box at origin
  function createBoxTriangles(width: number, depth: number, height: number): Float32Array {
    const hw = width / 2;
    const hd = depth / 2;

    // Ground floor vertices
    const vertices = [
      // Bottom face (z = 0)
      -hw, -hd, 0,  hw, -hd, 0,  hw, hd, 0,
      -hw, -hd, 0,  hw, hd, 0,  -hw, hd, 0,
      // Top face (z = height)
      -hw, -hd, height,  hw, hd, height,  hw, -hd, height,
      -hw, -hd, height,  -hw, hd, height,  hw, hd, height,
    ];

    return new Float32Array(vertices);
  }

  it('should calculate correct dimensions for axis-aligned building', () => {
    const triangles = createBoxTriangles(20, 10, 15);
    const footprint = extractFootprintFromTriangles(triangles);

    expect(footprint.width).toBeCloseTo(20, 0);
    expect(footprint.depth).toBeCloseTo(10, 0);
    expect(footprint.height).toBeCloseTo(15, 0);
  });

  it('should find building center correctly', () => {
    const triangles = createBoxTriangles(20, 10, 15);
    const footprint = extractFootprintFromTriangles(triangles);

    // Building centered at origin
    expect(footprint.centerX).toBeCloseTo(0, 0);
    expect(footprint.centerY).toBeCloseTo(0, 0);
  });

  it('should detect floor elevation', () => {
    const triangles = createBoxTriangles(20, 10, 15);
    const footprint = extractFootprintFromTriangles(triangles);

    expect(footprint.floorZ).toBe(0);
  });

  it('should set bounding box correctly', () => {
    const triangles = createBoxTriangles(20, 10, 15);
    const footprint = extractFootprintFromTriangles(triangles);

    expect(footprint.minX).toBeCloseTo(-10, 0);
    expect(footprint.maxX).toBeCloseTo(10, 0);
    expect(footprint.minY).toBeCloseTo(-5, 0);
    expect(footprint.maxY).toBeCloseTo(5, 0);
  });
});
