/**
 * Test Fixtures - Building Footprints
 *
 * Pre-defined building footprints for testing the floorplate generator.
 * All dimensions are in meters unless otherwise noted.
 */

import { BuildingFootprint } from '../../src/algorithm/types';

/**
 * Simple rectangular bar building - 300ft x 65ft (91.4m x 19.8m)
 * Standard multifamily dimensions, axis-aligned
 */
export const SIMPLE_FOOTPRINT: BuildingFootprint = {
  width: 91.44,   // 300 ft
  depth: 19.81,   // 65 ft
  height: 32.0,   // ~10 floors
  centerX: 0,
  centerY: 0,
  rotation: 0,
  floorZ: 0,
  minX: -45.72,
  maxX: 45.72,
  minY: -9.905,
  maxY: 9.905
};

/**
 * Short building - 150ft x 65ft (45.7m x 19.8m)
 * Only needs 2 end cores (no mid core)
 */
export const SHORT_FOOTPRINT: BuildingFootprint = {
  width: 45.72,   // 150 ft
  depth: 19.81,   // 65 ft
  height: 16.0,   // ~5 floors
  centerX: 0,
  centerY: 0,
  rotation: 0,
  floorZ: 0,
  minX: -22.86,
  maxX: 22.86,
  minY: -9.905,
  maxY: 9.905
};

/**
 * Long building - 500ft x 65ft (152.4m x 19.8m)
 * Needs 3 cores (2 end + 1 mid) for egress
 */
export const LONG_FOOTPRINT: BuildingFootprint = {
  width: 152.4,   // 500 ft
  depth: 19.81,   // 65 ft
  height: 32.0,   // ~10 floors
  centerX: 0,
  centerY: 0,
  rotation: 0,
  floorZ: 0,
  minX: -76.2,
  maxX: 76.2,
  minY: -9.905,
  maxY: 9.905
};

/**
 * Rotated building - 45 degrees from axis
 * Tests coordinate transformation
 */
export const ROTATED_FOOTPRINT: BuildingFootprint = {
  width: 91.44,   // 300 ft
  depth: 19.81,   // 65 ft
  height: 32.0,
  centerX: 100,
  centerY: 50,
  rotation: Math.PI / 4,  // 45 degrees
  floorZ: 10,
  minX: 50,
  maxX: 150,
  minY: 0,
  maxY: 100
};

/**
 * Narrow building - 200ft x 55ft (60.9m x 16.8m)
 * Smaller depth challenges unit fitting
 */
export const NARROW_FOOTPRINT: BuildingFootprint = {
  width: 60.96,   // 200 ft
  depth: 16.76,   // 55 ft
  height: 24.0,   // ~7 floors
  centerX: 0,
  centerY: 0,
  rotation: 0,
  floorZ: 0,
  minX: -30.48,
  maxX: 30.48,
  minY: -8.38,
  maxY: 8.38
};
