/**
 * Bake Building Tests
 *
 * Tests for utility functions used in building baking operations.
 */

import { _testUtils } from './bake-building';
import { FloorPlanData } from '../algorithm/types';

const { coordKey, roundCoord, ensureCounterClockwise, convertFloorPlanToFloorStackPlan } = _testUtils;

describe('Bake Building Utilities', () => {
  describe('roundCoord', () => {
    it('should round to 4 decimal places (0.1mm precision)', () => {
      expect(roundCoord(1.23456789)).toBe(1.2346);
      expect(roundCoord(0.00001)).toBe(0);
      expect(roundCoord(10.55555)).toBe(10.5556);
    });

    it('should handle negative numbers', () => {
      expect(roundCoord(-1.23456789)).toBe(-1.2346);
      expect(roundCoord(-0.00001)).toBe(-0);
    });

    it('should handle whole numbers', () => {
      expect(roundCoord(5)).toBe(5);
      expect(roundCoord(100)).toBe(100);
    });
  });

  describe('coordKey', () => {
    it('should create unique key from coordinates', () => {
      const key1 = coordKey(10, 20);
      const key2 = coordKey(10, 20);
      const key3 = coordKey(10, 21);

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it('should round coordinates before creating key', () => {
      const key1 = coordKey(10.00001, 20.00001);
      const key2 = coordKey(10, 20);

      expect(key1).toBe(key2);
    });

    it('should handle negative coordinates', () => {
      const key = coordKey(-5, -10);
      expect(key).toContain('-5');
      expect(key).toContain('-10');
    });
  });

  describe('ensureCounterClockwise', () => {
    it('should keep counterclockwise polygon unchanged', () => {
      // Counterclockwise square (positive area)
      const ccw = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ];

      const result = ensureCounterClockwise(ccw);

      // Should maintain the same winding
      expect(result[0]).toEqual({ x: 0, y: 0 });
      expect(result[1]).toEqual({ x: 10, y: 0 });
    });

    it('should reverse clockwise polygon', () => {
      // Clockwise square (negative area)
      const cw = [
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 10, y: 10 },
        { x: 10, y: 0 }
      ];

      const result = ensureCounterClockwise(cw);

      // Should be reversed
      expect(result[0]).toEqual({ x: 10, y: 0 });
      expect(result[result.length - 1]).toEqual({ x: 0, y: 0 });
    });

    it('should handle triangle', () => {
      // Counterclockwise triangle
      const ccwTriangle = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 }
      ];

      const result = ensureCounterClockwise(ccwTriangle);
      expect(result).toHaveLength(3);
    });
  });

  describe('convertFloorPlanToFloorStackPlan', () => {
    // Create a minimal mock FloorPlanData
    const createMockFloorplan = (): FloorPlanData => ({
      buildingLength: 30,
      buildingDepth: 20,
      floorElevation: 0,
      units: [
        {
          id: 'unit-1',
          typeId: 'studio',
          typeName: 'Studio',
          x: 0,
          y: 0,
          width: 10,
          depth: 8,
          area: 80,
          color: '#FF0000',
          side: 'North' as const,
          isLShaped: false
        },
        {
          id: 'unit-2',
          typeId: '1br',
          typeName: '1BR',
          x: 10,
          y: 0,
          width: 10,
          depth: 8,
          area: 80,
          color: '#00FF00',
          side: 'North' as const,
          isLShaped: false
        }
      ],
      cores: [
        {
          id: 'core-1',
          x: 12,
          y: 8,
          width: 6,
          depth: 4,
          type: 'Mid' as const,
          side: 'North' as const
        }
      ],
      corridor: {
        x: 0,
        y: 8,
        width: 30,
        depth: 4
      },
      stats: {
        gsf: 600,
        nrsf: 160,
        efficiency: 0.27,
        unitCounts: { 'studio': 1, '1br': 1 },
        totalUnits: 2
      },
      egress: {
        maxDeadEnd: 0,
        maxTravelDistance: 100,
        deadEndStatus: 'Pass' as const,
        travelDistanceStatus: 'Pass' as const
      },
      transform: {
        centerX: 100,
        centerY: 200,
        rotation: 0
      }
    });

    it('should create plan with correct ID', () => {
      const floorplan = createMockFloorplan();
      const plan = convertFloorPlanToFloorStackPlan(floorplan);

      expect(plan.id).toBe('plan1');
    });

    it('should center coordinates at origin', () => {
      const floorplan = createMockFloorplan();
      const plan = convertFloorPlanToFloorStackPlan(floorplan);

      // With 30x20 building, half dimensions are 15x10
      // Coordinates are centered by subtracting (halfWidth, halfDepth) = (15, 10)
      // The mock has:
      // - Units at x=0-20, y=0-8 → centered: x=-15 to 5, y=-10 to -2
      // - Corridor at x=0-30, y=8-12 → centered: x=-15 to 15, y=-2 to 2
      // - Core at x=12-18, y=8-12 → centered: x=-3 to 3, y=-2 to 2
      const xCoords = plan.vertices.map(v => v.x);
      const yCoords = plan.vertices.map(v => v.y);

      // X should span corridor width: -15 to 15
      expect(Math.min(...xCoords)).toBe(-15);
      expect(Math.max(...xCoords)).toBe(15);
      // Y should span from unit bottom to corridor top: -10 to 2
      expect(Math.min(...yCoords)).toBe(-10);
      expect(Math.max(...yCoords)).toBe(2);
    });

    it('should map units to LIVING_UNIT program', () => {
      const floorplan = createMockFloorplan();
      const plan = convertFloorPlanToFloorStackPlan(floorplan);

      const livingUnits = plan.units.filter(u => u.program === 'LIVING_UNIT');
      expect(livingUnits.length).toBe(2); // 2 units in mock
    });

    it('should map cores to CORE program', () => {
      const floorplan = createMockFloorplan();
      const plan = convertFloorPlanToFloorStackPlan(floorplan);

      const coreUnits = plan.units.filter(u => u.program === 'CORE');
      expect(coreUnits.length).toBe(1);
    });

    it('should map corridor to CORRIDOR program', () => {
      const floorplan = createMockFloorplan();
      const plan = convertFloorPlanToFloorStackPlan(floorplan);

      const corridorUnits = plan.units.filter(u => u.program === 'CORRIDOR');
      expect(corridorUnits.length).toBe(1);
    });

    it('should deduplicate vertices', () => {
      const floorplan = createMockFloorplan();
      const plan = convertFloorPlanToFloorStackPlan(floorplan);

      // Check for unique vertex IDs
      const vertexIds = plan.vertices.map(v => v.id);
      const uniqueIds = new Set(vertexIds);
      expect(uniqueIds.size).toBe(vertexIds.length);

      // Adjacent units should share vertices
      // Total unique vertices should be less than 4 * numPolygons
      const totalPolygonVertices = plan.units.reduce((sum, u) => sum + u.polygon.length, 0);
      expect(plan.vertices.length).toBeLessThan(totalPolygonVertices);
    });

    it('should create valid polygon references', () => {
      const floorplan = createMockFloorplan();
      const plan = convertFloorPlanToFloorStackPlan(floorplan);

      const vertexIds = new Set(plan.vertices.map(v => v.id));

      for (const unit of plan.units) {
        for (const vertexId of unit.polygon) {
          expect(vertexIds.has(vertexId)).toBe(true);
        }
      }
    });

    it('should handle L-shaped units', () => {
      const floorplan = createMockFloorplan();
      floorplan.units[0].isLShaped = true;
      floorplan.units[0].polyPoints = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
        { x: 5, y: 5 },
        { x: 5, y: 8 },
        { x: 0, y: 8 }
      ];

      const plan = convertFloorPlanToFloorStackPlan(floorplan);

      // Find the L-shaped unit (should have 6 vertices in polygon)
      const lShapedUnit = plan.units.find(u => u.polygon.length === 6);
      expect(lShapedUnit).toBeDefined();
      expect(lShapedUnit?.program).toBe('LIVING_UNIT');
    });

    it('should set empty holes array', () => {
      const floorplan = createMockFloorplan();
      const plan = convertFloorPlanToFloorStackPlan(floorplan);

      for (const unit of plan.units) {
        expect(Array.isArray(unit.holes)).toBe(true);
        expect(unit.holes).toHaveLength(0);
      }
    });
  });

  describe('Position Compensation', () => {
    it('should calculate correct offset for 0 degree rotation', () => {
      const halfWidth = 15;
      const halfDepth = 10;
      const cos = Math.cos(0);
      const sin = Math.sin(0);

      // Formula: (-halfWidth, -halfDepth) rotated
      const offsetX = (-halfWidth) * cos - (-halfDepth) * sin;
      const offsetY = (-halfWidth) * sin + (-halfDepth) * cos;

      expect(offsetX).toBe(-15);
      expect(offsetY).toBe(-10);
    });

    it('should calculate correct offset for 90 degree rotation', () => {
      const halfWidth = 15;
      const halfDepth = 10;
      const cos = Math.cos(Math.PI / 2);
      const sin = Math.sin(Math.PI / 2);

      const offsetX = (-halfWidth) * cos - (-halfDepth) * sin;
      const offsetY = (-halfWidth) * sin + (-halfDepth) * cos;

      // At 90 degrees: cos ≈ 0, sin ≈ 1
      // offsetX = (-15) * 0 - (-10) * 1 = 10
      // offsetY = (-15) * 1 + (-10) * 0 = -15
      expect(Math.round(offsetX)).toBe(10);
      expect(Math.round(offsetY)).toBe(-15);
    });

    it('should adjust center position correctly', () => {
      const centerX = 100;
      const centerY = 200;
      const halfWidth = 15;
      const halfDepth = 10;
      const rotation = 0;

      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const offsetX = (-halfWidth) * cos - (-halfDepth) * sin;
      const offsetY = (-halfWidth) * sin + (-halfDepth) * cos;

      const adjustedCenterX = centerX - offsetX;
      const adjustedCenterY = centerY - offsetY;

      // At 0 rotation: offset is (-15, -10)
      // Adjusted = (100 - (-15), 200 - (-10)) = (115, 210)
      expect(adjustedCenterX).toBe(115);
      expect(adjustedCenterY).toBe(210);
    });
  });
});
