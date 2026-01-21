/**
 * UI State Tests
 *
 * Tests for the UI state management and smart defaults system.
 */

import {
  calculateSmartDefaultsFromArea,
  createUnitTypeWithDefaults,
  generateUnitId,
  DEFAULT_UNIT_TYPES,
  INITIAL_STATE
} from './ui-state';

describe('UI State', () => {
  describe('calculateSmartDefaultsFromArea', () => {
    it('should return rigid settings for small units (studios)', () => {
      const settings = calculateSmartDefaultsFromArea(550);

      expect(settings.sizeTolerance).toBeLessThanOrEqual(5);
      expect(settings.cornerEligible).toBe(false);
      expect(settings.lShapeEligible).toBe(false);
      expect(settings.placementPriority).toBeLessThan(30);
    });

    it('should return flexible settings for large units (2BR+)', () => {
      const settings = calculateSmartDefaultsFromArea(1200);

      expect(settings.sizeTolerance).toBeGreaterThan(20);
      expect(settings.cornerEligible).toBe(true);
      expect(settings.lShapeEligible).toBe(true);
      expect(settings.placementPriority).toBeGreaterThan(70);
    });

    it('should return intermediate settings for medium units (1BR)', () => {
      const settings = calculateSmartDefaultsFromArea(885);

      // Should be somewhere in the middle
      expect(settings.sizeTolerance).toBeGreaterThan(5);
      expect(settings.sizeTolerance).toBeLessThan(25);
      expect(settings.placementPriority).toBeGreaterThan(20);
      expect(settings.placementPriority).toBeLessThan(80);
    });

    it('should have positive expansion and compression weights', () => {
      const small = calculateSmartDefaultsFromArea(500);
      const large = calculateSmartDefaultsFromArea(1500);

      expect(small.expansionWeight).toBeGreaterThan(0);
      expect(small.compressionWeight).toBeGreaterThan(0);
      expect(large.expansionWeight).toBeGreaterThan(0);
      expect(large.compressionWeight).toBeGreaterThan(0);
    });

    it('should have reasonable minWidth', () => {
      const settings = calculateSmartDefaultsFromArea(1000);
      expect(settings.minWidth).toBe(12); // Standard minimum
    });

    it('should scale maxWidth with area', () => {
      const small = calculateSmartDefaultsFromArea(500);
      const large = calculateSmartDefaultsFromArea(1500);

      expect(large.maxWidth).toBeGreaterThan(small.maxWidth);
    });
  });

  describe('createUnitTypeWithDefaults', () => {
    it('should create unit type with all required fields', () => {
      const unit = createUnitTypeWithDefaults('test', 'Test Unit', '#ff0000', 25, 800);

      expect(unit.id).toBe('test');
      expect(unit.name).toBe('Test Unit');
      expect(unit.color).toBe('#ff0000');
      expect(unit.percentage).toBe(25);
      expect(unit.area).toBe(800);
      expect(unit.useSmartDefaults).toBe(true);
      expect(unit.advancedExpanded).toBe(false);
    });

    it('should calculate smart defaults based on area', () => {
      const smallUnit = createUnitTypeWithDefaults('small', 'Small', '#000', 10, 500);
      const largeUnit = createUnitTypeWithDefaults('large', 'Large', '#fff', 10, 1500);

      // Small unit should have less flexibility
      expect(smallUnit.advanced.sizeTolerance).toBeLessThan(largeUnit.advanced.sizeTolerance);
      expect(smallUnit.advanced.cornerEligible).toBe(false);
      expect(largeUnit.advanced.cornerEligible).toBe(true);
    });
  });

  describe('generateUnitId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateUnitId());
      }
      expect(ids.size).toBe(100);
    });

    it('should start with "unit_" prefix', () => {
      const id = generateUnitId();
      expect(id.startsWith('unit_')).toBe(true);
    });
  });

  describe('DEFAULT_UNIT_TYPES', () => {
    it('should have 4 default unit types', () => {
      expect(DEFAULT_UNIT_TYPES).toHaveLength(4);
    });

    it('should have valid percentages summing to 100', () => {
      const total = DEFAULT_UNIT_TYPES.reduce((sum, u) => sum + u.percentage, 0);
      expect(total).toBe(100);
    });

    it('should have increasing areas', () => {
      for (let i = 1; i < DEFAULT_UNIT_TYPES.length; i++) {
        expect(DEFAULT_UNIT_TYPES[i].area).toBeGreaterThan(DEFAULT_UNIT_TYPES[i - 1].area);
      }
    });

    it('should have valid hex colors', () => {
      DEFAULT_UNIT_TYPES.forEach(unit => {
        expect(unit.color).toMatch(/^#[a-fA-F0-9]{6}$/);
      });
    });
  });

  describe('INITIAL_STATE', () => {
    it('should have valid building dimensions', () => {
      expect(INITIAL_STATE.length).toBeGreaterThan(0);
      expect(INITIAL_STATE.buildingDepth).toBeGreaterThan(0);
      expect(INITIAL_STATE.corridorWidth).toBeGreaterThan(0);
    });

    it('should have valid core dimensions', () => {
      expect(INITIAL_STATE.coreWidth).toBeGreaterThan(0);
      expect(INITIAL_STATE.coreDepth).toBeGreaterThan(0);
    });

    it('should have valid egress settings', () => {
      expect(INITIAL_STATE.commonPath).toBeGreaterThan(0);
      expect(INITIAL_STATE.travelDistance).toBeGreaterThan(0);
      expect(INITIAL_STATE.deadEnd).toBeGreaterThan(0);
    });

    it('should have alignment at 100% by default', () => {
      expect(INITIAL_STATE.alignment).toBe(100);
    });

    it('should have auto-generate off by default', () => {
      expect(INITIAL_STATE.autoGenerate).toBe(false);
    });
  });
});
