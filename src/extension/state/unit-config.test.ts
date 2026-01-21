/**
 * Unit Configuration Tests
 *
 * Tests for the UI-to-algorithm configuration converters.
 */

import { UnitType } from '../../algorithm/types';
import { FEET_TO_METERS, SQ_FEET_TO_SQ_METERS } from '../../algorithm/constants';
import { state, DEFAULT_UNIT_TYPES, INITIAL_STATE } from './ui-state';
import { getUnitConfiguration, getUnitColors, getEgressConfig } from './unit-config';

describe('Unit Configuration Converters', () => {
  // Reset state before each test
  beforeEach(() => {
    Object.assign(state, { ...INITIAL_STATE, unitTypes: [...DEFAULT_UNIT_TYPES] });
  });

  describe('getUnitConfiguration', () => {
    it('should return configuration with all unit types', () => {
      const config = getUnitConfiguration();

      expect(config[UnitType.Studio]).toBeDefined();
      expect(config[UnitType.OneBed]).toBeDefined();
      expect(config[UnitType.TwoBed]).toBeDefined();
      expect(config[UnitType.ThreeBed]).toBeDefined();
    });

    it('should convert areas from sq ft to sq meters', () => {
      const config = getUnitConfiguration();

      // Smallest unit (Studio) should have area in sq meters
      const studioAreaSqFt = DEFAULT_UNIT_TYPES[0].area;
      expect(config[UnitType.Studio].area).toBeCloseTo(studioAreaSqFt * SQ_FEET_TO_SQ_METERS, 1);
    });

    it('should map smallest unit to Studio type', () => {
      state.unitTypes = [
        { id: 'small', name: 'Small', color: '#000', percentage: 100, area: 400,
          advanced: { cornerEligible: false, lShapeEligible: false, sizeTolerance: 0,
            minWidth: 12, maxWidth: 30, placementPriority: 10, expansionWeight: 1, compressionWeight: 0.5 },
          useSmartDefaults: true, advancedExpanded: false }
      ];

      const config = getUnitConfiguration();

      expect(config[UnitType.Studio].percentage).toBe(100);
    });

    it('should preserve cornerEligible settings', () => {
      // Studios default to corner-ineligible
      const config = getUnitConfiguration();
      expect(config[UnitType.Studio].cornerEligible).toBe(false);

      // 2BR+ should be corner-eligible
      expect(config[UnitType.TwoBed].cornerEligible).toBe(true);
    });

    it('should handle empty unit types gracefully', () => {
      state.unitTypes = [];
      const config = getUnitConfiguration();

      // Should still return a valid config structure with zeros
      expect(config[UnitType.Studio].percentage).toBe(0);
    });
  });

  describe('getUnitColors', () => {
    it('should return colors for all unit types', () => {
      const colors = getUnitColors();

      expect(colors[UnitType.Studio]).toBeDefined();
      expect(colors[UnitType.OneBed]).toBeDefined();
      expect(colors[UnitType.TwoBed]).toBeDefined();
      expect(colors[UnitType.ThreeBed]).toBeDefined();
    });

    it('should return valid hex colors', () => {
      const colors = getUnitColors();

      Object.values(colors).forEach(color => {
        expect(color).toMatch(/^#[a-fA-F0-9]{6}$/);
      });
    });

    it('should map colors by unit size (smallest = Studio)', () => {
      // Manually set different colors for each size
      state.unitTypes = [
        { ...DEFAULT_UNIT_TYPES[0], area: 500, color: '#111111' },  // Smallest
        { ...DEFAULT_UNIT_TYPES[1], area: 800, color: '#222222' },
        { ...DEFAULT_UNIT_TYPES[2], area: 1100, color: '#333333' },
        { ...DEFAULT_UNIT_TYPES[3], area: 1400, color: '#444444' }  // Largest
      ];

      const colors = getUnitColors();

      expect(colors[UnitType.Studio]).toBe('#111111');
      expect(colors[UnitType.ThreeBed]).toBe('#444444');
    });
  });

  describe('getEgressConfig', () => {
    it('should return sprinklered config when sprinklered is true', () => {
      state.sprinklered = true;
      const config = getEgressConfig();

      expect(config.sprinklered).toBe(true);
    });

    it('should return unsprinklered config when sprinklered is false', () => {
      state.sprinklered = false;
      const config = getEgressConfig();

      expect(config.sprinklered).toBe(false);
    });

    it('should convert distances from feet to meters', () => {
      state.deadEnd = 50;
      state.travelDistance = 250;
      state.commonPath = 125;

      const config = getEgressConfig();

      expect(config.deadEndLimit).toBeCloseTo(50 * FEET_TO_METERS, 2);
      expect(config.travelDistanceLimit).toBeCloseTo(250 * FEET_TO_METERS, 2);
      expect(config.commonPathLimit).toBeCloseTo(125 * FEET_TO_METERS, 2);
    });

    it('should override base config with UI values', () => {
      state.deadEnd = 100; // Unusual value
      const config = getEgressConfig();

      expect(config.deadEndLimit).toBeCloseTo(100 * FEET_TO_METERS, 2);
    });
  });
});
