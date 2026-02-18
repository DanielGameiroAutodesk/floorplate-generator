/**
 * Floorplate Generator - Improved Algorithm
 *
 * Based on the superior layoutGenerator implementation with key improvements:
 * 1. Separate compression weights (Studio: 0.0001 = virtually rigid)
 * 2. "NO STUDIOS AT WRAP" constraint - swaps Studios away from bonus positions
 * 3. Pre-validates unit fit before placement
 * 4. Flexibility enforced as both upper AND lower bounds
 * 5. Rounding error goes to most flexible unit
 * 6. Wall alignment respects minimum widths
 */

import {
  UnitType,
  UnitConfiguration,
  EgressConfig,
  FloorPlanData,
  UnitBlock,
  CoreBlock,
  FillerBlock,
  CorridorBlock,
  BuildingFootprint,
  LayoutOption,
  OptimizationStrategy,
  GeneratorOptions,
  SegmentGenerationContext,
  OptimizationSearchContext,
  SegmentDefinition,
  WallAlignmentInput
} from './types';

import {
  UNIT_COLORS,
  MIN_UNIT_WIDTH,
  DEFAULT_CORRIDOR_WIDTH,
  DEFAULT_CORE_WIDTH,
  DEFAULT_CORE_DEPTH,
  FEET_TO_METERS,
  STRATEGY_LABELS,
  STRATEGY_DESCRIPTIONS,
  FLEXIBILITY,
  GEOMETRY_SEARCH
} from './constants';

// Re-export footprint extraction from dedicated module
export { extractFootprintFromTriangles, FootprintExtractionError } from './footprint';

// Import flexibility model functions
import {
  getUnitWidth,
  getFlexibilityFactor,
  getFlexibilityWeight,
  getMaxUnitWidth,
  isCornerEligible,
  isLShapeEligible
} from './flexibility-model';

// Import unit count calculation functions
import {
  getTotal,
  applyCoreSideMixBias,
  calculateBuildingUnitCounts
} from './unit-counts';

// Import logging utility
import { Logger } from './utils/logger';

// ============================================================================
// TYPES
// ============================================================================

type PatternStrategy = 'desc' | 'asc' | 'valley' | 'valley-inverted' | 'random';

// Custom color map for unit types (hex color strings)
export type UnitColorMap = Partial<Record<UnitType, string>>;

interface InternalUnitBlock {
  id: string;
  type: UnitType;
  typeId: string;       // Dynamic type identifier
  typeName: string;     // Display name
  x: number;
  y: number;
  width: number;
  depth: number;
  area: number;
  color: string;
  rects?: { x: number; y: number; width: number; depth: number }[];
  polyPoints?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Note: getTotal, getUnitWidth moved to unit-counts.ts and flexibility-model.ts

/**
 * Get the color for a unit type, with optional custom color override.
 * This is a pure function - no module-level state.
 *
 * @param type - Unit type to get color for
 * @param customColors - Optional custom color map to override defaults
 */
const getUnitColor = (type: UnitType, customColors?: UnitColorMap): string => {
  // Check for custom color first (hex string)
  if (customColors?.[type]) {
    return customColors[type]!;
  }
  // Fallback to default UNIT_COLORS
  const c = UNIT_COLORS[type];
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a / 255})`;
};

// Minimum filler width threshold
// Set to 1cm (0.01m) to capture real gaps while ignoring floating-point precision errors
// Gaps smaller than this are likely just numerical artifacts, not real layout gaps
const MIN_FILLER_WIDTH = 0.01;

/**
 * Detect gaps in a segment and create filler blocks for them.
 * Returns FillerBlock[] for any gaps larger than MIN_FILLER_WIDTH.
 * These fillers are baked as CORE-type units to ensure full building coverage.
 *
 * @param cores - Core blocks to exclude from gap detection (cores already occupy that space)
 * @param coreSide - Which side has cores ('North' or 'South')
 */
const detectGapsAndCreateFillers = (
  units: InternalUnitBlock[],
  cores: CoreBlock[],
  coreSide: 'North' | 'South',
  segmentStartX: number,
  segmentEndX: number,
  y: number,
  depth: number,
  side: 'North' | 'South',
  fillerIdPrefix: string
): FillerBlock[] => {
  const fillers: FillerBlock[] = [];

  // Get units that OVERLAP with this segment (within Y tolerance)
  // A unit overlaps if it starts before segment ends AND ends after segment starts
  const segmentUnits = units.filter(u =>
    Math.abs(u.y - y) < 0.1 &&
    u.x < segmentEndX + 0.1 &&           // starts before segment ends
    (u.x + u.width) > segmentStartX - 0.1  // ends after segment starts
  );

  // Create "occupied ranges" from units (clipped to segment bounds)
  // Also include cores if this is the core side (cores occupy space on their side)
  interface OccupiedRange { x: number; endX: number }
  const occupiedRanges: OccupiedRange[] = segmentUnits.map(u => ({
    x: Math.max(u.x, segmentStartX),          // clip to segment start
    endX: Math.min(u.x + u.width, segmentEndX)  // clip to segment end
  }));

  // Add core ranges if this is the core side (clipped to segment bounds)
  if (side === coreSide) {
    for (const core of cores) {
      // Only include cores that overlap with this segment
      if (core.x < segmentEndX && (core.x + core.width) > segmentStartX) {
        occupiedRanges.push({
          x: Math.max(core.x, segmentStartX),
          endX: Math.min(core.x + core.width, segmentEndX)
        });
      }
    }
  }

  // Sort by x position and merge overlapping ranges
  occupiedRanges.sort((a, b) => a.x - b.x);

  const mergedRanges: OccupiedRange[] = [];
  for (const range of occupiedRanges) {
    if (mergedRanges.length === 0) {
      mergedRanges.push({ ...range });
    } else {
      const last = mergedRanges[mergedRanges.length - 1];
      if (range.x <= last.endX + 0.01) {
        // Overlapping or adjacent, merge
        last.endX = Math.max(last.endX, range.endX);
      } else {
        mergedRanges.push({ ...range });
      }
    }
  }

  // Find gaps between merged ranges
  let currentX = segmentStartX;
  let fillerCount = 0;

  for (const range of mergedRanges) {
    const gapWidth = range.x - currentX;
    if (gapWidth > MIN_FILLER_WIDTH) {
      fillers.push({
        id: `${fillerIdPrefix}-filler-${fillerCount++}`,
        x: currentX,
        y,
        width: gapWidth,
        depth,
        side
      });
      Logger.debug(` Created filler at x=${currentX.toFixed(2)}, width=${gapWidth.toFixed(2)}m`);
    }
    currentX = range.endX;
  }

  // Check for gap at end of segment
  const endGap = segmentEndX - currentX;
  if (endGap > MIN_FILLER_WIDTH) {
    fillers.push({
      id: `${fillerIdPrefix}-filler-${fillerCount}`,
      x: currentX,
      y,
      width: endGap,
      depth,
      side
    });
    Logger.debug(` Created end filler at x=${currentX.toFixed(2)}, width=${endGap.toFixed(2)}m`);
  }

  return fillers;
};

// ============================================================================
// FLEXIBILITY MODEL
// Moved to ./flexibility-model.ts
// ============================================================================

// ============================================================================
// UNIT COUNT CALCULATION
// Moved to ./unit-counts.ts
// ============================================================================

// ============================================================================
// UNIT PLACEMENT LOGIC
// Chooses the appropriate unit from inventory respecting flexibility
// ============================================================================

const pickBestUnitForSegment = (
  inventory: Record<UnitType, number>,
  isCorner: boolean,
  prioritizeCorners: boolean,
  remainingSpace: number,
  config: UnitConfiguration,
  rentableDepth: number
): UnitType | null => {
  const types = ([UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio] as UnitType[])
                .filter(t => inventory[t] > 0);

  if (types.length === 0) return null;

  // Helper to check if a unit type can physically fit in the remaining space
  const canFit = (t: UnitType, aggressive: boolean = false): boolean => {
    const w = getUnitWidth(t, config, rentableDepth);
    const flexibility = getFlexibilityFactor(t);
    // For aggressive (corner) fitting, allow more squeeze
    const effectiveFlex = aggressive
      ? Math.min(flexibility * FLEXIBILITY.AGGRESSIVE_MULTIPLIER + FLEXIBILITY.AGGRESSIVE_BASE, FLEXIBILITY.AGGRESSIVE_MAX)
      : flexibility;
    const minReq = w * (1.0 - effectiveFlex);
    return remainingSpace >= minReq - FLEXIBILITY.NAN_PREVENTION_TOLERANCE;
  };

  // CORNER PRIORITIZATION: When filling corners, ONLY place corner-eligible units
  // Corners are PREMIUM positions - largest units get priority, width constraints are relaxed
  if (prioritizeCorners && isCorner) {
    // Try to place a CORNER-ELIGIBLE unit that fits (prefer larger units first - types already sorted)
    const cornerEligibleTypes = types.filter(t => isCornerEligible(t, config));
    Logger.debug(` pickBestUnitForSegment: corner segment, space=${remainingSpace.toFixed(2)}m, available types=${types.join(',')}, corner-eligible=${cornerEligibleTypes.join(',')}`);

    for (const t of cornerEligibleTypes) {
      const w = getUnitWidth(t, config, rentableDepth);
      // IMPORTANT: Do NOT “pretend fit” corner units with aggressive squeeze here.
      // `generateUnitSegment()` enforces hard minimum widths (target = minimum) so
      // aggressive fitting causes later overflow trimming that can break corner eligibility.
      const minReq = w; // target width is the true minimum requirement
      const fits = remainingSpace >= minReq - FLEXIBILITY.UNIT_FIT_TOLERANCE;
      Logger.debug(`   Trying ${t}: width=${w.toFixed(2)}m, minReq=${minReq.toFixed(2)}m, fits=${fits}`);
      if (fits) {
        Logger.debug(`   → Selected ${t} for corner segment`);
        return t;
      }
    }

    // No corner-eligible unit available in inventory or none fit
    // Last resort: pick the largest unit that fits (warning logged)
    if (cornerEligibleTypes.length === 0) {
      Logger.warn(` No corner-eligible units in inventory for corner segment`);
    } else {
      Logger.warn(` No corner-eligible unit fits in corner segment with ${remainingSpace.toFixed(2)}m space`);
    }

    for (const t of types) {
      if (canFit(t, false)) {
        Logger.debug(`   → Fallback to ${t} for corner segment (not corner-eligible)`);
        return t;
      }
    }
  }

  // STANDARD PLACEMENT: Check availability AND physical fit (with normal flexibility)
  for (const t of types) {
    if (canFit(t, false)) {
      return t;
    }
  }

  return null;
};

// ============================================================================
// SEGMENT DISTRIBUTION
// Advanced Capacity-Aware Distribution with flexibility
// ============================================================================

const distributeUnitsToSegments = (
  globalCounts: Record<UnitType, number>,
  segments: SegmentDefinition[],
  config: UnitConfiguration,
  rentableDepth: number,
  prioritizeCorners: boolean
): Record<UnitType, number>[] => {
  const segmentCounts: Record<UnitType, number>[] = segments.map(() => ({
    [UnitType.Studio]: 0, [UnitType.OneBed]: 0, [UnitType.TwoBed]: 0, [UnitType.ThreeBed]: 0
  }));

  if (segments.length === 0) return segmentCounts;

  const inventory = { ...globalCounts };
  const hasInventory = () => getTotal(inventory) > 0;

  const segmentState = segments.map((s, idx) => ({
    idx,
    isCorner: s.isCorner,
    capacity: s.len + (s.bonusArea / rentableDepth),
    fill: 0,
    units: [] as UnitType[]
  }));

  // Sort segments by priority
  const sortedSegIndices = segmentState.map((_, i) => i).sort((a, b) => {
    const sA = segmentState[a];
    const sB = segmentState[b];
    if (prioritizeCorners) {
      if (sA.isCorner !== sB.isCorner) return sA.isCorner ? -1 : 1;
    }
    return sB.capacity - sA.capacity;
  });

  // PASS 0: RESERVE CORNER-ELIGIBLE UNITS FOR CORNERS
  // CRITICAL: Each corner segment MUST have at least one corner-eligible unit
  // This is non-negotiable - corners are premium positions
  if (prioritizeCorners) {
    const cornerSegIndices = sortedSegIndices.filter(idx => segmentState[idx].isCorner);

    Logger.debug(` PASS 0: Reserving corner-eligible units. Corners: ${cornerSegIndices.length}`);

    // Try to place one corner-eligible unit in each corner segment
    // PRIORITY: 3BR > 2BR > 1BR > Studio
    // We iterate by UNIT TYPE priority, then by segment
    const priorityTypes = [UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio] as UnitType[];
    
    for (const t of priorityTypes) {
      if (!isCornerEligible(t, config)) continue;
      
      // Try to place this type in empty corner segments
      for (const idx of cornerSegIndices) {
        const seg = segmentState[idx];
        const hasCornerUnit = getTotal(segmentCounts[idx]) > 0;
        
        if (!hasCornerUnit && inventory[t] > 0) {
          const w = getUnitWidth(t, config, rentableDepth);
          const remainingSpace = seg.capacity - seg.fill;
          
          // Hard-min requirement: target width is the minimum
          if (remainingSpace >= w - FLEXIBILITY.UNIT_FIT_TOLERANCE) {
            segmentCounts[idx][t]++;
            inventory[t]--;
            seg.fill += w;
            Logger.debug(` PASS 0: Reserved PRIORITY ${t} for corner segment ${idx} (w=${w.toFixed(2)}m)`);
          }
        }
      }
    }

    // Fallback: If any corner segments are still empty, force whatever fits
    for (const idx of cornerSegIndices) {
      const seg = segmentState[idx];
      const hasCornerUnit = getTotal(segmentCounts[idx]) > 0;
      if (hasCornerUnit) continue;

      // ... existing fallback logic ...
      const cornerEligibleTypes = priorityTypes.filter(t => inventory[t] > 0 && isCornerEligible(t, config));
      const remainingSpace = seg.capacity - seg.fill;

      // Place the highest-priority corner-eligible unit that fits
      let placed = false;
      for (const t of cornerEligibleTypes) {
        const w = getUnitWidth(t, config, rentableDepth);
        if (remainingSpace >= w - FLEXIBILITY.UNIT_FIT_TOLERANCE) {
          segmentCounts[idx][t]++;
          inventory[t]--;
          seg.fill += w;
          placed = true;
          Logger.debug(` PASS 0 (fallback): Forced ${t} into corner segment ${idx} (w=${w.toFixed(2)}m)`);
          break;
        }
      }

      if (!placed) {
        Logger.warn(` PASS 0 (fallback): Could not fit any corner-eligible unit in corner segment ${idx} (remaining=${remainingSpace.toFixed(2)}m)`);
      }
    }
  }

  // PASS 1: ITERATIVE FILL
  let madeProgress = true;
  while (hasInventory() && madeProgress) {
    madeProgress = false;

    for (const idx of sortedSegIndices) {
      const seg = segmentState[idx];
      const remainingSpace = seg.capacity - seg.fill;

      if (remainingSpace <= 0.5) continue;

      const unitType = pickBestUnitForSegment(inventory, seg.isCorner, prioritizeCorners, remainingSpace, config, rentableDepth);

      if (unitType) {
        segmentCounts[idx][unitType]++;
        inventory[unitType]--;
        const width = getUnitWidth(unitType, config, rentableDepth);
        seg.fill += width;
        madeProgress = true;
      }
    }
  }

  // PASS 2: OVERFLOW
  while (hasInventory()) {
    let bestIdx = -1;
    let minDensity = Number.MAX_VALUE;

    segmentState.forEach((s, i) => {
      const density = s.fill / s.capacity;
      const currentUnits = segmentCounts[i];
      const totalU = getTotal(currentUnits);
      const rigidU = currentUnits[UnitType.Studio];
      const rigidityRatio = totalU > 0 ? rigidU / totalU : 0;
      const effectiveDensity = density + (rigidityRatio * 0.5);

      if (effectiveDensity < minDensity) {
        minDensity = effectiveDensity;
        bestIdx = i;
      }
    });

    if (bestIdx !== -1) {
      const types = [UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio] as UnitType[];
      const type = types.find(t => inventory[t] > 0);
      if (type) {
        segmentCounts[bestIdx][type]++;
        inventory[type]--;
        segmentState[bestIdx].fill += getUnitWidth(type, config, rentableDepth);
      }
    } else {
      break;
    }
  }

  // PASS 3: GUARANTEE NO EMPTY SEGMENTS
  // CRITICAL: Every segment MUST have at least 1 unit to avoid white space gaps
  // If a segment has 0 units, steal one from the most populated segment
  for (let idx = 0; idx < segmentCounts.length; idx++) {
    const totalInSegment = getTotal(segmentCounts[idx]);

    if (totalInSegment === 0) {
      Logger.debug(` PASS 3: Segment ${idx} has 0 units - attempting to redistribute`);

      // Find segment with most units to steal from
      let donorIdx = -1;
      let maxUnits = 0;

      for (let i = 0; i < segmentCounts.length; i++) {
        if (i === idx) continue;
        const unitsInSeg = getTotal(segmentCounts[i]);
        // Only steal from segments with more than 1 unit
        if (unitsInSeg > maxUnits && unitsInSeg > 1) {
          maxUnits = unitsInSeg;
          donorIdx = i;
        }
      }

      if (donorIdx !== -1) {
        // Determine what type to steal based on segment characteristics
        const isCornerSeg = segmentState[idx].isCorner;

        // Priority order for stealing: prefer corner-eligible for corners, any type otherwise
        const stealOrder = isCornerSeg
          ? [UnitType.TwoBed, UnitType.ThreeBed, UnitType.OneBed, UnitType.Studio] as UnitType[]
          : [UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed] as UnitType[];

        for (const t of stealOrder) {
          if (segmentCounts[donorIdx][t] > 0) {
            // Steal one unit
            segmentCounts[donorIdx][t]--;
            segmentCounts[idx][t]++;
            Logger.debug(` PASS 3: Moved 1x ${t} from segment ${donorIdx} to segment ${idx} to fill gap`);
            break;
          }
        }
      } else {
        Logger.debug(` PASS 3: WARNING - Cannot fill segment ${idx}, no donor segments available!`);
      }
    }
  }

  // Final debug output
  Logger.debug(` Final segment distribution:`);
  segmentCounts.forEach((counts, idx) => {
    const total = getTotal(counts);
    const isCorner = segmentState[idx].isCorner;
    Logger.debug(`   Segment ${idx} (${isCorner ? 'CORNER' : 'mid'}): ${total} units - S=${counts[UnitType.Studio]}, 1BR=${counts[UnitType.OneBed]}, 2BR=${counts[UnitType.TwoBed]}, 3BR=${counts[UnitType.ThreeBed]}`);
  });

  return segmentCounts;
};

// ============================================================================
// UNIT SEGMENT GENERATION
// Generates units with weighted geometry distribution
// ============================================================================

const generateUnitSegment = (
  ctx: SegmentGenerationContext,
  config: UnitConfiguration,
  rentableDepth: number
): InternalUnitBlock[] => {
  // Destructure context
  const { geometry, classification, unitCounts: counts, pattern, endBonusArea = 0, customColors } = ctx;
  const { startX, y, length: segmentLength, extraWidth = 0 } = geometry;
  const { isCorner = false, isLeftCorner = false, isRightCorner = false } = classification;

  if (segmentLength <= 0) {
    Logger.warn(` generateUnitSegment: segment has zero/negative length (${segmentLength.toFixed(2)}m) - returning empty!`);
    return [];
  }

  const totalUnits = getTotal(counts);
  if (totalUnits === 0) {
    Logger.warn(` generateUnitSegment: received 0 units for segment of length ${segmentLength.toFixed(2)}m - WHITE SPACE WILL RESULT!`);
    Logger.warn(`   isCorner=${isCorner}, isLeftCorner=${isLeftCorner}, isRightCorner=${isRightCorner}`);
    return [];
  }

  const unitsToPlace: UnitType[] = [];
  const mutableCounts = { ...counts };

  // Prepare inventory list
  const inventoryList: UnitType[] = [];
  ([UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio] as const).forEach(type => {
    while (mutableCounts[type] > 0) {
      inventoryList.push(type);
      mutableCounts[type]--;
    }
  });

  // Apply pattern
  if (pattern === 'desc') {
    unitsToPlace.push(...inventoryList);
  } else if (pattern === 'asc') {
    unitsToPlace.push(...inventoryList.reverse());
  } else if (pattern === 'valley') {
    const leftPart: UnitType[] = [];
    const rightPart: UnitType[] = [];
    inventoryList.forEach((unit, i) => {
      if (i % 2 === 0) leftPart.push(unit);
      else rightPart.push(unit);
    });
    unitsToPlace.push(...leftPart, ...rightPart.reverse());
  } else if (pattern === 'valley-inverted') {
    const leftPart: UnitType[] = [];
    const rightPart: UnitType[] = [];
    inventoryList.forEach((unit, i) => {
      if (i % 2 === 0) rightPart.push(unit);
      else leftPart.push(unit);
    });
    unitsToPlace.push(...leftPart, ...rightPart.reverse());
  } else if (pattern === 'random') {
    for (let i = inventoryList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [inventoryList[i], inventoryList[j]] = [inventoryList[j], inventoryList[i]];
    }
    unitsToPlace.push(...inventoryList);
  }

  // For right-only corner segments, the bonus applies to the FIRST unit (adjacent to right core),
  // not the last. For all other segments (including left corners), it applies to the last unit.
  const bonusOnFirstUnit = isRightCorner && !isLeftCorner;

  // --- CONSTRAINT: NO STUDIOS AT WRAP ---
  if (endBonusArea > 0 && unitsToPlace.length > 0) {
    const wrapIdx = bonusOnFirstUnit ? 0 : unitsToPlace.length - 1;
    if (unitsToPlace[wrapIdx] === UnitType.Studio) {
      let swapIdx = -1;
      if (bonusOnFirstUnit) {
        // Swap away from index 0 toward the end
        const stopIdx = isRightCorner ? unitsToPlace.length - 2 : unitsToPlace.length - 1;
        for (let i = 1; i <= stopIdx; i++) {
          if (unitsToPlace[i] !== UnitType.Studio) { swapIdx = i; break; }
        }
      } else {
        const stopIdx = startX === 0 ? 1 : 0;
        for (let i = wrapIdx - 1; i >= stopIdx; i--) {
          if (unitsToPlace[i] !== UnitType.Studio) { swapIdx = i; break; }
        }
      }

      if (swapIdx !== -1) {
        [unitsToPlace[wrapIdx], unitsToPlace[swapIdx]] = [unitsToPlace[swapIdx], unitsToPlace[wrapIdx]];
      }
    }
  }

  // --- CONSTRAINT: CORNER-ELIGIBLE UNITS AT BUILDING CORNERS ---
  // Only corner-eligible unit types (top 2 largest by area) can be placed at facade corners
  // This uses the isCornerEligible() function which respects configuration
  Logger.debug(` generateUnitSegment: startX=${startX.toFixed(2)}, isCorner=${isCorner}, isLeftCorner=${isLeftCorner}, isRightCorner=${isRightCorner}, units=${unitsToPlace.length}`);

  if (isCorner && unitsToPlace.length > 1) {
    Logger.debug(` Corner segment at x=${startX}: isLeftCorner=${isLeftCorner}, isRightCorner=${isRightCorner}`);
    Logger.debug(` Units in segment:`, unitsToPlace.map(t => `${t}(corner:${isCornerEligible(t, config)})`));

    // LEFT CORNER: Ensure first unit is corner-eligible
    if (isLeftCorner && !isCornerEligible(unitsToPlace[0], config)) {
      Logger.debug(` LEFT CORNER: First unit ${unitsToPlace[0]} is NOT corner-eligible, looking for swap...`);
      // Find a corner-eligible unit to swap to position 0
      let swapped = false;
      for (let i = 1; i < unitsToPlace.length; i++) {
        if (isCornerEligible(unitsToPlace[i], config)) {
          Logger.debug(` LEFT CORNER: Swapping ${unitsToPlace[0]} with ${unitsToPlace[i]} at index ${i}`);
          [unitsToPlace[0], unitsToPlace[i]] = [unitsToPlace[i], unitsToPlace[0]];
          swapped = true;
          break;
        }
      }
      if (!swapped) {
        Logger.debug(` LEFT CORNER: NO corner-eligible unit found to swap!`);
      }
    }

    // RIGHT CORNER: Ensure last unit is corner-eligible
    if (isRightCorner) {
      const lastIdx = unitsToPlace.length - 1;
      Logger.debug(` RIGHT CORNER: Checking last unit ${unitsToPlace[lastIdx]}, corner-eligible=${isCornerEligible(unitsToPlace[lastIdx], config)}`);
      if (!isCornerEligible(unitsToPlace[lastIdx], config)) {
        Logger.debug(` RIGHT CORNER: Last unit ${unitsToPlace[lastIdx]} is NOT corner-eligible, looking for swap...`);
        // Find a corner-eligible unit to swap to last position (avoid swapping with position 0 if it's also a facade corner)
        const startSearch = isLeftCorner ? 1 : 0;
        let swapped = false;
        for (let i = lastIdx - 1; i >= startSearch; i--) {
          if (isCornerEligible(unitsToPlace[i], config)) {
            Logger.debug(` RIGHT CORNER: Swapping ${unitsToPlace[lastIdx]} with ${unitsToPlace[i]} at index ${i}`);
            [unitsToPlace[lastIdx], unitsToPlace[i]] = [unitsToPlace[i], unitsToPlace[lastIdx]];
            swapped = true;
            break;
          }
        }
        if (!swapped) {
          Logger.debug(` RIGHT CORNER: NO corner-eligible unit found to swap!`);
        }
      } else {
        Logger.debug(` RIGHT CORNER: Last unit ${unitsToPlace[lastIdx]} is ALREADY corner-eligible, no swap needed`);
      }
    }

    Logger.debug(` After corner swap:`, unitsToPlace);
  }

  // If this is a facade corner segment and we STILL don't have a corner-eligible unit
  // at the facade edge, force-upgrade that edge unit to a corner-eligible type.
  // This should be rare after distribution + swap, but it prevents “Studio at the corner”
  // regressions across strategies.
  if (isLeftCorner && unitsToPlace.length > 0 && !isCornerEligible(unitsToPlace[0], config)) {
    // Sort candidates by size (Smallest -> Largest) to minimize mix impact
    const candidates = ([UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio] as UnitType[])
      .filter(t => isCornerEligible(t, config))
      .sort((a, b) => config[a].area - config[b].area);

    // Try to find a candidate that fits the available space (roughly)
    // Use target width for the first unit since calculatedWidths isn't computed yet
    const currentW = getUnitWidth(unitsToPlace[0], config, rentableDepth);
    
    let bestCandidate: UnitType | null = null;

    for (const cand of candidates) {
        const candW = getUnitWidth(cand, config, rentableDepth);
        // Allow it if it fits or is within 10% of the space
        if (candW <= currentW * 1.1) {
            bestCandidate = cand;
            // If we found the smallest one that fits, take it
            break; 
        }
    }

    // If nothing fit well, just take the smallest corner-eligible unit (better than taking the largest!)
    if (!bestCandidate && candidates.length > 0) {
        bestCandidate = candidates[0]; 
    }

    if (bestCandidate) {
      Logger.debug(` Force-upgrading corner unit from ${unitsToPlace[0]} to ${bestCandidate}`);
      unitsToPlace[0] = bestCandidate;
    }
  }

  if (isRightCorner && unitsToPlace.length > 0 && !isCornerEligible(unitsToPlace[unitsToPlace.length - 1], config)) {
    const lastIdx = unitsToPlace.length - 1;
    
    // Sort candidates by size (Smallest -> Largest)
    const candidates = ([UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio] as UnitType[])
      .filter(t => isCornerEligible(t, config))
      .sort((a, b) => config[a].area - config[b].area);

    // Use target width since calculatedWidths isn't computed yet
    const currentW = getUnitWidth(unitsToPlace[lastIdx], config, rentableDepth);
    
    let bestCandidate: UnitType | null = null;
    
    for (const cand of candidates) {
        const candW = getUnitWidth(cand, config, rentableDepth);
        if (candW <= currentW * 1.1) {
            bestCandidate = cand;
            break;
        }
    }

    if (!bestCandidate && candidates.length > 0) {
        bestCandidate = candidates[0];
    }

    if (bestCandidate) {
      Logger.debug(` Force-upgrading corner unit from ${unitsToPlace[lastIdx]} to ${bestCandidate}`);
      unitsToPlace[lastIdx] = bestCandidate;
    }
  }

  // --- WEIGHTED GEOMETRY GENERATION ---
  const endBonusWidth = endBonusArea / rentableDepth;
  const bonusIdx = bonusOnFirstUnit ? 0 : unitsToPlace.length - 1;

  const idealWidthSum = unitsToPlace.reduce((sum, type, idx) => {
    let w = getUnitWidth(type, config, rentableDepth);
    if (idx === bonusIdx && endBonusWidth > 0) {
      w = Math.max(1, w - endBonusWidth);
    }
    return sum + w;
  }, 0);

  const effectiveLength = segmentLength - extraWidth;
  const totalDiff = effectiveLength - idealWidthSum;
  const isCompression = totalDiff < 0;

  // CRITICAL: Use expansion weights ONLY - compression is NOT allowed
  // Target size is the ABSOLUTE MINIMUM - units can only expand, never shrink
  const weightFn = getFlexibilityWeight; // Always use expansion weights

  // Calculate target widths (MINIMUM), max widths, and weights for each unit
  const unitData = unitsToPlace.map((type, idx) => {
    let targetW = getUnitWidth(type, config, rentableDepth);
    if (idx === bonusIdx && endBonusWidth > 0) {
      targetW = Math.max(1, targetW - endBonusWidth);
    }
    const maxW = getMaxUnitWidth(type, config, rentableDepth);
    const minW = targetW; // Target width is the ABSOLUTE MINIMUM - no compression
    const weight = weightFn(type);
    return { type, targetW, maxW, minW, weight, width: targetW };
  });

  // ITERATIVE WIDTH DISTRIBUTION WITH MAX CAPS
  // Distribute ONLY expansion (positive difference) while respecting maximum widths
  // If totalDiff < 0 (compression needed), leave the gap instead of shrinking units
  let remainingDiff = isCompression ? 0 : totalDiff; // NO COMPRESSION - start at 0 if negative
  const capped = new Set<number>(); // Track units that have hit their max

  if (isCompression) {
    Logger.debug(` Segment has ${Math.abs(totalDiff).toFixed(2)}m COMPRESSION needed - leaving as gap (target sizes are MINIMUM)`);
  }

  // Multiple passes to handle capping and redistribution (expansion only)
  for (let pass = 0; pass < 5 && remainingDiff > 0.01; pass++) {
    // Calculate total weight of uncapped units
    let uncappedWeight = 0;
    unitData.forEach((u, idx) => {
      if (!capped.has(idx)) uncappedWeight += u.weight;
    });

    if (uncappedWeight <= 0) break;

    // Distribute remaining expansion to uncapped units
    unitData.forEach((u, idx) => {
      if (capped.has(idx)) return;

      const share = u.weight / uncappedWeight;
      const adjustment = remainingDiff * share;
      const proposedWidth = u.width + adjustment;

      if (proposedWidth > u.maxW) {
        // Would exceed max - cap it and mark as capped
        const actualAdjustment = u.maxW - u.width;
        u.width = u.maxW;
        remainingDiff -= actualAdjustment;
        capped.add(idx);
      } else {
        // Apply expansion (never shrink below minW)
        u.width = Math.max(u.minW, proposedWidth);
        remainingDiff -= adjustment;
      }
    });
  }

  // If there's still remaining space after all units hit their max, we DO NOT force “huge units”.
  // Leaving a small gap is preferable; the global count solver is responsible for adding units
  // when there is enough width for another unit at target size.

  const calculatedWidths = unitData.map(u => u.width);

  const nonFiniteCalculatedWidths = calculatedWidths.filter(w => !Number.isFinite(w));
  if (nonFiniteCalculatedWidths.length > 0) {
    Logger.warn(` generateUnitSegment: ${nonFiniteCalculatedWidths.length} non-finite calculated widths in segment at x=${startX.toFixed(2)}`);
  }

  // Final adjustment: ensure total matches effectiveLength exactly
  const currentSum = calculatedWidths.reduce((a, b) => a + b, 0);
  const roundingError = effectiveLength - currentSum;

  // Give rounding error to the largest unit type (not just most flexible)
  let largestIdx = 0;
  let largestArea = 0;
  unitsToPlace.forEach((type, idx) => {
    const area = config[type].area;
    if (area > largestArea) {
      largestArea = area;
      largestIdx = idx;
    }
  });

  calculatedWidths[largestIdx] += roundingError;

  // PRE-CHECK: Calculate total minimum widths to detect overflow
  const totalMinWidth = unitsToPlace.reduce((sum, type) => sum + getUnitWidth(type, config, rentableDepth), 0);
  const totalAvailableWidth = effectiveLength + extraWidth;

  if (totalMinWidth > totalAvailableWidth + 0.1) {
    Logger.warn(` Segment overflow detected! Total min width (${totalMinWidth.toFixed(2)}m) > available (${totalAvailableWidth.toFixed(2)}m). Removing ${unitsToPlace.length > 1 ? 'last unit' : 'no units'}.`);
    // Remove units until they fit, but NEVER drop the facade-corner unit:
    // - left corner: protect index 0
    // - right corner: protect last index
    const protectedIdx = (isRightCorner && !isLeftCorner) ? (unitsToPlace.length - 1)
                      : (isLeftCorner && !isRightCorner) ? 0
                      : -1;

    const minSum = (arr: UnitType[]) => arr.reduce((sum, t) => sum + getUnitWidth(t, config, rentableDepth), 0);

    while (unitsToPlace.length > 1) {
      const currentMin = minSum(unitsToPlace);
      if (currentMin <= totalAvailableWidth + 0.1) break;

      // Choose a removal index that isn't protected. Prefer removing non-corner-eligible units first.
      let removeIdx = -1;
      for (let i = unitsToPlace.length - 1; i >= 0; i--) {
        if (i === protectedIdx) continue;
        if (!isCornerEligible(unitsToPlace[i], config)) { removeIdx = i; break; }
      }
      if (removeIdx === -1) {
        // Fallback: remove the last non-protected index
        for (let i = unitsToPlace.length - 1; i >= 0; i--) {
          if (i !== protectedIdx) { removeIdx = i; break; }
        }
      }
      if (removeIdx === -1) break;

      const removed = unitsToPlace.splice(removeIdx, 1)[0];
      Logger.debug(` Removed ${removed} (idx=${removeIdx}${removeIdx === protectedIdx ? ',PROTECTED' : ''}) to prevent overflow.`);
    }
  }

  // Generate blocks - RESPECTING MIN AND MAX WIDTH CONSTRAINTS
  // CRITICAL: Target width is the ABSOLUTE MINIMUM - units can never be smaller
  const units: InternalUnitBlock[] = [];
  let currentX = startX;

  // Calculate final widths with min/max constraints enforced
  const finalWidths: number[] = [];
  let totalAssigned = 0;

  // Debug: Log segment geometry info
  const totalAvailableWidthDbg = effectiveLength + extraWidth;
  Logger.debug(` generateUnitSegment: segmentLength=${segmentLength.toFixed(2)}m, effectiveLength=${effectiveLength.toFixed(2)}m, extraWidth=${extraWidth.toFixed(2)}m, totalAvailable=${totalAvailableWidthDbg.toFixed(2)}m`);
  Logger.debug(` generateUnitSegment: ${totalUnits} units to place: ${unitsToPlace.join(', ')}`);
  Logger.debug(` generateUnitSegment: calculatedWidths: ${calculatedWidths.map(w => w.toFixed(2)).join(', ')}`);
  Logger.debug(` generateUnitSegment: isCorner=${isCorner}, isLeftCorner=${isLeftCorner}, isRightCorner=${isRightCorner}`);

  for (let index = 0; index < unitsToPlace.length; index++) {
    const type = unitsToPlace[index];
    const targetW = getUnitWidth(type, config, rentableDepth); // MINIMUM width
    const maxW = getMaxUnitWidth(type, config, rentableDepth);
    let width = calculatedWidths[index] ?? targetW; // Use target if index doesn't exist (after removal)

    // For the last unit, calculate what's left
    if (index === unitsToPlace.length - 1) {
      const remainingSpace = totalAvailableWidth - totalAssigned;
      width = Math.min(Math.max(targetW, remainingSpace), totalAvailableWidth - totalAssigned);
      
      // AUTO-SPLIT HUGE UNITS: If the last unit is huge, split it!
      // This prevents "2000sf 3BR" monsters when geometry leaves a large gap.
      // We insert a new unit (Studio or 1BR) to absorb the excess.
      // EXCEPTION: Never split a corner-eligible unit at the right facade edge —
      // a wide premium corner unit is always better than a Studio at the building corner.
      const threshold = targetW * 1.3;
      const isRightFacadeUnit = isRightCorner && !isLeftCorner && isCornerEligible(type, config);
      if (width > threshold && !isRightFacadeUnit) {
        const excess = width - targetW;
        const studioW = getUnitWidth(UnitType.Studio, config, rentableDepth);
        
        // Only split if the excess is useful (at least a small studio)
        if (excess >= studioW * 0.85) {
          Logger.debug(` Auto-splitting huge unit ${type} (w=${width.toFixed(2)}m). Inserting Studio to absorb ${excess.toFixed(2)}m.`);
          
          // Shrink current unit to target
          width = targetW;
          
          // Insert new unit at end
          const newType = UnitType.Studio;
          const newW = excess;
          
          // Add to lists so loop continues correctly
          unitsToPlace.push(newType);
          calculatedWidths.push(newW); // Use explicit width
          // Note: we don't need to update totalAssigned here, loop handles next iteration
        }
      }

      if (width < targetW * 0.9) {
        // Remaining space is way too small - just use what we have
        width = Math.max(MIN_UNIT_WIDTH, remainingSpace);
        Logger.warn(` Last unit ${type} truncated to ${width.toFixed(2)}m (target: ${targetW.toFixed(2)}m)`);
      }
    }

    // ENFORCE MINIMUM WIDTH - target size is the ABSOLUTE FLOOR (unless overflow case)
    // No unit can ever be smaller than its target width in normal operation
    if (width < targetW && index < unitsToPlace.length - 1) {
      Logger.debug(` Enforcing MIN width for ${type}: ${width.toFixed(2)}m -> ${targetW.toFixed(2)}m`);
      width = targetW;
    }

    // Enforce max width for ALL types (including the largest).
    // This implements the “no huge units” rule: large units should not absorb unbounded excess.
    if (width > maxW) width = maxW;

    finalWidths.push(width);
    totalAssigned += width;
  }

  // FILL LEFTOVER SPACE: Distribute any remaining gap to units (prioritize space utilization)
  const totalFinalWidthDbg = finalWidths.reduce((a, b) => a + b, 0);
  const remainingGap = totalAvailableWidthDbg - totalFinalWidthDbg;
  
  if (remainingGap > 0.1) {
    // Distribute leftover space to units, prioritizing larger/more flexible units
    const sortedByFlexibility = unitsToPlace.map((type, idx) => ({
      idx,
      type,
      flex: getFlexibilityWeight(type),
      currentWidth: finalWidths[idx]
    })).sort((a, b) => b.flex - a.flex);
    
    let gapToDistribute = remainingGap;
    for (const { idx, type, currentWidth } of sortedByFlexibility) {
      if (gapToDistribute <= 0.01) break;
      const maxW = getMaxUnitWidth(type, config, rentableDepth);
      const canTake = Math.min(gapToDistribute, maxW - currentWidth);
      if (canTake > 0.01) {
        finalWidths[idx] += canTake;
        gapToDistribute -= canTake;
      }
    }
    
    // If there's still gap left, give it to the last unit (even if it exceeds max slightly)
    if (gapToDistribute > 0.01 && unitsToPlace.length > 0) {
      const lastIdx = unitsToPlace.length - 1;
      finalWidths[lastIdx] += gapToDistribute;
    }
  }

  // Debug: Final widths before creating units
  const finalTotalWidth = finalWidths.reduce((a, b) => a + b, 0);
  Logger.debug(` generateUnitSegment FINAL: totalFinalWidth=${finalTotalWidth.toFixed(2)}m, segmentLength=${segmentLength.toFixed(2)}m, gap=${(segmentLength - finalTotalWidth).toFixed(2)}m`);
  finalWidths.forEach((w, i) => {
    Logger.debug(`   Unit ${i} (${unitsToPlace[i]}): width=${w.toFixed(2)}m`);
  });

  const nonFiniteFinalWidths = finalWidths.filter(w => !Number.isFinite(w));
  if (nonFiniteFinalWidths.length > 0) {
    Logger.warn(` generateUnitSegment: ${nonFiniteFinalWidths.length} non-finite final widths in segment at x=${startX.toFixed(2)}`);
  }

  // Now create the unit blocks
  unitsToPlace.forEach((type, index) => {
    const finalWidth = finalWidths[index];

    let areaBonus = 0;
    if (bonusOnFirstUnit ? index === 0 : index === unitsToPlace.length - 1) {
      areaBonus = endBonusArea;
    }

    units.push({
      id: `unit-${startX.toFixed(2)}-${y.toFixed(2)}-${index}`,
      type,
      typeId: type,           // Use enum value as typeId for backwards compat
      typeName: type,         // Use enum value as display name for backwards compat
      x: currentX,
      y,
      width: finalWidth,
      depth: rentableDepth,
      area: (finalWidth * rentableDepth) + areaBonus,
      color: getUnitColor(type, customColors)
    });
    currentX += finalWidth;
  });

  return units;
};

// ============================================================================
// GEOMETRY OPTIMIZATION
// Finds optimal corner length and mid-core offset
// ============================================================================

const findOptimalGeometry = (
  ctx: OptimizationSearchContext,
  config: UnitConfiguration,
  rentableDepth: number
): { cornerLen: number, midCoreOffset: number } => {
  // Destructure context
  const { buildingGeometry, unitInventory: globalCounts, prioritizeCorners, deadEndLimit: _deadEndLimit } = ctx;
  const { availableRentableLength, numMidSpans, singleCoreBonusArea, isContinuousSide = false } = buildingGeometry;

  let bestCornerLen = 40 * FEET_TO_METERS; // ~12.2m default
  let bestOffset = 0;
  let minWeightedError = Number.MAX_VALUE;

  let minC = 20 * FEET_TO_METERS;

  // SOFT CONSTRAINT: Only cap corners if they would take >70% of building
  // This allows short buildings to have proper corners with large units
  const maxCornerFromBuildingLength = availableRentableLength * GEOMETRY_SEARCH.MAX_CORNER_FRACTION;

  if (prioritizeCorners) {
    // Find the LARGEST corner-eligible unit type in inventory
    // Corner segments should be sized to fit the LARGEST corner-eligible units (premium positions)
    // This ensures 3BR gets priority over 2BR at corners
    const types = [UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio];
    let largestCornerEligibleWidth = 0;
    let secondLargestCornerEligibleWidth = 0;

    for (const t of types as UnitType[]) {
      if (globalCounts[t] > 0 && isCornerEligible(t, config)) {
        const w = getUnitWidth(t, config, rentableDepth);
        if (w > largestCornerEligibleWidth) {
          secondLargestCornerEligibleWidth = largestCornerEligibleWidth;
          largestCornerEligibleWidth = w;
        } else if (w > secondLargestCornerEligibleWidth) {
          secondLargestCornerEligibleWidth = w;
        }
      }
    }

    // If we found a corner-eligible unit, set minimum corner length to fit it
    if (largestCornerEligibleWidth > 0) {
      // Always size corners to fit the largest corner-eligible unit
      minC = Math.max(minC, largestCornerEligibleWidth);
      Logger.debug(` findOptimalGeometry: largest corner-eligible width=${largestCornerEligibleWidth.toFixed(2)}m`);

      // ENSURE corners can fit at least 1 unit
      // This prevents corners with a single oversized unit - we want both ends to have large units
      // RELAXED: Removed the "at least 2 units" requirement which was forcing large corners and starving the middle.
      // Now we just ensure the corner fits the largest eligible unit.
      minC = Math.max(minC, largestCornerEligibleWidth); 
      Logger.debug(` findOptimalGeometry: ensuring 1+ units fit, minC=${minC.toFixed(2)}m`);

      // SOFT CAP: Only limit if corners would take >70% of building
      if (minC > maxCornerFromBuildingLength) {
        Logger.debug(` findOptimalGeometry: Soft-capping corner from ${minC.toFixed(2)}m to ${maxCornerFromBuildingLength.toFixed(2)}m (35% of ${availableRentableLength.toFixed(2)}m building)`);
        minC = maxCornerFromBuildingLength;
      }
    } else {
      // Fallback: use largest available unit
      for (const t of types as UnitType[]) {
        if (globalCounts[t] > 0) {
          const w = getUnitWidth(t, config, rentableDepth);
          minC = Math.max(minC, Math.floor(w * 0.9));
          break;
        }
      }
      Logger.debug(` findOptimalGeometry: no corner-eligible units in inventory, using fallback minC=${minC.toFixed(2)}m`);
    }
  }

  let maxC = Math.min(65 * FEET_TO_METERS, availableRentableLength / 2 - 15 * FEET_TO_METERS);
  if (maxC < minC) maxC = minC;
  const step = 2 * FEET_TO_METERS;

  for (let c = minC; c <= maxC; c += step > 0 ? step : 1) {
    if (c > maxC && c !== minC) break;

    const cornerLen = c;

    const offsets = [0];
    const totalMidLen = availableRentableLength - (2 * cornerLen);

    if (!isContinuousSide && numMidSpans === 2) {
      const maxDev = Math.min(30 * FEET_TO_METERS, Math.floor(totalMidLen * 0.15));
      for (let o = 4 * FEET_TO_METERS; o <= maxDev; o += 4 * FEET_TO_METERS) {
        offsets.push(o);
        offsets.push(-o);
      }
    }

    for (const offset of offsets) {
      const simSegments: { len: number, isCorner: boolean, bonusArea: number }[] = [];

      const leftBonus = isContinuousSide ? 0 : singleCoreBonusArea;
      simSegments.push({ len: cornerLen, isCorner: true, bonusArea: leftBonus });
      simSegments.push({ len: cornerLen, isCorner: true, bonusArea: leftBonus });

      if (isContinuousSide) {
        simSegments.push({ len: totalMidLen, isCorner: false, bonusArea: 0 });
      } else {
        if (numMidSpans === 1) {
          simSegments.push({ len: totalMidLen, isCorner: false, bonusArea: singleCoreBonusArea });
        } else {
          const half = totalMidLen / 2;
          simSegments.push({ len: half + offset, isCorner: false, bonusArea: singleCoreBonusArea });
          simSegments.push({ len: half - offset, isCorner: false, bonusArea: singleCoreBonusArea });
        }
      }

      const dist = distributeUnitsToSegments(globalCounts, simSegments, config, rentableDepth, true);

      let totalScore = 0;

      dist.forEach((counts, idx) => {
        const segLen = simSegments[idx].len;
        const bonusW = simSegments[idx].bonusArea / rentableDepth;

        let idealWidthSum = 0;
        let segmentFlexWeightSum = 0;

        ([UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed] as UnitType[]).forEach(t => {
          const count = counts[t];
          if (count > 0) {
            idealWidthSum += count * getUnitWidth(t, config, rentableDepth);
            segmentFlexWeightSum += count * getFlexibilityWeight(t);
          }
        });

        const diff = (segLen + bonusW) - idealWidthSum;
        const absDiff = Math.abs(diff);

        const isCompressionLocal = diff < -0.1;
        const penaltyMultiplier = isCompressionLocal ? 500 : 200; // Increased expansion penalty from 100 to 200 to reduce white space

        const capacity = Math.max(segmentFlexWeightSum, 0.1);
        const weightedPenalty = absDiff * (penaltyMultiplier / capacity);
        if (!isNaN(weightedPenalty)) {
            totalScore += weightedPenalty;
        } else {
            totalScore = Number.MAX_VALUE; // Treat NaN as infinite badness
        }
      });

      if (totalScore < minWeightedError && !isNaN(totalScore)) {
        minWeightedError = totalScore;
        bestCornerLen = cornerLen;
        bestOffset = offset;
      }
    }
  }

  // Fallback: if optimization failed (e.g. all scores NaN or MAX), use minC
  if (bestCornerLen === 40 * FEET_TO_METERS && minWeightedError === Number.MAX_VALUE) {
     Logger.warn(` findOptimalGeometry: Optimization loop failed to find valid score. Defaulting to minC=${minC.toFixed(2)}m`);
     bestCornerLen = minC;
  }

  return { cornerLen: bestCornerLen, midCoreOffset: bestOffset };
};

// ============================================================================
// WALL ALIGNMENT
// Aligns partition walls between north and south sides of the building.
// alignmentStrength (0.0-1.0) controls the maximum snap distance:
//   - 0.0 = no snapping (partitions remain independent)
//   - 0.5 = moderate snapping (up to 1.2m / 4ft)
//   - 1.0 = aggressive snapping (up to 2.4m / 8ft)
// Respects unit minimum width constraints - snaps are rejected if they would
// compress units below their allowed minimum widths.
// ============================================================================

const applyWallAlignment = (
  input: WallAlignmentInput,
  config: UnitConfiguration,
  rentableDepth: number
): InternalUnitBlock[] => {
  // Destructure input
  const { targetUnits, refUnits, alignmentStrength } = input;

  if (targetUnits.length === 0 || alignmentStrength <= 0) return targetUnits;

  // Collect ALL wall positions from reference units (both left and right edges)
  const snapTargets: number[] = [];
  refUnits.forEach(u => {
    snapTargets.push(u.x + u.width);
    snapTargets.push(u.x);
  });

  const uniqueTargets = Array.from(new Set(snapTargets.map(x => parseFloat(x.toFixed(3))))).sort((a, b) => a - b);

  const newUnits = targetUnits.map(u => ({ ...u }));

  // Search radius: 0m to 4m (0ft to 13ft) based on alignment strength
  const MAX_PULL = alignmentStrength * 4.0;
  const MIN_EPSILON = 0.01; // Ignore very small differences (already aligned)
  const TOLERANCE = 0.06;   // ~0.2ft tolerance for min width check

  // DETERMINISTIC ALIGNMENT: Process walls closest to targets first
  // Build a list of potential alignments with their distances
  interface AlignmentCandidate {
    unitIdx: number;
    targetX: number;
    distance: number;
  }

  const candidates: AlignmentCandidate[] = [];

  for (let i = 0; i < newUnits.length - 1; i++) {
    const unit = newUnits[i];
    const currentRightEdge = unit.x + unit.width;

    for (const t of uniqueTargets) {
      const diff = Math.abs(t - currentRightEdge);
      if (diff <= MAX_PULL && diff > MIN_EPSILON) {
        candidates.push({ unitIdx: i, targetX: t, distance: diff });
      }
    }
  }

  // Sort by distance (closest alignments first) for deterministic, greedy alignment
  candidates.sort((a, b) => a.distance - b.distance);

  // Track which units have been modified to avoid double-adjustments
  const modifiedUnits = new Set<number>();

  for (const candidate of candidates) {
    const { unitIdx, targetX } = candidate;

    // Skip if either this unit or the next has already been modified
    if (modifiedUnits.has(unitIdx) || modifiedUnits.has(unitIdx + 1)) continue;

    const unit = newUnits[unitIdx];
    const nextUnit = newUnits[unitIdx + 1];

    const proposedRightEdge = targetX;
    const proposedWidth = proposedRightEdge - unit.x;
    const nextUnitRightEdge = nextUnit.x + nextUnit.width;
    const proposedNextWidth = nextUnitRightEdge - proposedRightEdge;

    // --- CONSTRAINTS CHECK ---
    // At higher alignment, allow more unit compression to achieve alignment
    const alignmentBoost = alignmentStrength * 0.15; // Extra 15% flex at strict alignment
    const unitFlex = getFlexibilityFactor(unit.type) + alignmentBoost;
    const nextUnitFlex = getFlexibilityFactor(nextUnit.type) + alignmentBoost;

    const unitMinW = getUnitWidth(unit.type, config, rentableDepth) * (1.0 - unitFlex);
    const nextUnitMinW = getUnitWidth(nextUnit.type, config, rentableDepth) * (1.0 - nextUnitFlex);

    // Both units must maintain minimum widths
    // Ensure math doesn't produce NaNs
    if (!isNaN(proposedWidth) && !isNaN(proposedNextWidth) && 
        proposedWidth >= unitMinW - TOLERANCE && proposedNextWidth >= nextUnitMinW - TOLERANCE) {
      // Apply alignment
      unit.width = proposedWidth;
      unit.area = unit.width * unit.depth;

      nextUnit.x = proposedRightEdge;
      nextUnit.width = proposedNextWidth;
      nextUnit.area = nextUnit.width * nextUnit.depth;

      // Mark both units as modified
      modifiedUnits.add(unitIdx);
      modifiedUnits.add(unitIdx + 1);
    } else if (isNaN(proposedWidth) || isNaN(proposedNextWidth)) {
        Logger.warn(` applyWallAlignment: NaN detected! targetX=${targetX}, unit.x=${unit.x}, nextUnit.width=${nextUnit.width}`);
    }
  }

  return newUnits;
};

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Generates a single floorplate layout for a building footprint.
 *
 * The algorithm places units along both sides of a central corridor,
 * automatically adding cores (elevator/stair cores) to meet egress requirements.
 * Units are sized and positioned to match the target unit mix while respecting
 * minimum and maximum width constraints.
 *
 * **Algorithm overview:**
 * 1. Determines core count based on building length and travel distance limits
 * 2. Calculates global unit counts to hit target percentages
 * 3. Distributes units across segments (spaces between cores)
 * 4. Applies wall alignment constraints between north and south sides
 * 5. Ensures corner-eligible units are placed at building corners
 *
 * @param footprint - Building footprint extracted from Forma geometry. Contains
 *                    dimensions (width, depth), rotation angle, and world position.
 * @param config - Unit configuration specifying percentage and area for each type.
 *                 Areas are in square meters. Percentages should sum to 100.
 * @param egressConfig - Fire code requirements including dead-end limits,
 *                       travel distance maximums, and common path limits.
 * @param corridorWidth - Central corridor width in meters. Default ~1.83m (6 ft).
 * @param coreWidth - Width of stair/elevator cores in meters. Default ~3.66m (12 ft).
 * @param coreDepth - Depth of cores perpendicular to corridor. Default ~9m (29.5 ft).
 * @param coreSide - Which side of corridor to place cores: 'North' or 'South'.
 * @param alignment - Wall alignment strength from 0.0 to 1.0:
 *                    - 0.0 = flexible (walls can offset freely between sides)
 *                    - 1.0 = strict (walls must align across corridor)
 * @param strategy - Optimization strategy affecting unit sizing priorities:
 *                   - 'balanced': Equal priority to mix accuracy and efficiency
 *                   - 'mixOptimized': Prioritizes hitting exact mix percentages
 *                   - 'efficiencyOptimized': Maximizes NRSF/GSF ratio
 * @returns Complete floorplan data including units, cores, corridor, transform
 *          data for rendering, and statistics (GSF, NRSF, efficiency).
 *
 * @example
 * ```typescript
 * const footprint = extractFootprintFromTriangles(triangles);
 * const floorplan = generateFloorplate(
 *   footprint,
 *   {
 *     [UnitType.Studio]: { percentage: 20, area: 51, cornerEligible: false },
 *     [UnitType.OneBed]: { percentage: 40, area: 82, cornerEligible: false },
 *     [UnitType.TwoBed]: { percentage: 30, area: 110, cornerEligible: true },
 *     [UnitType.ThreeBed]: { percentage: 10, area: 137, cornerEligible: true }
 *   },
 *   EGRESS_SPRINKLERED,
 *   1.83,  // corridor width
 *   3.66,  // core width
 *   9.0,   // core depth
 *   'North',
 *   0.5,   // moderate alignment
 *   'balanced'
 * );
 * ```
 */
export function generateFloorplate(
  footprint: BuildingFootprint,
  config: UnitConfiguration,
  egressConfig: EgressConfig,
  corridorWidth: number = DEFAULT_CORRIDOR_WIDTH,
  coreWidth: number = DEFAULT_CORE_WIDTH,
  coreDepth: number = DEFAULT_CORE_DEPTH,
  coreSide: 'North' | 'South' = 'North',
  alignment: number = 0.5,
  strategy: OptimizationStrategy = 'balanced',
  customColors?: UnitColorMap
): FloorPlanData {
  // VERSION MARKER - if you see this, new code is loaded!
  Logger.info('GENERATOR v2025.01.13.F - CORNER ENFORCEMENT + SPACE UTILIZATION + ALIGNMENT FIXES');

  const cores: CoreBlock[] = [];
  const length = footprint.width;
  const buildingDepth = footprint.depth;

  // Derive geometric constraints
  const rentableDepth = (buildingDepth - corridorWidth) / 2;

  // Calculate potential bonus area per core wrap
  const gapHeight = rentableDepth - coreDepth;
  const singleCoreBonusArea = gapHeight > 0.1 ? (gapHeight * coreWidth) : 0;

  // --- 1. Core Count Determination ---
  const limit = (egressConfig.travelDistanceLimit && egressConfig.travelDistanceLimit > 0)
                  ? egressConfig.travelDistanceLimit
                  : 250 * FEET_TO_METERS;

  const minFeasibleCorner = 20 * FEET_TO_METERS;
  const worstCaseGap2Cores = length - (2 * minFeasibleCorner) - (2 * coreWidth);
  const worstCaseTravel2Cores = worstCaseGap2Cores / 2;

  const needsMidCore = worstCaseTravel2Cores > limit;
  const hasMidCore = needsMidCore;

  const numCores = hasMidCore ? 3 : 2;
  const totalCoreWidth = numCores * coreWidth;
  const availableRentableLengthCoreSide = length - totalCoreWidth;
  const availableRentableLengthClearSide = length;

  const numMidSpans = hasMidCore ? 2 : 1;
  const totalSpansCoreSide = numMidSpans + 2;

  const coreSideTotalBonusArea = (1 + numMidSpans) * singleCoreBonusArea;

  // STRICT ALIGNMENT: When alignment is strict (>0.6), we mirror the core side.
  // We define this early to condition the mix bias.
  const snapToCore = alignment > 0.6;

  // --- 2. Calculate BUILDING-WIDE unit counts first ---
  // This ensures consistent unit counts are used for BOTH geometry optimization AND unit placement
  // Prevents the issue where geometry is optimized for 2 3BRs but only 1 is placed
  const earlyBuildingCountsRaw = calculateBuildingUnitCounts(
    availableRentableLengthCoreSide,  // Core side (North or South depending on coreSide)
    availableRentableLengthClearSide, // Clear side
    coreSideTotalBonusArea,
    0, // No bonus for clear side
    totalSpansCoreSide,
    3, // Clear side always has 3 segments (left corner, mid, right corner)
    config,
    rentableDepth,
    strategy,
    snapToCore // isMirrored
  );

  // Apply a core-side bias (studios vs 1BR) to compensate for the core footprint.
  // This preserves building-wide totals while nudging the side with cores toward smaller units.
  // CRITICAL: Only apply bias if NOT using strict alignment (mirroring).
  // If strict alignment is ON, we mirror the core side to the clear side.
  // If we bias the core side (more studios) and then mirror it, we DOUBLE the bias (too many studios globally).
  // const snapToCore = alignment > 0.6; // Defined above
  const earlyBuildingCounts = snapToCore 
    ? earlyBuildingCountsRaw 
    : applyCoreSideMixBias(earlyBuildingCountsRaw, coreSide, numCores);

  // Use the split counts for each side's geometry optimization
  const coreSideCounts = coreSide === 'North' ? earlyBuildingCounts.north : earlyBuildingCounts.south;
  const clearSideCounts = coreSide === 'North' ? earlyBuildingCounts.south : earlyBuildingCounts.north;

  // --- 3. Optimization for Core Side ---
  const { cornerLen: coreSideCornerLen, midCoreOffset } = findOptimalGeometry({
    buildingGeometry: {
      availableRentableLength: availableRentableLengthCoreSide,
      numMidSpans,
      singleCoreBonusArea,
      isContinuousSide: false
    },
    unitInventory: coreSideCounts,
    prioritizeCorners: true,
    deadEndLimit: egressConfig.deadEndLimit
  }, config, rentableDepth);

  // --- 4. Optimization for Clear Side ---
  const { cornerLen: clearSideCornerLenIndependent } = findOptimalGeometry({
    buildingGeometry: {
      availableRentableLength: availableRentableLengthClearSide,
      numMidSpans: 1,
      singleCoreBonusArea: 0,
      isContinuousSide: true
    },
    unitInventory: clearSideCounts,
    prioritizeCorners: true,
    deadEndLimit: egressConfig.deadEndLimit
  }, config, rentableDepth);

  // STRICT ALIGNMENT: When alignment is strict (>0.6), use the same geometry as core side
  // This ensures partition walls align between clear side and core side
  // (snapToCore defined at top of function)
  const finalClearSideCornerLen = snapToCore ? coreSideCornerLen : clearSideCornerLenIndependent;
  
  // When alignment is strict, also ensure the clear side uses the same segment structure
  // This means the clear side should have the same corner lengths and mid segment structure
  if (snapToCore) {
    Logger.debug(` STRICT ALIGNMENT: Clear side using core side geometry (cornerLen=${coreSideCornerLen.toFixed(2)}m)`);
  }

  // --- 4. Geometry Construction ---
  const totalMidLen = availableRentableLengthCoreSide - (2 * coreSideCornerLen);

  let midSpan1 = 0;
  let midSpan2 = 0;

  if (hasMidCore) {
    midSpan1 = (totalMidLen / 2) + midCoreOffset;
    midSpan2 = (totalMidLen / 2) - midCoreOffset;
  } else {
    midSpan1 = totalMidLen;
  }

  const leftCoreStart = coreSideCornerLen;
  const leftCoreEnd = leftCoreStart + coreWidth;

  let midCoreStart = 0;
  let midCoreEnd = 0;
  if (hasMidCore) {
    midCoreStart = leftCoreEnd + midSpan1;
    midCoreEnd = midCoreStart + coreWidth;
  }
  const rightCoreStart = length - coreSideCornerLen - coreWidth;

  // --- 5. Generate Cores ---
  const addCore = (x: number, idSuffix: string, type: 'End' | 'Mid') => {
    const y = coreSide === 'North' ? (rentableDepth - coreDepth) : (rentableDepth + corridorWidth);
    cores.push({
      id: `core-${idSuffix}`,
      x,
      y,
      width: coreWidth,
      depth: coreDepth,
      type,
      side: coreSide
    });
  };

  addCore(leftCoreStart, 'left', 'End');
  addCore(rightCoreStart, 'right', 'End');
  if (hasMidCore) {
    addCore(midCoreStart, 'mid', 'Mid');
  }

  // --- 6. Define Unit Segments ---
  interface SegmentDef {
    x: number;
    len: number;
    isSouth: boolean;
    pattern: PatternStrategy;
    isCorner: boolean;
    extraWidth: number;
    bonusArea: number;
  }
  const northSegments: SegmentDef[] = [];
  const southSegments: SegmentDef[] = [];

  // Strategy-dependent pattern selection for visual variety:
  // - balanced: valley patterns (smooth transitions, predictable)
  // - mixOptimized: desc/asc patterns (spreads unit types evenly)
  // - efficiencyOptimized: random patterns (maximizes space utilization)
  let leftCornerPattern: PatternStrategy;
  let midPattern: PatternStrategy;
  let rightCornerPattern: PatternStrategy;

  switch (strategy) {
    case 'mixOptimized':
      leftCornerPattern = 'desc';
      midPattern = 'asc';
      rightCornerPattern = 'desc';
      break;
    case 'efficiencyOptimized':
      leftCornerPattern = 'valley-inverted';
      midPattern = 'random';
      rightCornerPattern = 'valley';
      break;
    case 'balanced':
    default:
      leftCornerPattern = 'valley';
      midPattern = 'valley';
      rightCornerPattern = 'valley-inverted';
      break;
  }

  const generateCoreSideSegments = (isSouth: boolean): SegmentDef[] => {
    const segs: SegmentDef[] = [];
    segs.push({ x: 0, len: leftCoreStart, isSouth, pattern: leftCornerPattern, isCorner: true, extraWidth: 0, bonusArea: singleCoreBonusArea });

    if (!hasMidCore) {
      segs.push({ x: leftCoreEnd, len: midSpan1, isSouth, pattern: midPattern, isCorner: false, extraWidth: 0, bonusArea: singleCoreBonusArea });
    } else {
      segs.push({ x: leftCoreEnd, len: midSpan1, isSouth, pattern: midPattern, isCorner: false, extraWidth: 0, bonusArea: singleCoreBonusArea });
      segs.push({ x: midCoreEnd, len: midSpan2, isSouth, pattern: midPattern, isCorner: false, extraWidth: 0, bonusArea: singleCoreBonusArea });
    }

    segs.push({ x: rightCoreStart + coreWidth, len: length - (rightCoreStart + coreWidth), isSouth, pattern: rightCornerPattern, isCorner: true, extraWidth: 0, bonusArea: singleCoreBonusArea });
    return segs;
  };

  const generateClearSideSegments = (isSouth: boolean): SegmentDef[] => {
    const segs: SegmentDef[] = [];
    
    // When alignment is strict, use the same segment structure as core side for better alignment
    if (snapToCore && hasMidCore) {
      // Match core side structure: left corner, mid span 1, mid span 2, right corner
      const totalMidLen = length - (2 * finalClearSideCornerLen);
      const midSpan1 = (totalMidLen / 2) + midCoreOffset;
      const midSpan2 = (totalMidLen / 2) - midCoreOffset;
      
      segs.push({ x: 0, len: finalClearSideCornerLen, isSouth, pattern: leftCornerPattern, isCorner: true, extraWidth: 0, bonusArea: 0 });
      segs.push({ x: finalClearSideCornerLen, len: midSpan1, isSouth, pattern: midPattern, isCorner: false, extraWidth: 0, bonusArea: 0 });
      segs.push({ x: finalClearSideCornerLen + midSpan1, len: midSpan2, isSouth, pattern: midPattern, isCorner: false, extraWidth: 0, bonusArea: 0 });
      segs.push({ x: length - finalClearSideCornerLen, len: finalClearSideCornerLen, isSouth, pattern: rightCornerPattern, isCorner: true, extraWidth: 0, bonusArea: 0 });
    } else {
      // Standard 3-segment structure for clear side
      const midLen = length - (2 * finalClearSideCornerLen);
      const midPat = alignment < 0.2 ? 'random' : 'valley-inverted';

      segs.push({ x: 0, len: finalClearSideCornerLen, isSouth, pattern: leftCornerPattern, isCorner: true, extraWidth: 0, bonusArea: 0 });
      segs.push({ x: finalClearSideCornerLen, len: midLen, isSouth, pattern: midPat, isCorner: false, extraWidth: 0, bonusArea: 0 });
      segs.push({ x: length - finalClearSideCornerLen, len: finalClearSideCornerLen, isSouth, pattern: rightCornerPattern, isCorner: true, extraWidth: 0, bonusArea: 0 });
    }
    return segs;
  };

  if (coreSide === 'North') {
    northSegments.push(...generateCoreSideSegments(false));
    southSegments.push(...generateClearSideSegments(true));
  } else {
    northSegments.push(...generateClearSideSegments(false));
    southSegments.push(...generateCoreSideSegments(true));
  }

  // --- 7. Distribution ---
  // REUSE the building-wide counts calculated earlier for geometry optimization
  // This ensures consistency: same counts for geometry AND placement
  const northGlobal = earlyBuildingCounts.north;
  const southGlobal = earlyBuildingCounts.south;

  Logger.debug(` Using pre-calculated building counts - North: S=${northGlobal[UnitType.Studio]}, 1BR=${northGlobal[UnitType.OneBed]}, 2BR=${northGlobal[UnitType.TwoBed]}, 3BR=${northGlobal[UnitType.ThreeBed]}`);
  Logger.debug(` Using pre-calculated building counts - South: S=${southGlobal[UnitType.Studio]}, 1BR=${southGlobal[UnitType.OneBed]}, 2BR=${southGlobal[UnitType.TwoBed]}, 3BR=${southGlobal[UnitType.ThreeBed]}`);

  const northCounts = distributeUnitsToSegments(
    northGlobal,
    northSegments.map(s => ({ len: s.len, isCorner: s.isCorner, bonusArea: s.bonusArea })),
    config,
    rentableDepth,
    true
  );

  const southCounts = distributeUnitsToSegments(
    southGlobal,
    southSegments.map(s => ({ len: s.len, isCorner: s.isCorner, bonusArea: s.bonusArea })),
    config,
    rentableDepth,
    true
  );

    // --- 7B. MIRRORED CORNER PLACEMENT (3BR STACKING) ---
    {
    // Explicitly enforce 3BR stacking: if one side has a 3BR corner, the other side MUST match it if possible.
    // CRITICAL: Only pull 3BRs from MID segments — never steal from another corner segment,
    // as that would degrade one corner to fix another.
    const stackCorner = (sideA: Record<UnitType, number>[], sideB: Record<UnitType, number>[], cornerIdx: number) => {
      const segA = sideA[cornerIdx];
      const segB = sideB[cornerIdx];
      const sideBCornerIndices = new Set([0, sideB.length - 1]);
      
      const has3BR_A = segA[UnitType.ThreeBed] > 0;
      const has3BR_B = segB[UnitType.ThreeBed] > 0;
      
      if (has3BR_A && !has3BR_B) {
        // Only search MID segments (not other corners) for a 3BR to move here
        const donorIdx = sideB.findIndex((c, i) => i !== cornerIdx && !sideBCornerIndices.has(i) && c[UnitType.ThreeBed] > 0);
        if (donorIdx !== -1) {
          sideB[donorIdx][UnitType.ThreeBed]--;
          sideB[cornerIdx][UnitType.ThreeBed]++;
          
          const swapType = segB[UnitType.TwoBed] > 0 ? UnitType.TwoBed : 
                           segB[UnitType.OneBed] > 0 ? UnitType.OneBed : 
                           UnitType.Studio;
                           
          if (segB[swapType] > 0) {
             segB[swapType]--;
             sideB[donorIdx][swapType]++;
             Logger.debug(` STACKING: Moved 3BR from MID segment ${donorIdx} to corner ${cornerIdx} (swapped ${swapType})`);
          } else {
             Logger.debug(` STACKING: Moved 3BR from MID segment ${donorIdx} to corner ${cornerIdx} (no swap back)`);
          }
        }
      }
    };

    // Stack LEFT corners
    stackCorner(northCounts, southCounts, 0); // Try to match South to North
    stackCorner(southCounts, northCounts, 0); // Try to match North to South

    // Stack RIGHT corners
    const northRightIdx = northCounts.length - 1;
    const southRightIdx = southCounts.length - 1;
    stackCorner(northCounts, southCounts, northRightIdx);
    stackCorner(southCounts, northCounts, southRightIdx);
  }

  const allSegments = [...northSegments, ...southSegments];
  const segmentCountsList = [...northCounts, ...southCounts];

  // --- 8. Generate Units ---
  let units: InternalUnitBlock[] = [];

  Logger.debug(` Building length=${length.toFixed(2)}`);

  allSegments.forEach((seg, idx) => {
    const counts = segmentCountsList[idx];
    const y = seg.isSouth ? (rentableDepth + corridorWidth) : 0;

    // Determine if this is a building corner segment
    const isLeftCorner = seg.isCorner && seg.x === 0;
    const isRightCorner = seg.isCorner && (seg.x + seg.len) >= (length - 0.5);

    Logger.debug(` Segment ${idx}: x=${seg.x.toFixed(2)}, len=${seg.len.toFixed(2)}, isCorner=${seg.isCorner}, isLeft=${isLeftCorner}, isRight=${isRightCorner}, side=${seg.isSouth ? 'South' : 'North'}`);

    const newUnits = generateUnitSegment({
      geometry: { startX: seg.x, y, length: seg.len, extraWidth: seg.extraWidth },
      classification: { isCorner: seg.isCorner, isLeftCorner, isRightCorner },
      unitCounts: counts,
      pattern: seg.pattern,
      endBonusArea: seg.bonusArea,
      customColors
    }, config, rentableDepth);

    const hasNonFiniteSegmentUnits = newUnits.some(u =>
      !Number.isFinite(u.x) || !Number.isFinite(u.y) || !Number.isFinite(u.width) || !Number.isFinite(u.depth)
    );
    if (hasNonFiniteSegmentUnits) {
      Logger.warn(` Segment ${idx} at x=${seg.x.toFixed(2)} produced units with non-finite geometry`);
    }

    // Debug: Show what units were created and their positions
    if (isLeftCorner || isRightCorner) {
      Logger.debug(` Units created in ${isLeftCorner ? 'LEFT' : 'RIGHT'} corner segment:`);
      newUnits.forEach(u => {
        const endX = u.x + u.width;
        Logger.debug(`  - ${u.type} at x=${u.x.toFixed(2)} to ${endX.toFixed(2)}`);
      });
    }

    units.push(...newUnits);
  });

  // NOTE: Filler detection moved to AFTER all unit modifications
  // (alignment, core wrapping, corridor void absorption) to ensure
  // fillers cover actual gaps in final unit positions.

  // --- 9. Alignment / Mirroring ---
  // For strict alignment, follow the mental model:
  // - Core side first (already generated)
  // - Mirror its partitions to the clear side (copy unit x/width pattern)
  // - Compensate for cores by absorbing core-width gaps into adjacent clear-side units
  const strictAlignment = alignment > 0.6;
  if (strictAlignment) {
    const coreSideIsNorth = coreSide === 'North';
    const coreUnits = units.filter(u => coreSideIsNorth ? u.y === 0 : u.y > 0);
    const clearY = coreSideIsNorth ? (rentableDepth + corridorWidth) : 0;
    const tol = 0.12; // ~4in tolerance for edge matching

    // Clone core-side units to the clear side (mirrors partition positions exactly).
    const mirroredClear: InternalUnitBlock[] = coreUnits.map((u, i) => ({
      ...u,
      id: `mirrored-clear-${i}-${u.id}`,
      y: clearY,
      // Ensure polygon data doesn't carry over accidentally (clear side is rectangular unless wrapped later)
      rects: undefined,
      polyPoints: undefined
    }));

    // Helper to find unit by edge
    const findByRightEdge = (x: number) =>
      mirroredClear.find(u => Math.abs((u.x + u.width) - x) < tol);
    const findByLeftEdge = (x: number) =>
      mirroredClear.find(u => Math.abs(u.x - x) < tol);

    // Compensate for each core: absorb the core-width “gap” into an adjacent unit on the clear side.
    // This keeps the majority of partitions aligned, while resolving the missing strip.
    cores.forEach(core => {
      const left = findByRightEdge(core.x);
      const right = findByLeftEdge(core.x + core.width);

      let expandedUnit: InternalUnitBlock | undefined;

      if (left) {
        left.width += core.width;
        left.area = left.width * rentableDepth;
        expandedUnit = left;
      } else if (right) {
        right.x = right.x - core.width;
        right.width += core.width;
        right.area = right.width * rentableDepth;
        expandedUnit = right;
      } else {
        // If we can't find neighbors (should be rare), skip—better than creating a tiny sliver unit.
        Logger.warn(` STRICT ALIGNMENT: Could not find adjacent units to absorb core gap at x=${core.x.toFixed(2)}`);
      }

      // RE-CLASSIFY: Expanding a unit (e.g. Studio + Core) often changes its type (e.g. to 1BR).
      // We must update the type definition so stats match the geometry.
      if (expandedUnit) {
        // Find best fit type based on new area
        const allTypes = [UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio] as UnitType[];
        const bestType = allTypes.find(t => {
          // Allow some tolerance (e.g. 90% of target area) to upgrade
          return expandedUnit!.area >= config[t].area * 0.9;
        }) || UnitType.Studio;

        if (bestType !== expandedUnit.type) {
          Logger.debug(` STRICT ALIGNMENT: Upgraded expanded unit from ${expandedUnit.type} to ${bestType} (area ${expandedUnit.area.toFixed(0)}sf)`);
          expandedUnit.type = bestType;
          expandedUnit.typeId = bestType;
          expandedUnit.typeName = bestType;
          expandedUnit.color = getUnitColor(bestType, customColors);
        }
      }
    });

    const hasNonFiniteMirroredUnits = mirroredClear.some(u =>
      !Number.isFinite(u.x) || !Number.isFinite(u.y) || !Number.isFinite(u.width) || !Number.isFinite(u.depth)
    );
    if (hasNonFiniteMirroredUnits) {
      Logger.warn(` Strict alignment produced mirrored units with non-finite geometry`);
    }

    const coreY = coreSideIsNorth ? 0 : (rentableDepth + corridorWidth);
    const coreSideUnitsFinal = units.filter(u => u.y === coreY);
    units = [...coreSideUnitsFinal, ...mirroredClear];

    Logger.debug(` STRICT ALIGNMENT: Clear side mirrored from core side partitions and compensated for ${cores.length} cores`);
  } else if (alignment > 0) {
    // Non-strict: keep the existing “snap walls” behavior.
    const northUnits = units.filter(u => u.y === 0);
    const southUnits = units.filter(u => u.y > 0);

    let alignedUnits: InternalUnitBlock[] = [];
    if (coreSide === 'North') {
      const alignedSouth = applyWallAlignment({
        targetUnits: southUnits,
        refUnits: northUnits,
        alignmentStrength: alignment
      }, config, rentableDepth);
      alignedUnits = [...northUnits, ...alignedSouth];
    } else {
      const alignedNorth = applyWallAlignment({
        targetUnits: northUnits,
        refUnits: southUnits,
        alignmentStrength: alignment
      }, config, rentableDepth);
      alignedUnits = [...alignedNorth, ...southUnits];
    }
    units = alignedUnits;
  }

  // --- 10. Apply Core Wrapping (L-Shapes) ---
  // Only L-shape eligible units can wrap around cores
  if (gapHeight > 1) {
    const coreSideUnits = units.filter(u => coreSide === 'North' ? u.y === 0 : u.y > 0);

    const processWrapping = (unitList: InternalUnitBlock[], coreList: CoreBlock[], isSouth: boolean) => {
      const rightmostCoreX = Math.max(...coreList.map(c => c.x));

      coreList.forEach(core => {
        const isRightmostCore = core.x === rightmostCoreX;
        const gapY = isSouth ? (rentableDepth + corridorWidth + coreDepth) : 0;
        const gapRect = { x: core.x, y: gapY, width: core.width, depth: gapHeight };

        if (isRightmostCore) {
          // RIGHT CORNER WRAPPING: wrap the unit to the RIGHT of the rightmost core.
          // This gives the right corner unit an L-shape symmetric to the left corner.
          // We skip left-side wrapping for this core to avoid overlapping geometry.
          const rightUnit = unitList.find(u => Math.abs(u.x - (core.x + core.width)) < 0.1);
          if (rightUnit && isLShapeEligible(rightUnit.type, config)) {
            if (!rightUnit.rects) rightUnit.rects = [{ x: rightUnit.x, y: rightUnit.y, width: rightUnit.width, depth: rightUnit.depth }];
            rightUnit.rects.push(gapRect);

            const uY = rightUnit.y;
            if (isSouth) {
              // South right-wrap: L extends left at the bottom (below coreDepth from unit top)
              rightUnit.polyPoints = `${core.x},${uY} ${rightUnit.x + rightUnit.width},${uY} ${rightUnit.x + rightUnit.width},${uY + rightUnit.depth} ${core.x},${uY + rightUnit.depth} ${core.x},${uY + coreDepth} ${rightUnit.x},${uY + coreDepth}`;
            } else {
              // North right-wrap: L extends left at the top (within gapHeight from unit top)
              rightUnit.polyPoints = `${core.x},${uY} ${rightUnit.x + rightUnit.width},${uY} ${rightUnit.x + rightUnit.width},${uY + rightUnit.depth} ${rightUnit.x},${uY + rightUnit.depth} ${rightUnit.x},${uY + gapHeight} ${core.x},${uY + gapHeight}`;
            }
            Logger.debug(` Right-corner wrap: ${rightUnit.type} at x=${rightUnit.x.toFixed(2)} wraps left into core gap`);
          } else if (rightUnit) {
            Logger.debug(` Skipping right-corner L-shape wrap for ${rightUnit.type} - not L-shape eligible`);
          }
        } else {
          // LEFT-SIDE WRAPPING: wrap the unit to the LEFT of this core (standard behavior).
          const leftUnit = unitList.find(u => Math.abs((u.x + u.width) - core.x) < 0.1);
          if (leftUnit) {
            if (!isLShapeEligible(leftUnit.type, config)) {
              Logger.debug(` Skipping L-shape wrap for ${leftUnit.type} - not L-shape eligible`);
              return;
            }

            if (!leftUnit.rects) leftUnit.rects = [{ x: leftUnit.x, y: leftUnit.y, width: leftUnit.width, depth: leftUnit.depth }];
            leftUnit.rects.push(gapRect);

            const uY = leftUnit.y;
            if (isSouth) {
              leftUnit.polyPoints = `${leftUnit.x},${uY} ${leftUnit.x + leftUnit.width},${uY} ${leftUnit.x + leftUnit.width},${uY + coreDepth} ${leftUnit.x + leftUnit.width + core.width},${uY + coreDepth} ${leftUnit.x + leftUnit.width + core.width},${uY + leftUnit.depth} ${leftUnit.x},${uY + leftUnit.depth}`;
            } else {
              leftUnit.polyPoints = `${leftUnit.x},${uY} ${leftUnit.x + leftUnit.width + core.width},${uY} ${leftUnit.x + leftUnit.width + core.width},${uY + gapHeight} ${leftUnit.x + leftUnit.width},${uY + gapHeight} ${leftUnit.x + leftUnit.width},${uY + leftUnit.depth} ${leftUnit.x},${uY + leftUnit.depth}`;
            }
            Logger.debug(` Left-side wrap: ${leftUnit.type} at x=${leftUnit.x.toFixed(2)} wraps right into core gap`);
          }
        }
      });
    };

    processWrapping(coreSideUnits, cores, coreSide === 'South');
  }

  // --- 11. Corridor Void Absorption (End Units become L-shaped) ---
  // Only corner-eligible AND L-shape eligible units can absorb corridor voids
  const END_OVERLAP = 6 * FEET_TO_METERS;
  let leftCorridorVoid = 0;
  let rightCorridorVoid = 0;

  const northFirst = units.find(u => Math.abs(u.x) < 0.1 && u.y === 0);
  const southFirst = units.find(u => Math.abs(u.x) < 0.1 && u.y > 0.1);

  // LEFT CORNER: Check if BOTH corner units are eligible for L-shapes
  const leftNorthEligible = northFirst && isCornerEligible(northFirst.type, config) && isLShapeEligible(northFirst.type, config);
  const leftSouthEligible = southFirst && isCornerEligible(southFirst.type, config) && isLShapeEligible(southFirst.type, config);

  if (northFirst && southFirst && leftNorthEligible && leftSouthEligible) {
    const minW = Math.min(northFirst.width, southFirst.width);
    if (minW > END_OVERLAP) {
      leftCorridorVoid = minW - END_OVERLAP;

      if (!northFirst.rects) northFirst.rects = [{ x: northFirst.x, y: northFirst.y, width: northFirst.width, depth: northFirst.depth }];
      northFirst.rects.push({ x: 0, y: rentableDepth, width: leftCorridorVoid, depth: corridorWidth / 2 });
      northFirst.area += leftCorridorVoid * (corridorWidth / 2);
      if (!northFirst.polyPoints?.includes(',')) {
        northFirst.polyPoints = `0,0 ${northFirst.width},0 ${northFirst.width},${northFirst.depth} ${leftCorridorVoid},${northFirst.depth} ${leftCorridorVoid},${northFirst.depth + corridorWidth / 2} 0,${northFirst.depth + corridorWidth / 2}`;
      }

      if (!southFirst.rects) southFirst.rects = [{ x: southFirst.x, y: southFirst.y, width: southFirst.width, depth: southFirst.depth }];
      southFirst.rects.push({ x: 0, y: rentableDepth + (corridorWidth / 2), width: leftCorridorVoid, depth: corridorWidth / 2 });
      southFirst.area += leftCorridorVoid * (corridorWidth / 2);
      if (!southFirst.polyPoints?.includes(',')) {
        southFirst.polyPoints = `0,${rentableDepth + corridorWidth / 2} ${leftCorridorVoid},${rentableDepth + corridorWidth / 2} ${leftCorridorVoid},${rentableDepth + corridorWidth} ${southFirst.width},${rentableDepth + corridorWidth} ${southFirst.width},${rentableDepth + corridorWidth + southFirst.depth} 0,${rentableDepth + corridorWidth + southFirst.depth}`;
      }
    }
  } else if (northFirst && southFirst) {
    Logger.debug(` Left corner void skipped: northEligible=${leftNorthEligible}, southEligible=${leftSouthEligible}`);
  }

  const northLast = units.find(u => Math.abs((u.x + u.width) - length) < 0.1 && u.y === 0);
  const southLast = units.find(u => Math.abs((u.x + u.width) - length) < 0.1 && u.y > 0.1);

  // RIGHT CORNER: Check if BOTH corner units are eligible for L-shapes
  const rightNorthEligible = northLast && isCornerEligible(northLast.type, config) && isLShapeEligible(northLast.type, config);
  const rightSouthEligible = southLast && isCornerEligible(southLast.type, config) && isLShapeEligible(southLast.type, config);

  if (northLast && southLast && rightNorthEligible && rightSouthEligible) {
    const minW = Math.min(northLast.width, southLast.width);
    if (minW > END_OVERLAP) {
      rightCorridorVoid = minW - END_OVERLAP;
      const startX = length - rightCorridorVoid;

      if (!northLast.rects) northLast.rects = [{ x: northLast.x, y: northLast.y, width: northLast.width, depth: northLast.depth }];
      northLast.rects.push({ x: startX, y: rentableDepth, width: rightCorridorVoid, depth: corridorWidth / 2 });
      northLast.area += rightCorridorVoid * (corridorWidth / 2);
      const nlX = northLast.x;
      if (!northLast.polyPoints?.includes(',')) {
        northLast.polyPoints = `${nlX},0 ${length},0 ${length},${rentableDepth + corridorWidth / 2} ${startX},${rentableDepth + corridorWidth / 2} ${startX},${rentableDepth} ${nlX},${rentableDepth}`;
      }

      if (!southLast.rects) southLast.rects = [{ x: southLast.x, y: southLast.y, width: southLast.width, depth: southLast.depth }];
      southLast.rects.push({ x: startX, y: rentableDepth + (corridorWidth / 2), width: rightCorridorVoid, depth: corridorWidth / 2 });
      southLast.area += rightCorridorVoid * (corridorWidth / 2);
      const slX = southLast.x;
      if (!southLast.polyPoints?.includes(',')) {
        southLast.polyPoints = `${slX},${rentableDepth + corridorWidth} ${startX},${rentableDepth + corridorWidth} ${startX},${rentableDepth + corridorWidth / 2} ${length},${rentableDepth + corridorWidth / 2} ${length},${rentableDepth + corridorWidth + southLast.depth} ${slX},${rentableDepth + corridorWidth + southLast.depth}`;
      }
    }
  } else if (northLast && southLast) {
    Logger.debug(` Right corner void skipped: northEligible=${rightNorthEligible}, southEligible=${rightSouthEligible}`);
  }

  // --- 11b. Detect and create fillers for leftover space ---
  // IMPORTANT: This MUST happen AFTER all unit modifications (alignment, core wrapping,
  // corridor void absorption) to ensure fillers cover actual gaps in final unit positions.
  const fillers: FillerBlock[] = [];

  // Detect gaps in North side (y=0)
  const northFillers = detectGapsAndCreateFillers(
    units,
    cores,
    coreSide,
    0,          // segmentStartX
    length,     // segmentEndX (full building length)
    0,          // y position for North units
    rentableDepth,
    'North',
    'north'
  );
  fillers.push(...northFillers);

  // Detect gaps in South side (y=rentableDepth+corridorWidth)
  const southFillers = detectGapsAndCreateFillers(
    units,
    cores,
    coreSide,
    0,          // segmentStartX
    length,     // segmentEndX (full building length)
    rentableDepth + corridorWidth,  // y position for South units
    rentableDepth,
    'South',
    'south'
  );
  fillers.push(...southFillers);

  if (fillers.length > 0) {
    Logger.info(` Created ${fillers.length} filler block(s) for leftover space`);
    fillers.forEach(f => {
      Logger.debug(`   Filler: ${f.side} at x=${f.x.toFixed(2)}, width=${f.width.toFixed(2)}m`);
    });
  }

  // --- 12. Calculate Stats ---
  const totalGSF = length * buildingDepth;
  const unitCounts = { [UnitType.Studio]: 0, [UnitType.OneBed]: 0, [UnitType.TwoBed]: 0, [UnitType.ThreeBed]: 0 };
  let nrsf = 0;

  units.forEach(u => {
    unitCounts[u.type]++;
    nrsf += u.area;
  });

  const totalUnits = getTotal(unitCounts);
  const efficiency = totalGSF > 0 ? nrsf / totalGSF : 0;

  // --- 13. Egress Validation ---
  const leftDeadEnd = leftCoreStart - leftCorridorVoid;
  const rightDeadEnd = (length - rightCoreStart - coreWidth) - rightCorridorVoid;
  const maxDeadEnd = Math.max(leftDeadEnd, rightDeadEnd);

  const alcoveLimit = 2.5 * corridorWidth;
  const isAlcove = maxDeadEnd < alcoveLimit;

  let deadEndStatus: 'Pass' | 'Fail' = 'Fail';
  if (isAlcove) {
    deadEndStatus = 'Pass';
  } else if (maxDeadEnd <= egressConfig.deadEndLimit) {
    deadEndStatus = 'Pass';
  }

  let maxTravelBetweenCores = 0;
  if (hasMidCore) {
    const dist1 = midCoreStart - leftCoreEnd;
    const dist2 = rightCoreStart - midCoreEnd;
    maxTravelBetweenCores = Math.max(dist1, dist2) / 2;
  } else {
    const dist = rightCoreStart - leftCoreEnd;
    maxTravelBetweenCores = dist / 2;
  }

  const maxTravelDistance = Math.max(maxDeadEnd, maxTravelBetweenCores);
  const travelDistStatus = maxTravelDistance <= limit ? 'Pass' : 'Fail';

  // --- Debug: Show units at building corners BEFORE coordinate transform ---
  Logger.debug(` === FINAL CORNER UNITS (before transform) ===`);
  const northUnitsPreTransform = units.filter(u => u.y === 0).sort((a, b) => a.x - b.x);
  const southUnitsPreTransform = units.filter(u => u.y > 0).sort((a, b) => a.x - b.x);

  if (northUnitsPreTransform.length > 0) {
    const leftmost = northUnitsPreTransform[0];
    const rightmost = northUnitsPreTransform[northUnitsPreTransform.length - 1];
    Logger.debug(` North LEFT corner: ${leftmost.type} at x=${leftmost.x.toFixed(2)}`);
    Logger.debug(` North RIGHT corner: ${rightmost.type} at x=${rightmost.x.toFixed(2)} (ends at ${(rightmost.x + rightmost.width).toFixed(2)})`);
  }
  if (southUnitsPreTransform.length > 0) {
    const leftmost = southUnitsPreTransform[0];
    const rightmost = southUnitsPreTransform[southUnitsPreTransform.length - 1];
    Logger.debug(` South LEFT corner: ${leftmost.type} at x=${leftmost.x.toFixed(2)}`);
    Logger.debug(` South RIGHT corner: ${rightmost.type} at x=${rightmost.x.toFixed(2)} (ends at ${(rightmost.x + rightmost.width).toFixed(2)})`);
  }
  Logger.debug(` === END CORNER UNITS ===`);

  const hasNonFiniteUnitsBeforeOutput = units.some(u =>
    !Number.isFinite(u.x) || !Number.isFinite(u.y) || !Number.isFinite(u.width) || !Number.isFinite(u.depth)
  );
  if (hasNonFiniteUnitsBeforeOutput) {
    Logger.warn(` Non-finite unit geometry detected before output transform (${units.length} units total)`);
  }

  // --- 14. Convert to Output Format ---
  // Apply coordinate centering: shift from (0,0)-(length,depth) to centered around (0,0)
  const offsetX = -length / 2;
  const offsetY = -buildingDepth / 2;

  const convertPolyPointsToArray = (polyStr: string | undefined): { x: number; y: number }[] | undefined => {
    if (!polyStr) return undefined;
    const points: { x: number; y: number }[] = [];
    const pairs = polyStr.trim().split(/\s+/);
    for (const pair of pairs) {
      const [xStr, yStr] = pair.split(',');
      if (xStr && yStr) {
        // Apply offset to each polygon point
        points.push({ x: parseFloat(xStr) + offsetX, y: parseFloat(yStr) + offsetY });
      }
    }
    return points.length > 0 ? points : undefined;
  };

  const outputUnits: UnitBlock[] = units.map(u => ({
    id: u.id,
    type: u.type,
    typeId: u.type,           // Use enum value as typeId for backwards compat
    typeName: u.type,         // Use enum value as display name for backwards compat
    x: u.x + offsetX,
    y: u.y + offsetY,
    width: u.width,
    depth: u.depth,
    area: u.area,
    color: u.color,
    side: (u.y === 0 ? 'North' : 'South') as 'North' | 'South',
    polyPoints: convertPolyPointsToArray(u.polyPoints),
    isLShaped: !!u.polyPoints
  }));

  // Apply offset to cores
  const outputCores: CoreBlock[] = cores.map(c => ({
    ...c,
    x: c.x + offsetX,
    y: c.y + offsetY
  }));

  // Apply offset to fillers
  const outputFillers: FillerBlock[] = fillers.map(f => ({
    ...f,
    x: f.x + offsetX,
    y: f.y + offsetY
  }));

  const corridor: CorridorBlock = {
    x: leftCorridorVoid + offsetX,
    y: rentableDepth + offsetY,
    width: length - leftCorridorVoid - rightCorridorVoid,
    depth: corridorWidth
  };

  return {
    units: outputUnits,
    cores: outputCores,
    fillers: outputFillers,
    corridor,
    buildingLength: length,
    buildingDepth: buildingDepth,
    floorElevation: footprint.floorZ,
    transform: {
      centerX: footprint.centerX,
      centerY: footprint.centerY,
      rotation: footprint.rotation
    },
    stats: {
      gsf: totalGSF,
      nrsf,
      efficiency,
      unitCounts,
      totalUnits
    },
    egress: {
      maxDeadEnd,
      maxTravelDistance,
      deadEndStatus: isAlcove ? 'Pass' : deadEndStatus,
      travelDistanceStatus: travelDistStatus
    }
  };
}

// ============================================================================
// 3-OPTION GENERATION
// ============================================================================

/**
 * Generates three layout variants using different optimization strategies.
 *
 * This is the primary entry point for the floorplate generator. It creates
 * three design options that users can compare:
 *
 * 1. **Balanced** - Equal priority to mix accuracy, unit sizing, and efficiency.
 *    Good default choice for most situations.
 *
 * 2. **Mix Optimized** - Prioritizes hitting exact unit mix percentages over
 *    other factors. Best when you have strict pro forma requirements.
 *
 * 3. **Efficiency Optimized** - Maximizes building efficiency (NRSF/GSF ratio).
 *    Best when you want to maximize rentable area.
 *
 * Each option is a complete, valid floorplan that can be rendered independently.
 *
 * @param footprint - Building footprint from `extractFootprintFromTriangles()`.
 * @param config - Target unit mix configuration with percentages and areas.
 * @param egressConfig - Fire code egress requirements.
 * @param options - Optional generation parameters:
 *   - `corridorWidth`: Corridor width in meters (default: ~1.83m / 6ft)
 *   - `coreWidth`: Core width in meters (default: ~3.66m / 12ft)
 *   - `coreDepth`: Core depth in meters (default: ~9m / 29.5ft)
 *   - `coreSide`: Side for core placement: 'North' or 'South' (default: 'North')
 *   - `alignment`: Wall alignment strength 0-1 (default: 1.0)
 *   - `customColors`: Optional custom hex colors for each unit type
 * @returns Array of 3 LayoutOption objects, one per strategy. Each contains:
 *          - `id`: Unique identifier for the option
 *          - `strategy`: The optimization strategy used
 *          - `floorplan`: Complete FloorPlanData for rendering
 *          - `label`: Human-readable strategy name
 *          - `description`: Explanation of the strategy
 *
 * @example
 * ```typescript
 * const options = generateFloorplateVariants(
 *   footprint,
 *   unitConfig,
 *   EGRESS_SPRINKLERED
 * );
 *
 * // options[0] = Balanced strategy
 * // options[1] = Mix Optimized strategy
 * // options[2] = Efficiency Optimized strategy
 *
 * // Render the balanced option
 * const meshData = renderFloorplate(options[0].floorplan);
 * ```
 */
export function generateFloorplateVariants(
  footprint: BuildingFootprint,
  config: UnitConfiguration,
  egressConfig: EgressConfig,
  options: GeneratorOptions = {}
): LayoutOption[] {
  const {
    corridorWidth = DEFAULT_CORRIDOR_WIDTH,
    coreWidth = DEFAULT_CORE_WIDTH,
    coreDepth = DEFAULT_CORE_DEPTH,
    coreSide = 'North',
    alignment = 1.0,
    customColors
  } = options;

  const strategies: OptimizationStrategy[] = ['balanced', 'mixOptimized', 'efficiencyOptimized'];

  return strategies.map((strategy, idx) => {
    const floorplan = generateFloorplate(
      footprint,
      config,
      egressConfig,
      corridorWidth,
      coreWidth,
      coreDepth,
      coreSide,
      alignment,
      strategy,
      customColors
    );

    return {
      id: `option-${idx + 1}`,
      strategy,
      floorplan,
      label: STRATEGY_LABELS[strategy],
      description: STRATEGY_DESCRIPTIONS[strategy]
    };
  });
}

// ============================================================================
// FOOTPRINT EXTRACTION
// Moved to ./footprint.ts - re-exported at top of file
// ============================================================================
