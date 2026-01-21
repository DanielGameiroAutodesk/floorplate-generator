/**
 * Test Fixtures - Unit Configurations
 *
 * Pre-defined unit mix configurations for testing.
 * Areas are in square meters (converted from sq ft).
 */

import { UnitType, UnitConfiguration, EgressConfig } from '../../src/algorithm/types';
import { SQ_FEET_TO_SQ_METERS, FEET_TO_METERS } from '../../src/algorithm/constants';

/**
 * Standard multifamily mix - 20/40/30/10
 */
export const STANDARD_CONFIG: UnitConfiguration = {
  [UnitType.Studio]: {
    percentage: 20,
    area: 590 * SQ_FEET_TO_SQ_METERS,  // 54.8 sq m
    cornerEligible: false
  },
  [UnitType.OneBed]: {
    percentage: 40,
    area: 885 * SQ_FEET_TO_SQ_METERS,  // 82.2 sq m
    cornerEligible: false
  },
  [UnitType.TwoBed]: {
    percentage: 30,
    area: 1180 * SQ_FEET_TO_SQ_METERS, // 109.6 sq m
    cornerEligible: true
  },
  [UnitType.ThreeBed]: {
    percentage: 10,
    area: 1475 * SQ_FEET_TO_SQ_METERS, // 137.0 sq m
    cornerEligible: true
  }
};

/**
 * Studios-heavy mix - 40/40/15/5
 */
export const STUDIO_HEAVY_CONFIG: UnitConfiguration = {
  [UnitType.Studio]: {
    percentage: 40,
    area: 550 * SQ_FEET_TO_SQ_METERS,
    cornerEligible: false
  },
  [UnitType.OneBed]: {
    percentage: 40,
    area: 800 * SQ_FEET_TO_SQ_METERS,
    cornerEligible: false
  },
  [UnitType.TwoBed]: {
    percentage: 15,
    area: 1100 * SQ_FEET_TO_SQ_METERS,
    cornerEligible: true
  },
  [UnitType.ThreeBed]: {
    percentage: 5,
    area: 1400 * SQ_FEET_TO_SQ_METERS,
    cornerEligible: true
  }
};

/**
 * Family-oriented mix - 10/20/40/30
 */
export const FAMILY_CONFIG: UnitConfiguration = {
  [UnitType.Studio]: {
    percentage: 10,
    area: 600 * SQ_FEET_TO_SQ_METERS,
    cornerEligible: false
  },
  [UnitType.OneBed]: {
    percentage: 20,
    area: 900 * SQ_FEET_TO_SQ_METERS,
    cornerEligible: false
  },
  [UnitType.TwoBed]: {
    percentage: 40,
    area: 1200 * SQ_FEET_TO_SQ_METERS,
    cornerEligible: true
  },
  [UnitType.ThreeBed]: {
    percentage: 30,
    area: 1500 * SQ_FEET_TO_SQ_METERS,
    cornerEligible: true
  }
};

/**
 * Single type - 100% studios (edge case)
 */
export const STUDIOS_ONLY_CONFIG: UnitConfiguration = {
  [UnitType.Studio]: {
    percentage: 100,
    area: 550 * SQ_FEET_TO_SQ_METERS,
    cornerEligible: false  // Even at 100%, studios shouldn't go at corners
  },
  [UnitType.OneBed]: {
    percentage: 0,
    area: 800 * SQ_FEET_TO_SQ_METERS,
    cornerEligible: false
  },
  [UnitType.TwoBed]: {
    percentage: 0,
    area: 1100 * SQ_FEET_TO_SQ_METERS,
    cornerEligible: true
  },
  [UnitType.ThreeBed]: {
    percentage: 0,
    area: 1400 * SQ_FEET_TO_SQ_METERS,
    cornerEligible: true
  }
};

/**
 * Sprinklered building egress config
 */
export const EGRESS_SPRINKLERED: EgressConfig = {
  sprinklered: true,
  deadEndLimit: 50 * FEET_TO_METERS,           // 15.24m
  travelDistanceLimit: 250 * FEET_TO_METERS,   // 76.2m
  commonPathLimit: 125 * FEET_TO_METERS        // 38.1m
};

/**
 * Unsprinklered building egress config
 */
export const EGRESS_UNSPRINKLERED: EgressConfig = {
  sprinklered: false,
  deadEndLimit: 20 * FEET_TO_METERS,           // 6.1m
  travelDistanceLimit: 200 * FEET_TO_METERS,   // 60.96m
  commonPathLimit: 75 * FEET_TO_METERS         // 22.86m
};
