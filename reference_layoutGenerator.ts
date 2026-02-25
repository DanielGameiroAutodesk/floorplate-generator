import { UnitType, UnitConfiguration, FloorPlanData, UnitBlock, CoreBlock, EgressConfig, BuildingShape, CorridorBlock } from '../types';
import { 
  COLORS,
  MIN_UNIT_WIDTH,
  CORNER_BAY_LENGTH,
  BUILDING_DEPTH,
  CORRIDOR_WIDTH,
  CORE_WIDTH,
  CORE_DEPTH
} from '../constants';

type PatternStrategy = 'desc' | 'asc' | 'valley' | 'valley-inverted' | 'random';

/**
 * Helper to get total count from a record
 */
const getTotal = (counts: Record<UnitType, number>) => 
  counts[UnitType.Studio] + counts[UnitType.OneBed] + counts[UnitType.TwoBed] + counts[UnitType.ThreeBed];

/**
 * Helper: Get ideal width of a unit type based on current rentable depth
 */
const getUnitWidth = (type: UnitType, config: UnitConfiguration, rentableDepth: number) => {
  return config[type].area / rentableDepth;
};

/**
 * FLEXIBILITY MODEL
 * 
 * Defines how "squishy" or "stretchy" a unit is.
 * Small units (Studios) are rigid. Large units (3Bed) are flexible.
 * The flexibility increases exponentially with unit size.
 */

// 1. Flexibility Factor: Max percentage deviation allowed (0.0 to 1.0)
// Used during the "Bin Packing" phase to decide if a unit physically fits a hole.
const getFlexibilityFactor = (type: UnitType): number => {
  switch (type) {
    case UnitType.Studio: return 0.05; // Relaxed from 0.0. Allow +/- 5%
    case UnitType.OneBed: return 0.10; // +/- 10%
    case UnitType.TwoBed: return 0.15; // +/- 15%
    case UnitType.ThreeBed: return 0.25; // +/- 25%
    default: return 0.1;
  }
};

// 2. Flexibility Weight: Relative capacity to absorb dimensional error (EXPANSION).
// Used when filling gaps.
const getFlexibilityWeight = (type: UnitType): number => {
  switch (type) {
    case UnitType.Studio: return 2;    // Increased slightly
    case UnitType.OneBed: return 5;    
    case UnitType.TwoBed: return 15;   
    case UnitType.ThreeBed: return 40; 
    default: return 10;
  }
};

// 3. Compression Weight: Relative capacity to absorb shrinking (COMPRESSION).
// Used when squeezing into small spaces.
const getCompressionWeight = (type: UnitType): number => {
  switch (type) {
    case UnitType.Studio: return 0.1; // Relaxed from 0.0001. Can shrink a little.
    case UnitType.OneBed: return 2;    
    case UnitType.TwoBed: return 8;   
    case UnitType.ThreeBed: return 20; 
    default: return 5;
  }
};


/**
 * Calculates the total number of units for the entire available length
 * using the Largest Remainder Method to strictly adhere to mix percentages.
 * 
 * Now accepts totalBonusArea to account for the extra capacity provided by core wrapping.
 */
const calculateGlobalUnitCounts = (
  totalLength: number, 
  config: UnitConfiguration,
  rentableDepth: number,
  minSegmentsToFill: number = 1,
  totalBonusArea: number = 0
): Record<UnitType, number> => {
  const counts = {
    [UnitType.Studio]: 0,
    [UnitType.OneBed]: 0,
    [UnitType.TwoBed]: 0,
    [UnitType.ThreeBed]: 0
  };

  const totalMix = config[UnitType.Studio].percentage + 
                   config[UnitType.OneBed].percentage + 
                   config[UnitType.TwoBed].percentage + 
                   config[UnitType.ThreeBed].percentage;
                   
  if (totalMix === 0 || totalLength < MIN_UNIT_WIDTH) return counts;

  // 1. Calculate weighted average width
  const weightedAvgWidth = (
    (config[UnitType.Studio].percentage * getUnitWidth(UnitType.Studio, config, rentableDepth)) +
    (config[UnitType.OneBed].percentage * getUnitWidth(UnitType.OneBed, config, rentableDepth)) +
    (config[UnitType.TwoBed].percentage * getUnitWidth(UnitType.TwoBed, config, rentableDepth)) +
    (config[UnitType.ThreeBed].percentage * getUnitWidth(UnitType.ThreeBed, config, rentableDepth))
  ) / totalMix;

  // 2. Determine target total units (Geometric fit)
  const effectiveLength = totalLength + (totalBonusArea / rentableDepth);
  
  // Use round to get the closest fit
  let targetTotalUnits = Math.round(effectiveLength / weightedAvgWidth);

  // Cap target to physical maximum
  const maxPhysUnits = Math.floor(totalLength / MIN_UNIT_WIDTH);
  targetTotalUnits = Math.min(targetTotalUnits, maxPhysUnits);
  targetTotalUnits = Math.max(targetTotalUnits, minSegmentsToFill);

  if (targetTotalUnits === 0) return counts;

  // 3. Largest Remainder Method for perfect mix
  const remainders: { type: UnitType; value: number }[] = [];
  let currentSum = 0;

  ([UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed] as const).forEach(type => {
    const rawCount = targetTotalUnits * (config[type].percentage / totalMix);
    const intCount = Math.floor(rawCount);
    
    counts[type] = intCount;
    currentSum += intCount;
    
    remainders.push({
      type,
      value: rawCount - intCount
    });
  });

  const deficit = targetTotalUnits - currentSum;
  remainders.sort((a, b) => b.value - a.value);

  for (let i = 0; i < deficit; i++) {
    counts[remainders[i].type]++;
  }

  // 4. Ensure it physically fits (prevent impossible compression)
  let minRequiredWidth = 0;
  ([UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed] as const).forEach(type => {
      const flex = getFlexibilityFactor(type);
      const minW = getUnitWidth(type, config, rentableDepth) * (1 - flex);
      minRequiredWidth += counts[type] * minW;
  });

  // If it's physically impossible to fit even with max compression, reduce total units by 1 and recalculate
  if (minRequiredWidth > effectiveLength && targetTotalUnits > minSegmentsToFill) {
      return calculateGlobalUnitCounts(totalLength - weightedAvgWidth, config, rentableDepth, minSegmentsToFill, totalBonusArea);
  }

  return counts;
};

/**
 * Chooses the appropriate unit from inventory to place in a segment.
 * Respects flexibility: Won't place a rigid unit in a space that requires too much compression.
 */
const pickBestUnitForSegment = (
  inventory: Record<UnitType, number>,
  isCorner: boolean,
  prioritizeCorners: boolean,
  remainingSpace: number,
  config: UnitConfiguration,
  rentableDepth: number
): UnitType | null => {
  
  // Available types
  const types = ([UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio] as UnitType[])
                .filter(t => inventory[t] > 0);
  
  if (types.length === 0) return null;

  // Check availability AND physical fit (with flexibility)
  for (const t of types) {
     const w = getUnitWidth(t, config, rentableDepth);
     const flexibility = getFlexibilityFactor(t);
     
     // Calculate minimum space required for this unit to "squeeze" in
     // For Studio, flexibility is 0, so minReq = w.
     const minReq = w * (1.0 - flexibility);

     // Heuristic: If this unit is larger than remaining space, can it squeeze?
     if (remainingSpace < w) {
        // If strictly rigid (Studio), allow a tiny epsilon (0.1) for float math, but no real squeezing.
        if (remainingSpace >= minReq - 0.1) return t; 
     } else {
        // If unit is smaller than remaining space, it fits.
        // However, if we prioritize corners, we might prefer larger units first.
        if (prioritizeCorners && isCorner) {
            // Try to find the largest that fits or squeezes
            return t;
        }
        // If not corner, we also take the largest usually (First Fit Descending)
        return t;
     }
  }
  
  return null;
};

/**
 * Advanced Capacity-Aware Distribution:
 * Fills segments based on their physical capacity and FLEXIBILITY,
 * avoiding "overstuffing" small segments with units that physically don't fit.
 */
const distributeUnitsToSegments = (
  globalCounts: Record<UnitType, number>,
  segments: { len: number, isCorner: boolean, bonusArea: number }[],
  config: UnitConfiguration,
  rentableDepth: number,
  prioritizeCorners: boolean
): Record<UnitType, number>[] => {
  
  // Initialize result structure
  const segmentCounts: Record<UnitType, number>[] = segments.map(() => ({
    [UnitType.Studio]: 0, [UnitType.OneBed]: 0, [UnitType.TwoBed]: 0, [UnitType.ThreeBed]: 0
  }));

  if (segments.length === 0) return segmentCounts;

  // Work with mutable inventory
  const inventory = { ...globalCounts };
  
  // Helper to check if inventory has units
  const hasInventory = () => getTotal(inventory) > 0;

  // Track remaining capacity per segment (in feet)
  // Capacity includes the bonus width derived from wrap area
  const segmentState = segments.map((s, idx) => ({
    idx,
    isCorner: s.isCorner,
    capacity: s.len + (s.bonusArea / rentableDepth),
    fill: 0,
    units: [] as UnitType[]
  }));

  // Define Sort Order for Segments
  // If prioritizeCorners, we fill Corners first. Else largest segments first.
  const sortedSegIndices = segmentState.map((s, i) => i).sort((a, b) => {
    const sA = segmentState[a];
    const sB = segmentState[b];
    
    if (prioritizeCorners) {
        if (sA.isCorner !== sB.isCorner) return sA.isCorner ? -1 : 1;
    }
    return sB.capacity - sA.capacity; // Descending capacity
  });

  // --- PASS 1: ITERATIVE FILL ---
  // Try to place one unit at a time into segments until they are "full"
  
  let madeProgress = true;
  while (hasInventory() && madeProgress) {
    madeProgress = false;

    for (const idx of sortedSegIndices) {
        const seg = segmentState[idx];
        const remainingSpace = seg.capacity - seg.fill;
        
        // Critical change: We stop filling when space is effectively zero.
        if (remainingSpace <= 0.5) continue; 

        // Pick best unit from inventory
        const unitType = pickBestUnitForSegment(inventory, seg.isCorner, prioritizeCorners, remainingSpace, config, rentableDepth);
        
        if (unitType) {
            // Assign
            segmentCounts[idx][unitType]++;
            inventory[unitType]--;
            const width = getUnitWidth(unitType, config, rentableDepth);
            seg.fill += width;
            madeProgress = true;
        }
    }
  }

  // --- PASS 2: OVERFLOW ---
  // If we still have inventory (because all segments are 'full' according to strict rules),
  // we must force them in. Distribute to the segments with the most "relative" space (lowest density).
  // BUT: Avoid stuffing into segments that only contain rigid units if possible.
  while (hasInventory()) {
     // Find least dense segment (fill / capacity)
     let bestIdx = -1;
     let minDensity = Number.MAX_VALUE;

     segmentState.forEach((s, i) => {
        // Preference score: Density + Penalty for Rigid Composition
        // If a segment is mostly studios, we really don't want to overstuff it.
        const density = s.fill / s.capacity; 
        
        // Calculate rigidity penalty
        const currentUnits = segmentCounts[i];
        const totalU = getTotal(currentUnits);
        const rigidU = currentUnits[UnitType.Studio];
        const rigidityRatio = totalU > 0 ? rigidU / totalU : 0;
        
        // Heuristic: effectively increase "density" if it's rigid, making it less likely to be picked
        const effectiveDensity = density + (rigidityRatio * 0.5);

        if (effectiveDensity < minDensity) {
            minDensity = effectiveDensity;
            bestIdx = i;
        }
     });

     if (bestIdx !== -1) {
         // Just take the largest available unit to clear inventory fast
         const types = [UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio] as UnitType[];
         const type = types.find(t => inventory[t] > 0);
         if (type) {
             segmentCounts[bestIdx][type]++;
             inventory[type]--;
             segmentState[bestIdx].fill += getUnitWidth(type, config, rentableDepth);
         }
     } else {
         break; // Should not happen
     }
  }

  return segmentCounts;
};


const generateUnitSegment = (
  startX: number, 
  y: number, 
  segmentLength: number, 
  counts: Record<UnitType, number>,
  pattern: PatternStrategy,
  config: UnitConfiguration,
  rentableDepth: number,
  extraWidth: number = 0,
  endBonusArea: number = 0 // Extra area the last unit receives (e.g. core wrap)
): UnitBlock[] => {
  if (segmentLength <= 0) return [];

  const totalUnits = getTotal(counts);
  if (totalUnits === 0) return [];

  const unitsToPlace: UnitType[] = [];
  const mutableCounts = { ...counts };

  // Prepare inventory list
  const inventoryList: UnitType[] = [];
  ([UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio] as const).forEach(type => {
    while(mutableCounts[type] > 0) {
      inventoryList.push(type);
      mutableCounts[type]--;
    }
  });

  // Determine Placement Order based on Pattern
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
    // Fisher-Yates shuffle
    for (let i = inventoryList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [inventoryList[i], inventoryList[j]] = [inventoryList[j], inventoryList[i]];
    }
    unitsToPlace.push(...inventoryList);
  }

  // --- CONSTRAINT: NO STUDIOS AT WRAP ---
  // If we have endBonusArea, the last unit wraps the core. 
  // We want to avoid placing a Studio there if possible.
  if (endBonusArea > 0 && unitsToPlace.length > 0) {
     const lastIdx = unitsToPlace.length - 1;
     if (unitsToPlace[lastIdx] === UnitType.Studio) {
         // Attempt to swap with the largest non-studio available
         let swapIdx = -1;
         
         // PROTECTION: If this is the facade corner (startX === 0), do NOT swap with the first unit.
         // We prioritize keeping the facade unit large over shielding the core, 
         // because a Studio at the Facade is worse than a Studio at the Core.
         const stopIdx = startX === 0 ? 1 : 0;

         // Iterate backwards from second-to-last to find best candidate
         for (let i = lastIdx - 1; i >= stopIdx; i--) {
             if (unitsToPlace[i] !== UnitType.Studio) {
                 swapIdx = i;
                 break;
             }
         }
         
         if (swapIdx !== -1) {
             [unitsToPlace[lastIdx], unitsToPlace[swapIdx]] = [unitsToPlace[swapIdx], unitsToPlace[lastIdx]];
         }
     }
  }

  // --- WEIGHTED GEOMETRY GENERATION ---
  // Distribute the delta (error) based on flexibility weight across ALL units.
  // Avoids the "Last Unit Trap" where the last unit absorbs all error.
  
  // Calculate Bonus Width Equivalent
  // This is how much "Width" the bonus area saves us.
  // We can treat the last unit as having a smaller ideal width.
  const endBonusWidth = endBonusArea / rentableDepth;

  const idealWidthSum = unitsToPlace.reduce((sum, type, idx) => {
    let w = getUnitWidth(type, config, rentableDepth);
    // If this is the last unit and we have bonus area, reduce its ideal physical width
    if (idx === unitsToPlace.length - 1 && endBonusWidth > 0) {
        w = Math.max(1, w - endBonusWidth);
    }
    return sum + w;
  }, 0);

  const effectiveLength = segmentLength - extraWidth;
  const totalDiff = effectiveLength - idealWidthSum; // Negative = Compression, Positive = Expansion
  const isCompression = totalDiff < 0;

  // Use appropriate weights based on whether we are compressing or expanding
  const weightFn = isCompression ? getCompressionWeight : getFlexibilityWeight;
  const totalWeight = unitsToPlace.reduce((sum, type) => sum + weightFn(type), 0);

  // Calculate widths for all units first
  const calculatedWidths: number[] = unitsToPlace.map((type, idx) => {
    let targetW = getUnitWidth(type, config, rentableDepth);
    // Apply bonus reduction for weight distribution too
    if (idx === unitsToPlace.length - 1 && endBonusWidth > 0) {
         targetW = Math.max(1, targetW - endBonusWidth);
    }

    const weight = weightFn(type);
    
    // Distribute error
    const share = totalWeight > 0 ? weight / totalWeight : (1 / unitsToPlace.length);
    const adjustment = totalDiff * share;
    
    // Safety clamp (should be minimal if logic works)
    return Math.max(1, targetW + adjustment);
  });

  // Verify Sum and Correct Rounding Error
  // Float math might leave us 0.0001 off from effectiveLength
  const currentSum = calculatedWidths.reduce((a, b) => a + b, 0);
  const roundingError = effectiveLength - currentSum;
  
  // Apply rounding error to the MOST FLEXIBLE unit index (not just the last one)
  // Find index of max flexibility weight
  let maxWeight = -1;
  let fixIndex = unitsToPlace.length - 1; // Default to last if all equal

  unitsToPlace.forEach((type, idx) => {
      // Use Expansion flexibility for rounding fix usually, as it's typically safest
      const w = getFlexibilityWeight(type);
      if (w > maxWeight) {
          maxWeight = w;
          fixIndex = idx;
      }
  });

  calculatedWidths[fixIndex] += roundingError;

  // Generate Blocks
  const units: UnitBlock[] = [];
  let currentX = startX;

  unitsToPlace.forEach((type, index) => {
    const width = calculatedWidths[index];
    
    // Final check for Last Unit to ensure exact boundary snap (re-correcting floating point drift)
    // But this time we know the width is calculated correctly, so it's just a tiny snap.
    let finalWidth = width;
    if (index === unitsToPlace.length - 1) {
        // Force snap to end
        finalWidth = (startX + effectiveLength) - currentX;
        finalWidth += extraWidth; // Add the shield back
    }

    // Apply area adjustment
    let areaBonus = 0;
    if (index === unitsToPlace.length - 1) {
        areaBonus = endBonusArea;
    }

    units.push({
      id: `unit-${startX}-${y}-${index}`,
      type,
      x: currentX,
      y,
      width: finalWidth,
      depth: rentableDepth,
      area: (finalWidth * rentableDepth) + areaBonus,
      color: COLORS[type]
    });
    currentX += finalWidth;
  });

  return units;
};

/**
 * Optimization Algorithm:
 * Finds the optimal Corner Bay length AND optimal Mid Core Offset that results in
 * the minimum distortion (squashing/stretching) of units.
 */
const findOptimalGeometry = (
  availableRentableLength: number,
  numMidSpans: number,
  globalCounts: Record<UnitType, number>,
  config: UnitConfiguration,
  rentableDepth: number,
  prioritizeCorners: boolean,
  deadEndLimit: number,
  singleCoreBonusArea: number,
  isContinuousSide: boolean = false
): { cornerLen: number, midCoreOffset: number } => {
  let bestCornerLen = CORNER_BAY_LENGTH;
  let bestOffset = 0;
  let minWeightedError = Number.MAX_VALUE;

  // Search Range: 20ft to Max(deadEndLimit or 90)
  // If strict egress is required, cap maxC at deadEndLimit.
  
  let minC = 20;
  
  if (prioritizeCorners) {
     const types = [UnitType.ThreeBed, UnitType.TwoBed, UnitType.OneBed, UnitType.Studio];
     for (const t of types as UnitType[]) {
        if (globalCounts[t] > 0) {
            const w = getUnitWidth(t, config, rentableDepth);
            minC = Math.max(minC, Math.floor(w * 0.9)); 
            break;
        }
     }
  }

  // Constrain by dead end limit if pertinent
  let maxC = Math.min(90, availableRentableLength / 2 - 15);
  
  // Step size for speed
  const step = 2; 

  for (let c = minC; c <= maxC; c += step > 0 ? step : 1) {
    // If minC=maxC because of strict constraint, loop runs once
    if (c > maxC && c !== minC) break; 

    const cornerLen = c;
    
    let offsets = [0];
    const totalMidLen = availableRentableLength - (2 * cornerLen);

    // If Continuous Side, we have one big middle span, so offset is irrelevant (always 0)
    // If Split Side (isContinuousSide=false) and we have mid spans, we optimize offset.
    if (!isContinuousSide && numMidSpans === 2) {
       const maxDev = Math.min(30, Math.floor(totalMidLen * 0.15));
       for(let o = 4; o <= maxDev; o += 4) {
          offsets.push(o);
          offsets.push(-o);
       }
    }

    for (const offset of offsets) {
        const simSegments: {len: number, isCorner: boolean, bonusArea: number}[] = [];
        
        // Add Corners
        // Left Corner ends at Core -> Has Bonus (Only if not continuous, but logic handled below)
        const leftBonus = isContinuousSide ? 0 : singleCoreBonusArea;
        simSegments.push({ len: cornerLen, isCorner: true, bonusArea: leftBonus });
        
        // Right Corner starts at Core -> No Bonus (in current linear gen model)
        simSegments.push({ len: cornerLen, isCorner: true, bonusArea: 0 });

        // Add Middle
        if (isContinuousSide) {
            // One continuous middle run (no internal wrapping)
             simSegments.push({ len: totalMidLen, isCorner: false, bonusArea: 0 });
        } else {
            // Core-interrupted middle runs
            if (numMidSpans === 1) {
                 // Ends at Right Core -> Bonus
                 simSegments.push({ len: totalMidLen, isCorner: false, bonusArea: singleCoreBonusArea });
            } else {
                 const half = totalMidLen / 2;
                 // Span 1 ends at Mid Core -> Bonus
                 simSegments.push({ len: half + offset, isCorner: false, bonusArea: singleCoreBonusArea });
                 // Span 2 ends at Right Core -> Bonus
                 simSegments.push({ len: half - offset, isCorner: false, bonusArea: singleCoreBonusArea });
            }
        }

        const dist = distributeUnitsToSegments(globalCounts, simSegments, config, rentableDepth, true);

        let totalScore = 0;
        
        // --- SCORING ---
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

           // Absolute difference in feet
           // Important: Add bonusW to segLen because the segment physically allows units to shrink by that amount
           // Or rather, the segment provides that much extra "area capacity" converted to width.
           let diff = (segLen + bonusW) - idealWidthSum; 
           const absDiff = Math.abs(diff);

           // WEIGHTED PENALTY
           // We penalize Compression (diff < 0) much more heavily than Expansion (diff > 0).
           const isCompression = diff < -0.1;
           const penaltyMultiplier = isCompression ? 500 : 100; // 5x penalty for compression

           const capacity = Math.max(segmentFlexWeightSum, 0.1); 
           const weightedPenalty = absDiff * (penaltyMultiplier / capacity);
           totalScore += weightedPenalty;
        });

        if (totalScore < minWeightedError) {
           minWeightedError = totalScore;
           bestCornerLen = cornerLen;
           bestOffset = offset;
        }
    }
  }

  return { cornerLen: bestCornerLen, midCoreOffset: bestOffset };
};


/**
 * Applies geometric alignment to the generated south units based on north unit boundaries.
 */
const applyWallAlignment = (
  targetUnits: UnitBlock[], 
  refUnits: UnitBlock[], 
  alignmentStrength: number,
  config: UnitConfiguration,
  rentableDepth: number
): UnitBlock[] => {
  if (targetUnits.length === 0 || alignmentStrength <= 0) return targetUnits;

  // 1. Collect Target Snap Lines (Right edges of Reference Units)
  const snapTargets: number[] = [];
  refUnits.forEach(u => {
     snapTargets.push(u.x + u.width);
     snapTargets.push(u.x);
  });
  
  // Dedup and sort
  const uniqueTargets = Array.from(new Set(snapTargets.map(x => parseFloat(x.toFixed(2))))).sort((a,b) => a-b);

  // 2. Iterate through Target Units and try to snap their RIGHT edge
  const newUnits = targetUnits.map(u => ({...u}));
  
  // Search radius
  const MAX_PULL = 4 + (alignmentStrength * 8); // Up to 12ft pull when strict

  for (let i = 0; i < newUnits.length - 1; i++) {
     const unit = newUnits[i];
     const currentRightEdge = unit.x + unit.width;
     
     // Find closest target
     let minDiff = Number.MAX_VALUE;
     let bestTarget = -1;

     for (const t of uniqueTargets) {
        const diff = Math.abs(t - currentRightEdge);
        if (diff < minDiff) {
            minDiff = diff;
            bestTarget = t;
        }
     }

     if (bestTarget !== -1 && minDiff <= MAX_PULL && minDiff > 0.01) {
        // PROBABILISTIC ALIGNMENT
        if (Math.random() > alignmentStrength) continue;

        // Attempt Snap
        const proposedRightEdge = bestTarget;
        const proposedWidth = proposedRightEdge - unit.x;
        
        // Next unit check
        const nextUnit = newUnits[i+1];
        const nextUnitRightEdge = nextUnit.x + nextUnit.width;
        const proposedNextWidth = nextUnitRightEdge - proposedRightEdge;

        // --- STRICT CONSTRAINTS CHECK ---
        const flexMultiplier = 1.0 + (alignmentStrength * 0.5); // Up to 50% more flexible when aligning strictly
        const unitFlex = getFlexibilityFactor(unit.type) * flexMultiplier;
        const nextUnitFlex = getFlexibilityFactor(nextUnit.type) * flexMultiplier;

        const unitMinW = getUnitWidth(unit.type, config, rentableDepth) * (1.0 - unitFlex);
        const nextUnitMinW = getUnitWidth(nextUnit.type, config, rentableDepth) * (1.0 - nextUnitFlex);
        
        const unitMaxW = getUnitWidth(unit.type, config, rentableDepth) * (1.0 + unitFlex);
        const nextUnitMaxW = getUnitWidth(nextUnit.type, config, rentableDepth) * (1.0 + nextUnitFlex);

        // Allow a tiny epsilon (0.2ft) for floating point, but basically strictly enforce
        if (proposedWidth >= unitMinW - 0.2 && proposedNextWidth >= nextUnitMinW - 0.2 &&
            proposedWidth <= unitMaxW + 0.2 && proposedNextWidth <= nextUnitMaxW + 0.2) {
             // Apply Snap
             const shift = proposedRightEdge - currentRightEdge;
             
             // Update current unit
             unit.width = proposedWidth;
             unit.area = unit.width * unit.depth;
             
             // Update next unit's start position and width
             nextUnit.x = proposedRightEdge;
             nextUnit.width = proposedNextWidth;
             nextUnit.area = nextUnit.width * nextUnit.depth;
        }
     }
  }

  return newUnits;
}


export const generateBarLayout = (
  length: number, 
  config: UnitConfiguration, 
  alignment: number = 1.0, 
  placeLargerUnitsAtEnds: boolean = true,
  coreWidth: number = CORE_WIDTH,
  coreDepth: number = CORE_DEPTH, 
  buildingDepth: number = BUILDING_DEPTH, 
  corridorWidth: number = CORRIDOR_WIDTH,
  egressConfig: EgressConfig,
  coreSide: 'North' | 'South' = 'North',
  hasLeftEnd: boolean = true,
  hasRightEnd: boolean = true
): FloorPlanData => {
  const cores: CoreBlock[] = [];
  
  // Derive geometric constraints
  const rentableDepth = (buildingDepth - corridorWidth) / 2;

  // Calculate potential bonus area per core wrap
  const gapHeight = rentableDepth - coreDepth;
  const singleCoreBonusArea = gapHeight > 0.1 ? (gapHeight * coreWidth) : 0;

  // --- 1. Architectural Geometry Optimization ---
  
  const limit = (egressConfig.travelDistanceLimit && egressConfig.travelDistanceLimit > 0) 
                  ? egressConfig.travelDistanceLimit 
                  : 250;
                  
  const minFeasibleCorner = 20; 
  // Calculate gaps based on which cores exist
  // If end cores don't exist, the gap is from 0 or to length
  const leftGapDed = hasLeftEnd ? (minFeasibleCorner + coreWidth) : 0;
  const rightGapDed = hasRightEnd ? (minFeasibleCorner + coreWidth) : 0;
  
  const worstCaseGap2Cores = length - leftGapDed - rightGapDed;
  const worstCaseTravel2Cores = worstCaseGap2Cores / 2;
  
  const needsMidCore = worstCaseTravel2Cores > limit;
  const hasMidCore = needsMidCore;
  
  let numCores = (hasMidCore ? 1 : 0);
  if (hasLeftEnd) numCores++;
  if (hasRightEnd) numCores++;

  const totalCoreWidth = numCores * coreWidth; 
  const availableRentableLengthCoreSide = length - totalCoreWidth;
  const availableRentableLengthClearSide = length;

  const numMidSpans = hasMidCore ? 2 : 1;
  // Total spans = mid spans + (1 if left corner) + (1 if right corner)
  const totalSpansCoreSide = numMidSpans + (hasLeftEnd ? 1 : 0) + (hasRightEnd ? 1 : 0);

  // Calculate Total Bonus Area for Core Side
  // Bonus applies to:
  // - Left Core (if exists)
  // - Right Core (if exists)
  // - Mid Core (if exists, usually 2 sides? No, linear model assumes 1 side wrap per core-segment interface)
  // Current logic: (1 + numMidSpans) * singleCoreBonusArea
  // If 2 end cores + 0 mid: 1 span. Bonus?
  // Original: 2 cores -> 1 mid span. Bonus = (1+1) = 2? 
  // Let's trace original: `(1 + numMidSpans) * singleCoreBonusArea`
  // If 2 cores (no mid): numMidSpans=1. Bonus = 2 * single. (Left wrap + Right wrap).
  // If 3 cores (mid): numMidSpans=2. Bonus = 3 * single. (Left + Mid + Right).
  // New logic:
  let bonusCount = 0;
  if (hasLeftEnd) bonusCount++;
  if (hasRightEnd) bonusCount++;
  if (hasMidCore) bonusCount++; // Mid core usually adds a wrap opportunity?
  // Actually, mid core adds 2 wrap opportunities (left and right of it)?
  // Original logic: 
  // 2 cores: Left Corner (Wrap), Mid (Wrap), Right Corner (No Wrap?) -> Wait.
  // Let's look at `generateCoreSideSegments` original:
  // Left Corner: bonusArea = singleCoreBonusArea
  // Mid: bonusArea = singleCoreBonusArea
  // Right Corner: bonusArea = 0
  // So 2 cores -> 2 bonuses.
  // 3 cores: Left (Bonus), Mid1 (Bonus), Mid2 (Bonus), Right (0). -> 3 bonuses.
  // So `bonusCount` should be `(hasLeftEnd ? 1 : 0) + (hasMidCore ? 1 : 0) + (numMidSpans - (hasMidCore?0:0))?`
  // Let's stick to: Each segment *ending* at a core gets a bonus.
  // Left Corner ends at Left Core -> Bonus (if hasLeftEnd)
  // Mid Span ends at Right Core (if no mid core) -> Bonus (if hasRightEnd)
  // Mid Span 1 ends at Mid Core -> Bonus (if hasMidCore)
  // Mid Span 2 ends at Right Core -> Bonus (if hasRightEnd)
  
  // So total bonuses = (hasLeftEnd ? 1 : 0) + (hasMidCore ? 1 : 0) + (hasRightEnd ? 1 : 0)?
  // Wait, if hasRightEnd is false (core is external), does the last segment get a bonus?
  // If the core is external, the unit abuts it. Yes, it can wrap.
  // But `singleCoreBonusArea` is calculated based on `gapHeight`.
  // If we don't generate the core, we don't generate the gap rects in `processWrapping`.
  // So we shouldn't claim bonus area if we aren't going to generate the geometry for it.
  // UNLESS we want to support wrapping external cores?
  // For now, let's assume NO wrapping on external cores to keep it simple and safe.
  // So bonus only if core exists in bar.
  
  const coreSideTotalBonusArea = ((hasLeftEnd ? 1 : 0) + (hasMidCore ? 1 : 0) + (hasRightEnd && hasMidCore ? 1 : 0) + (hasRightEnd && !hasMidCore ? 1 : 0)) * singleCoreBonusArea;
  // Simplified: 
  // If hasLeftEnd: +1
  // If hasMidCore: +1
  // If hasRightEnd: +1
  // So just sum of existing cores?
  // Original: 2 cores -> 2 bonuses. 3 cores -> 3 bonuses.
  // Yes, seems to match number of cores.
  const calculatedBonusArea = numCores * singleCoreBonusArea;

  // OPTIMIZATION FOR CORE SIDE
  const coreSideCounts = calculateGlobalUnitCounts(
      availableRentableLengthCoreSide, 
      config, 
      rentableDepth, 
      totalSpansCoreSide,
      calculatedBonusArea
  );

  const { cornerLen: coreSideCornerLen, midCoreOffset } = findOptimalGeometry(
    availableRentableLengthCoreSide, 
    numMidSpans, 
    coreSideCounts, 
    config,
    rentableDepth,
    placeLargerUnitsAtEnds,
    egressConfig.deadEndLimit, 
    singleCoreBonusArea,
    false // Not continuous
  );

  // OPTIMIZATION FOR CLEAR SIDE
  const clearSideCounts = calculateGlobalUnitCounts(
      availableRentableLengthClearSide, 
      config, 
      rentableDepth, 
      3 // 3 segments: Corner, Mid, Corner
  );
  
  const { cornerLen: clearSideCornerLenIndependent } = findOptimalGeometry(
    availableRentableLengthClearSide, // Full length available
    1, // Treat as 1 big middle span
    clearSideCounts,
    config,
    rentableDepth,
    placeLargerUnitsAtEnds,
    egressConfig.deadEndLimit,
    0, // Clear side has no core wrapping
    true // Is continuous
  );
  
  // MASTER-SLAVE ALIGNMENT
  // If alignment is requested, try to snap the clear side's corner length to the core side's corner length
  // to create a clean visual alignment at the ends.
  const snapToCore = alignment > 0.6;
  const finalClearSideCornerLen = snapToCore ? coreSideCornerLen : clearSideCornerLenIndependent;

  // --- 2. Geometry Construction ---
  // Define Core Positions
  const leftCoreStart = hasLeftEnd ? coreSideCornerLen : 0;
  const leftCoreEnd = hasLeftEnd ? (leftCoreStart + coreWidth) : 0;
  
  // We need to determine rightCoreStart relative to length
  // If hasRightEnd: It is `length - cornerLen - coreWidth`.
  // If !hasRightEnd: It is `length`.
  const rightCoreStart = hasRightEnd ? (length - coreSideCornerLen - coreWidth) : length;
  const rightCoreEnd = hasRightEnd ? (rightCoreStart + coreWidth) : length;

  const totalMidLen = rightCoreStart - leftCoreEnd;
  
  // Calculate Mid Spans with offset
  let midSpan1 = 0;
  let midSpan2 = 0;
  
  if (hasMidCore) {
      midSpan1 = (totalMidLen / 2) + midCoreOffset;
      midSpan2 = (totalMidLen / 2) - midCoreOffset;
  } else {
      midSpan1 = totalMidLen;
  }
  
  let midCoreStart = 0; 
  let midCoreEnd = 0;
  if (hasMidCore) {
     midCoreStart = leftCoreEnd + midSpan1;
     midCoreEnd = midCoreStart + coreWidth;
  }

  // --- 3. Generate Cores ---
  const addCore = (x: number, idSuffix: string, type: 'End' | 'Mid') => {
    // Determine Y based on Core Side
    const y = coreSide === 'North' ? (rentableDepth - coreDepth) : (rentableDepth + corridorWidth);
    cores.push({ id: `core-${idSuffix}`, x, y, width: coreWidth, height: coreDepth, type });
  };

  if (hasLeftEnd) addCore(leftCoreStart, 'left', 'End');
  if (hasRightEnd) addCore(rightCoreStart, 'right', 'End');
  if (hasMidCore) addCore(midCoreStart, 'mid', 'Mid');


  // --- 4. Define Unit Segments ---
  interface SegmentDef {
    x: number;
    len: number;
    isSouth: boolean;
    pattern: PatternStrategy; 
    isCorner: boolean;
    extraWidth: number;
    bonusArea: number;
  }
  let northSegments: SegmentDef[] = [];
  let southSegments: SegmentDef[] = [];

  const leftCornerPattern: PatternStrategy = placeLargerUnitsAtEnds ? 'valley' : 'asc';
  const midPattern: PatternStrategy = 'valley';
  const rightCornerPattern: PatternStrategy = placeLargerUnitsAtEnds ? 'valley-inverted' : 'desc';

  // HELPER: Generate segments for the Core Side
  const generateCoreSideSegments = (isSouth: boolean): SegmentDef[] => {
      const segs: SegmentDef[] = [];
      
      // Seg 1: Left Corner (Only if hasLeftEnd)
      if (hasLeftEnd) {
        segs.push({ x: 0, len: leftCoreStart, isSouth, pattern: leftCornerPattern, isCorner: true, extraWidth: 0, bonusArea: singleCoreBonusArea });
      }
      
      if (!hasMidCore) {
          // Seg 2: Mid (Single span between Left and Right)
          // Ends at Right Core (if exists) -> Bonus
          const bonus = hasRightEnd ? singleCoreBonusArea : 0;
          segs.push({ x: leftCoreEnd, len: midSpan1, isSouth, pattern: midPattern, isCorner: false, extraWidth: 0, bonusArea: bonus });
      } else {
          // Seg 2: Mid 1 (Ends at Mid Core -> Bonus)
          segs.push({ x: leftCoreEnd, len: midSpan1, isSouth, pattern: midPattern, isCorner: false, extraWidth: 0, bonusArea: singleCoreBonusArea });
          // Seg 3: Mid 2 (Ends at Right Core -> Bonus if exists)
          const bonus = hasRightEnd ? singleCoreBonusArea : 0;
          segs.push({ x: midCoreEnd, len: midSpan2, isSouth, pattern: midPattern, isCorner: false, extraWidth: 0, bonusArea: bonus });
      }
      
      // Seg Last: Right Corner (Only if hasRightEnd)
      if (hasRightEnd) {
        segs.push({ x: rightCoreEnd, len: length - rightCoreEnd, isSouth, pattern: rightCornerPattern, isCorner: true, extraWidth: 0, bonusArea: 0 });
      }
      
      return segs;
  };

  // HELPER: Generate segments for the Clear Side
  const generateClearSideSegments = (isSouth: boolean): SegmentDef[] => {
      const segs: SegmentDef[] = [];
      const midLen = length - (2 * finalClearSideCornerLen);
      const midPat = alignment < 0.2 ? 'random' : 'valley-inverted';

      segs.push({ x: 0, len: finalClearSideCornerLen, isSouth, pattern: leftCornerPattern, isCorner: true, extraWidth: 0, bonusArea: 0 });
      segs.push({ x: finalClearSideCornerLen, len: midLen, isSouth, pattern: midPat, isCorner: false, extraWidth: 0, bonusArea: 0 });
      segs.push({ x: length - finalClearSideCornerLen, len: finalClearSideCornerLen, isSouth, pattern: rightCornerPattern, isCorner: true, extraWidth: 0, bonusArea: 0 });
      return segs;
  };

  if (coreSide === 'North') {
      northSegments.push(...generateCoreSideSegments(false));
      southSegments.push(...generateClearSideSegments(true));
  } else {
      northSegments.push(...generateClearSideSegments(false));
      southSegments.push(...generateCoreSideSegments(true));
  }


  // --- 5. Distribution ---
  
  // North Distribution
  const northRentableLen = northSegments.reduce((sum, s) => sum + s.len, 0);
  // Calculate Bonus only if North has cores
  const northBonus = coreSide === 'North' ? coreSideTotalBonusArea : 0;
  
  const northGlobal = calculateGlobalUnitCounts(northRentableLen, config, rentableDepth, northSegments.length, northBonus);
  const northCounts = distributeUnitsToSegments(
      northGlobal,
      northSegments.map(s => ({ len: s.len, isCorner: s.isCorner, bonusArea: s.bonusArea })),
      config,
      rentableDepth,
      placeLargerUnitsAtEnds
  );

  // South Distribution
  const southRentableLen = southSegments.reduce((sum, s) => sum + s.len, 0);
  const southBonus = coreSide === 'South' ? coreSideTotalBonusArea : 0;
  
  const southGlobal = calculateGlobalUnitCounts(southRentableLen, config, rentableDepth, southSegments.length, southBonus);
  const southCounts = distributeUnitsToSegments(
      southGlobal,
      southSegments.map(s => ({ len: s.len, isCorner: s.isCorner, bonusArea: s.bonusArea })),
      config,
      rentableDepth,
      placeLargerUnitsAtEnds
  );

  const allSegments = [...northSegments, ...southSegments];
  const segmentCountsList = [...northCounts, ...southCounts];


  // --- 6. Generate Units Geometry ---
  let units: UnitBlock[] = [];
  
  allSegments.forEach((seg, idx) => {
    const counts = segmentCountsList[idx];
    const y = seg.isSouth ? (rentableDepth + corridorWidth) : 0;
    
    const newUnits = generateUnitSegment(seg.x, y, seg.len, counts, seg.pattern, config, rentableDepth, seg.extraWidth, seg.bonusArea);
    units.push(...newUnits);
  });

  // --- 7. Apply Alignment ---
  // Align the Clear Side (Slave) to the Core Side (Master)
  if (alignment > 0) {
     const northUnits = units.filter(u => u.y === 0);
     const southUnits = units.filter(u => u.y > 0);
     
     let alignedUnits: UnitBlock[] = [];
     
     if (coreSide === 'North') {
        // North is Master. Align South to North.
        const alignedSouth = applyWallAlignment(southUnits, northUnits, alignment, config, rentableDepth);
        alignedUnits = [...northUnits, ...alignedSouth];
     } else {
        // South is Master. Align North to South.
        const alignedNorth = applyWallAlignment(northUnits, southUnits, alignment, config, rentableDepth);
        alignedUnits = [...alignedNorth, ...southUnits];
     }
     units = alignedUnits;
  }

  // --- 8. Apply Core Wrapping (L-Shapes) ---
  // Apply only to Core Side
  if (gapHeight > 1) { 
      // Filter units on the core side
      const coreSideUnits = units.filter(u => coreSide === 'North' ? u.y === 0 : u.y > 0);
      
      const processWrapping = (unitList: UnitBlock[], coreList: CoreBlock[], isSouth: boolean) => {
          coreList.forEach(core => {
              // Find unit immediately to LEFT of core
              const leftUnit = unitList.find(u => Math.abs((u.x + u.width) - core.x) < 0.1);
              if (leftUnit) {
                 // Add Gap Rect
                 const gapY = isSouth ? (rentableDepth + corridorWidth + coreDepth) : 0;
                 const gapRect = {
                     x: core.x,
                     y: gapY,
                     width: core.width,
                     depth: gapHeight
                 };
                 
                 if (!leftUnit.rects) leftUnit.rects = [{x: leftUnit.x, y: leftUnit.y, width: leftUnit.width, depth: leftUnit.depth}];
                 leftUnit.rects.push(gapRect);
                 
                 // Generate Poly Points for Visuals
                 if (isSouth) {
                     // South core wrapping logic
                     // Core starts at corridor line (rentableDepth + corridorWidth)
                     // Gap fills the space *after* the core (if coreDepth < rentableDepth)
                     // Wait, in South side:
                     // Unit Y = rentableDepth + corridorWidth.
                     // Core Y = rentableDepth + corridorWidth. 
                     // Rentable Depth extends to buildingDepth.
                     // If Core Depth < Rentable Depth, the gap is at the *bottom* (exterior).
                     // So Gap Y = Core Y + Core Height.
                     const uY = leftUnit.y; 
                     leftUnit.polyPoints = `
                        ${leftUnit.x},${uY} 
                        ${leftUnit.x + leftUnit.width},${uY} 
                        ${leftUnit.x + leftUnit.width},${uY + coreDepth}
                        ${leftUnit.x + leftUnit.width + core.width},${uY + coreDepth}
                        ${leftUnit.x + leftUnit.width + core.width},${uY + leftUnit.depth}
                        ${leftUnit.x},${uY + leftUnit.depth}
                     `;

                 } else {
                     // North core wrapping logic
                     // Unit Y = 0.
                     // Core Y = rentableDepth - coreDepth.
                     // Gap is at Y=0, Height = gapHeight.
                     const uY = leftUnit.y;
                     leftUnit.polyPoints = `
                        ${leftUnit.x},${uY}
                        ${leftUnit.x + leftUnit.width + core.width},${uY}
                        ${leftUnit.x + leftUnit.width + core.width},${uY + gapHeight}
                        ${leftUnit.x + leftUnit.width},${uY + gapHeight}
                        ${leftUnit.x + leftUnit.width},${uY + leftUnit.depth}
                        ${leftUnit.x},${uY + leftUnit.depth}
                     `;
                 }
              }
          });
      };
      
      processWrapping(coreSideUnits, cores, coreSide === 'South');
  }


  // --- 9. Corridor Adjustment (End Unit Absorption) ---
  // This logic works regardless of cores, as it finds the end units of the building.
  const END_OVERLAP = 6;
  let leftCorridorVoid = 0;
  let rightCorridorVoid = 0;

  // 9a. Calculate Left Void
  if (hasLeftEnd) {
      const northFirst = units.find(u => Math.abs(u.x) < 0.1 && u.y === 0);
      const southFirst = units.find(u => Math.abs(u.x) < 0.1 && u.y > 0.1);

      if (northFirst && southFirst) {
          const minW = Math.min(northFirst.width, southFirst.width);
          if (minW > END_OVERLAP) {
              leftCorridorVoid = minW - END_OVERLAP;
              
              // Expand North First
              if (!northFirst.rects) northFirst.rects = [{x: northFirst.x, y: northFirst.y, width: northFirst.width, depth: northFirst.depth}];
              northFirst.rects.push({
                  x: 0,
                  y: rentableDepth,
                  width: leftCorridorVoid,
                  depth: corridorWidth / 2
              });
              northFirst.area += leftCorridorVoid * (corridorWidth / 2);

              // Check if this unit already has a core wrap polygon
              if (northFirst.polyPoints) {
                  // MERGE: Unit has Core Wrap (Right) AND Corridor Wrap (Left)
                  const u = northFirst;
                  const cv = leftCorridorVoid;
                  const gapH = rentableDepth - coreDepth;
                  const cw = corridorWidth;
                  // North Dual Poly
                  northFirst.polyPoints = `0,0 ${u.width + coreWidth},0 ${u.width + coreWidth},${gapH} ${u.width},${gapH} ${u.width},${u.depth} ${cv},${u.depth} ${cv},${u.depth + cw/2} 0,${u.depth + cw/2}`;
              } else {
                  if(!northFirst.polyPoints?.includes(',')) {
                      northFirst.polyPoints = `0,0 ${northFirst.width},0 ${northFirst.width},${northFirst.depth} ${leftCorridorVoid},${northFirst.depth} ${leftCorridorVoid},${northFirst.depth + corridorWidth/2} 0,${northFirst.depth + corridorWidth/2}`;
                  }
              }

              // Expand South First
              if (!southFirst.rects) southFirst.rects = [{x: southFirst.x, y: southFirst.y, width: southFirst.width, depth: southFirst.depth}];
              southFirst.rects.push({
                  x: 0,
                  y: rentableDepth + (corridorWidth / 2),
                  width: leftCorridorVoid,
                  depth: corridorWidth / 2
              });
              southFirst.area += leftCorridorVoid * (corridorWidth / 2);
              
              if (southFirst.polyPoints) {
                   // MERGE: South Unit has Core Wrap (Right) AND Corridor Wrap (Left)
                   const u = southFirst;
                   const cv = leftCorridorVoid;
                   // Core Wrap Gap is at Bottom-Right (Y = d+cw+coreD to 2d+cw)
                   // Corridor Wrap is Top-Left (Y = d+cw/2 to d+cw)
                   // Unit Body is (0, d+cw) to (w, 2d+cw)
                   
                   const d = rentableDepth;
                   const cw = corridorWidth;
                   const uY = d + cw; // Unit Top Y
                   const uBottom = uY + d; // Unit Bottom Y
                   const coreD = coreDepth;
                   
                   // Poly Path:
                   // Start Top Left of Corridor Wrap
                   southFirst.polyPoints = `0,${d + cw/2} ${cv},${d + cw/2} ${cv},${uY} ${u.width},${uY} ${u.width},${uY + coreD} ${u.width + coreWidth},${uY + coreD} ${u.width + coreWidth},${uBottom} 0,${uBottom}`;

              } else {
                  if(!southFirst.polyPoints?.includes(',')) {
                    southFirst.polyPoints = `0,${rentableDepth + corridorWidth/2} ${leftCorridorVoid},${rentableDepth + corridorWidth/2} ${leftCorridorVoid},${rentableDepth + corridorWidth} ${southFirst.width},${rentableDepth + corridorWidth} ${southFirst.width},${rentableDepth + corridorWidth + southFirst.depth} 0,${rentableDepth + corridorWidth + southFirst.depth}`;
                  }
              }
          }
      }
  }

  // 9b. Calculate Right Void
  if (hasRightEnd) {
      const northLast = units.find(u => Math.abs((u.x + u.width) - length) < 0.1 && u.y === 0);
      const southLast = units.find(u => Math.abs((u.x + u.width) - length) < 0.1 && u.y > 0.1);

      if (northLast && southLast) {
          const minW = Math.min(northLast.width, southLast.width);
          if (minW > END_OVERLAP) {
              rightCorridorVoid = minW - END_OVERLAP;
              const startX = length - rightCorridorVoid;

              // Expand North Last
              if (!northLast.rects) northLast.rects = [{x: northLast.x, y: northLast.y, width: northLast.width, depth: northLast.depth}];
              northLast.rects.push({
                  x: startX,
                  y: rentableDepth,
                  width: rightCorridorVoid,
                  depth: corridorWidth / 2
              });
              northLast.area += rightCorridorVoid * (corridorWidth / 2);
              const nlX = northLast.x;
              if(!northLast.polyPoints?.includes(',')) {
                northLast.polyPoints = `${nlX},0 ${length},0 ${length},${rentableDepth + corridorWidth/2} ${startX},${rentableDepth + corridorWidth/2} ${startX},${rentableDepth} ${nlX},${rentableDepth}`;
              }

              // Expand South Last
              if (!southLast.rects) southLast.rects = [{x: southLast.x, y: southLast.y, width: southLast.width, depth: southLast.depth}];
              southLast.rects.push({
                  x: startX,
                  y: rentableDepth + (corridorWidth / 2),
                  width: rightCorridorVoid,
                  depth: corridorWidth / 2
              });
              southLast.area += rightCorridorVoid * (corridorWidth / 2);
              const slX = southLast.x;
              if(!southLast.polyPoints?.includes(',')) {
                southLast.polyPoints = `${slX},${rentableDepth + corridorWidth} ${startX},${rentableDepth + corridorWidth} ${startX},${rentableDepth + corridorWidth/2} ${length},${rentableDepth + corridorWidth/2} ${length},${rentableDepth + corridorWidth + southLast.depth} ${slX},${rentableDepth + corridorWidth + southLast.depth}`;
              }
          }
      }
  }

  // --- 10. Calculate Stats ---
  const totalGSF = length * buildingDepth;
  const unitCounts = { [UnitType.Studio]: 0, [UnitType.OneBed]: 0, [UnitType.TwoBed]: 0, [UnitType.ThreeBed]: 0 };
  let nrsf = 0;

  units.forEach(u => {
    unitCounts[u.type]++;
    nrsf += u.area;
  });

  const totalUnits = getTotal(unitCounts);
  const efficiency = totalGSF > 0 ? nrsf / totalGSF : 0;

  // --- 11. Egress Validation ---
  
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
  } else {
      deadEndStatus = 'Fail';
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


  return {
    units,
    cores,
    corridor: [{
      x: leftCorridorVoid,
      y: rentableDepth,
      width: length - leftCorridorVoid - rightCorridorVoid,
      height: corridorWidth
    }],
    length,
    width: buildingDepth,
    shape: 'Bar',
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
};

const generateLLayout = (
  lengthA: number,
  lengthB: number,
  config: UnitConfiguration,
  alignment: number,
  placeLargerUnitsAtEnds: boolean,
  coreWidth: number,
  coreDepth: number,
  buildingDepth: number,
  corridorWidth: number,
  egressConfig: EgressConfig,
  coreSide: 'North' | 'South',
  angle: number = 90
): FloorPlanData => {
  // Derive geometric constraints
  const rentableDepth = (buildingDepth - corridorWidth) / 2;
  
  // Calculate Geometric Offset (distance from Pivot to Apex S along the wall)
  const rotation = 180 - angle;
  const rad = (rotation * Math.PI) / 180;
  const tanHalf = Math.tan(rad / 2);
  const geoOffset = buildingDepth * tanHalf;

  // Calculate Target Corner Leg
  // We want a corner unit of roughly TARGET_AREA.
  // For flat angles (small offset), we need a longer leg to get area.
  // For sharp angles (large offset), the geometric wedge provides area.
  const targetCornerArea = config[UnitType.ThreeBed].area;
  
  // Estimate area provided by the geometric wedge (approximate)
  // Wedge Area ~= offset * buildingDepth
  // If Wedge Area < Target, we need to extend legs.
  // Area = Leg * Depth. Leg = Area / Depth.
  // We use rentableDepth as a conservative depth estimate.
  const targetLeg = Math.max(35, targetCornerArea / buildingDepth);
  
  // Calculate "Steal" - how much we need to shorten the bars beyond the geometric pivot
  // to make room for the corner unit.
  const steal = Math.max(0, targetLeg - geoOffset);
  
  // 1. Generate Wing A (Horizontal)
  // Pivot is at lengthA - geoOffset
  // Bar A ends at Pivot - steal
  const pivotX = lengthA - geoOffset;
  const effectiveLengthA = Math.max(pivotX - steal, 50);
  
  // Generate Wing A layout
  const barA = generateBarLayout(
    effectiveLengthA,
    config,
    alignment,
    placeLargerUnitsAtEnds,
    coreWidth,
    coreDepth,
    buildingDepth,
    corridorWidth,
    egressConfig,
    coreSide,
    true, // hasLeftEnd
    false // hasRightEnd (Connected to corner)
  );

  // 2. Generate Wing B (Vertical)
  // PivotY relative to B start is geoOffset
  // Bar B length = lengthB - geoOffset - steal
  const effectiveLengthB = Math.max(lengthB - geoOffset - steal, 50);
  
  // Force "valley" pattern for Wing B to ensure larger units at ends (Top and Bottom)
  // The generateBarLayout function uses 'valley' for mid segments and 'desc'/'asc' for ends.
  // We want to ensure the "Bottom" of Wing B (which is its Right End in bar logic) gets a large unit.
  
  // We need to pass a flag or configuration to generateBarLayout to enforce this specific pattern for Wing B
  // Currently generateBarLayout infers patterns based on `placeLargerUnitsAtEnds`.
  // If `placeLargerUnitsAtEnds` is true:
  // - Left Corner: Valley (Large -> Small -> Large? No, Valley is Large-Small-Large usually? Wait.)
  // Let's check generateBarLayout logic:
  // const leftCornerPattern: PatternStrategy = placeLargerUnitsAtEnds ? 'valley' : 'asc';
  // const rightCornerPattern: PatternStrategy = placeLargerUnitsAtEnds ? 'valley-inverted' : 'desc';
  
  // 'valley' strategy: [Left, Right.reverse()] -> Large units at edges of the segment?
  // inventoryList is sorted Large -> Small.
  // Valley: 0 (Large) -> Left, 1 (Large) -> Right. 
  // So Valley puts largest units at BOTH ends of the segment.
  
  // Wing B is generated as a horizontal bar then rotated.
  // Left End = Top (connected to corner). Right End = Bottom (free end).
  // We want Large units at the Bottom (Right End).
  
  // If we treat Wing B as a bar with NO Left End (because it connects to corner),
  // generateBarLayout will create:
  // - Mid Segment (starts at 0)
  // - Right Corner Segment (ends at length)
  
  // We want the Right Corner Segment to have large units at the far end.
  // rightCornerPattern = 'valley-inverted' (if placeLargerUnitsAtEnds=true)
  // valley-inverted: [Right, Left.reverse()] -> Large units at Right?
  // inventoryList: L, L, M, S...
  // 0 (L) -> Right. 1 (L) -> Left.
  // So 'valley-inverted' puts largest unit at the Right end of the segment.
  
  // So if placeLargerUnitsAtEnds is true, we should get a large unit at the bottom.
  // However, the issue might be that the segment is too short or the distribution logic fails.
  
  // Let's force `placeLargerUnitsAtEnds` to true for Wing B explicitly.
  const barB = generateBarLayout(
    effectiveLengthB,
    config,
    alignment,
    true, // FORCE placeLargerUnitsAtEnds = true for Wing B
    coreWidth,
    coreDepth,
    buildingDepth,
    corridorWidth,
    egressConfig,
    coreSide,
    false, // hasLeftEnd (Connected to corner, becomes Top)
    true   // hasRightEnd (Bottom)
  );

  // 3. Merge and Transform
  const units: UnitBlock[] = [];
  const cores: CoreBlock[] = [];
  const corridors: CorridorBlock[] = [];

  // Transform Wing A (Keep as is)
  units.push(...barA.units.map(u => ({ ...u, id: `A-${u.id}` })));
  cores.push(...barA.cores.map(c => ({ ...c, id: `A-${c.id}` })));
  corridors.push(...barA.corridor);

  // TRANSFORM FUNCTION FOR WING B
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  const pivotY = buildingDepth;

  const rotatePt = (x: number, y: number) => {
      const dx = x;
      const dy = y - buildingDepth;
      return {
          x: (dx * cos - dy * sin) + pivotX,
          y: (dx * sin + dy * cos) + pivotY
      };
  };

  const transformB = (block: {x: number, y: number, width: number, depth?: number, height?: number, polyPoints?: string}) => {
      // Shift X by steal to make room for corner unit
      const shiftedX = block.x + steal;
      
      let polyString: string | undefined = undefined;

      if (block.polyPoints) {
          // Parse existing polyPoints
          // Handle both space and newline separators just in case
          const points = block.polyPoints.trim().split(/\s+/).map(p => {
              const [x, y] = p.split(',').map(Number);
              return rotatePt(x + steal, y);
          });
          polyString = points.map(p => `${p.x},${p.y}`).join(' ');
      } else {
          // Create polyPoints from Rect
          const bX = shiftedX;
          const bY = block.y;
          const bW = block.width;
          const bH = block.depth || block.height || 0;
          
          const corners = [
              {x: bX, y: bY},
              {x: bX + bW, y: bY},
              {x: bX + bW, y: bY + bH},
              {x: bX, y: bY + bH}
          ];
          
          const rotatedCorners = corners.map(p => rotatePt(p.x, p.y));
          polyString = rotatedCorners.map(p => `${p.x},${p.y}`).join(' ');
      }
      
      // Calculate bounding box from the new polyString
      const points = polyString!.split(' ').map(p => {
          const [x, y] = p.split(',').map(Number);
          return {x, y};
      });
      
      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      
      return {
          x: minX,
          y: minY,
          width: maxX - minX,
          depth: maxY - minY,
          polyPoints: polyString,
          rotation: 0 
      };
  };

  // Transform Units
  barB.units.forEach(u => {
      const t = transformB(u);
      units.push({
          ...u,
          id: `B-${u.id}`,
          x: t.x,
          y: t.y,
          width: t.width,
          depth: t.depth,
          polyPoints: t.polyPoints,
          rotation: t.rotation,
          rects: undefined 
      });
  });

  // Transform Cores
  barB.cores.forEach(c => {
      const t = transformB({...c, depth: c.height});
      cores.push({
          ...c,
          id: `B-${c.id}`,
          x: t.x,
          y: t.y,
          width: t.width,
          height: t.depth, 
          rotation: t.rotation,
          polyPoints: t.polyPoints
      });
  });

  // Transform Corridor
  barB.corridor.forEach(c => {
      const t = transformB({...c, depth: c.height});
      corridors.push({
          x: t.x,
          y: t.y,
          width: t.width,
          height: t.depth,
          rotation: t.rotation,
          polyPoints: t.polyPoints
      });
  });

  // 4. Generate Corner Intersection (Wedge)
  const cornerX = effectiveLengthA;
  
  // Calculate R (B Top-Left Rotated, shifted by steal)
  const rPoint = rotatePt(steal, 0);
  const rX = rPoint.x;
  const rY = rPoint.y;
  
  let sX = rX;
  let sY = 0;
  
  // Calculate Outer Intersection S
  // Line A Top: y = 0
  // Line B Top: Passes through R(rX, rY) with slope tan(rad)
  // x = rX + (y - rY) / tan(rad)
  // At y=0: sX = rX - rY / tan(rad)
  
  // Handle parallel lines (180 deg)
  if (Math.abs(rotation) > 0.1 && Math.abs(rotation - 180) > 0.1) {
      const tan = Math.tan(rad);
      sX = rX - (rY / tan);
      sY = 0;
  }

  // CORRIDOR CONNECTION
  const aCorrTop = {x: cornerX, y: rentableDepth};
  const aCorrBot = {x: cornerX, y: rentableDepth + corridorWidth};
  
  const bCorrTop = rotatePt(steal, rentableDepth);
  const bCorrBot = rotatePt(steal, rentableDepth + corridorWidth);
  
  let sCorrTop = {x: cornerX, y: rentableDepth}; 
  let sCorrBot = {x: cornerX, y: rentableDepth + corridorWidth};
  
  if (Math.abs(rotation) > 1) {
      const tan = Math.tan(rad);
      sCorrTop = {
          x: bCorrTop.x + (rentableDepth - bCorrTop.y) / tan,
          y: rentableDepth
      };
      sCorrBot = {
          x: bCorrBot.x + (rentableDepth + corridorWidth - bCorrBot.y) / tan,
          y: rentableDepth + corridorWidth
      };
  }
  
  // Corridor Wedge Polygon
  const corrPoly = `${aCorrTop.x},${aCorrTop.y} ${sCorrTop.x},${sCorrTop.y} ${bCorrTop.x},${bCorrTop.y} ${bCorrBot.x},${bCorrBot.y} ${sCorrBot.x},${sCorrBot.y} ${aCorrBot.x},${aCorrBot.y}`;
  
  units.push({
      id: 'corner-corridor',
      type: 'Corridor' as any, 
      x: cornerX,
      y: 0,
      width: 0,
      depth: 0,
      area: 0,
      color: COLORS.Corridor,
      polyPoints: corrPoly
  });
  
  // CORNER CORE (Inner Wedge)
  // We need to fill the gap between Bar A end, Bar B start, and the corridor intersection.
  // Points:
  // 1. Bar A Inner Corner (effectiveLengthA, buildingDepth)
  // 2. Bar A Corridor Corner (aCorrBot)
  // 3. Corridor Intersection (sCorrBot)
  // 4. Bar B Corridor Corner (bCorrBot)
  // 5. Bar B Inner Corner (rotatePt(steal, buildingDepth))
  
  const aInnerCorner = {x: cornerX, y: buildingDepth};
  const bInnerCorner = rotatePt(steal, buildingDepth);
  
  const corePoly = `${aInnerCorner.x},${aInnerCorner.y} ${aCorrBot.x},${aCorrBot.y} ${sCorrBot.x},${sCorrBot.y} ${bCorrBot.x},${bCorrBot.y} ${bInnerCorner.x},${bInnerCorner.y}`;
  
  units.push({
      id: 'corner-core-visual',
      type: 'Core' as any,
      x: pivotX,
      y: pivotY,
      width: 0,
      depth: 0,
      area: 0,
      color: COLORS.Core,
      polyPoints: corePoly
  });
  
  // --- CORNER UNIT SUBDIVISION ---
  // We have the outer wedge defined by Q(cornerX, 0), S(sX, 0), R(rX, rY).
  // And inner boundary defined by A_Corr_Top, S_Corr_Top, B_Corr_Top.
  
  const Q = {x: cornerX, y: 0};
  const S = {x: sX, y: 0};
  const R = {x: rX, y: rY};
  
  // Calculate lengths along the outer edge
  const dist = (p1: {x:number, y:number}, p2: {x:number, y:number}) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  
  const lenA = dist(Q, S);
  const lenB = dist(R, S);
  
  // Iterative sizing for Corner Unit
  // At large angles, the wedge is huge, so we need shorter legs.
  // We start with a target leg, check area, and shrink if needed.
  
  // Calculate minimum leg length to ensure unit connects to corridor
  // For acute angles, the corridor intersection is far from the apex.
  // We need the unit to wrap around the corridor tip.
  // Distance from Apex S to Corridor Tip S_Corr
  // Angle of the corner is `angle`.
  // dist = RentableDepth / tan(angle/2)
  const angleRad = (angle * Math.PI) / 180;
  const distToCorr = rentableDepth / Math.tan(angleRad / 2);
  
  // We need a "neck" width for the unit to connect to the corridor.
  // Let's say min neck is 6ft.
  // So we need to start at least slightly before the corridor tip.
  // Actually, if we set leg = distToCorr, width is 0.
  // So we need leg > distToCorr.
  // Let's ensure at least 10ft of corridor frontage if possible.
  const dynamicMinLeg = distToCorr + 5; 
  
  let cornerLeg = Math.max(35, dynamicMinLeg); 
  const MIN_CORNER_LEG = Math.max(20, dynamicMinLeg);
  
  const TARGET_AREA = config[UnitType.ThreeBed].area;
  const MAX_AREA = TARGET_AREA * 1.25; // Allow 25% overage
  
  let splitA = Q;
  let splitB = R;
  let hasFillerA = false;
  let hasFillerB = false;
  let unitPoly = '';
  let area = 0;
  let innerStart = bCorrTop;
  let innerEnd = aCorrTop;
  
  // Optimization Loop
  // We want the corner unit to be close to TARGET_AREA (e.g. 3-Bed size)
  // But strictly bounded by geometry constraints.
  
  const MIN_AREA = TARGET_AREA * 0.85;
  const ABS_MAX_AREA = TARGET_AREA * 1.35;
  
  // Max possible leg length is limited by the bar lengths
  const maxLegA = lenA - 15; // Ensure at least 15ft filler if we split
  const maxLegB = lenB - 15;
  const globalMaxLeg = Math.min(maxLegA, maxLegB);

  for (let i = 0; i < 10; i++) {
      const MIN_FILLER = 15;
      
      hasFillerA = false;
      hasFillerB = false;
      splitA = Q;
      splitB = R;
      
      // 1. Recalculate Split Points based on current cornerLeg
      // Only create filler if we have enough excess length
      if (lenA > cornerLeg + MIN_FILLER) {
          hasFillerA = true;
          const fillerWidth = lenA - cornerLeg;
          const vecQS = {x: S.x - Q.x, y: S.y - Q.y};
          const magQS = Math.sqrt(vecQS.x*vecQS.x + vecQS.y*vecQS.y);
          const unitQS = {x: vecQS.x/magQS, y: vecQS.y/magQS};
          
          splitA = {
              x: Q.x + unitQS.x * fillerWidth,
              y: Q.y + unitQS.y * fillerWidth
          };
      }
      
      if (lenB > cornerLeg + MIN_FILLER) {
          hasFillerB = true;
          const fillerWidth = lenB - cornerLeg;
          const vecRS = {x: S.x - R.x, y: S.y - R.y};
          const magRS = Math.sqrt(vecRS.x*vecRS.x + vecRS.y*vecRS.y);
          const unitRS = {x: vecRS.x/magRS, y: vecRS.y/magRS};
          
          splitB = {
              x: R.x + unitRS.x * fillerWidth,
              y: R.y + unitRS.y * fillerWidth
          };
      }
      
      // 2. Calculate Inner Points
      innerStart = bCorrTop;
      if (hasFillerB) {
          const vecCorr = {x: sCorrTop.x - bCorrTop.x, y: sCorrTop.y - bCorrTop.y};
          const magCorr = Math.sqrt(vecCorr.x*vecCorr.x + vecCorr.y*vecCorr.y);
          
          // Safety check for zero magnitude (should not happen unless points coincide)
          if (magCorr > 0.1) {
              const unitCorr = {x: vecCorr.x/magCorr, y: vecCorr.y/magCorr};
              const fillerWidth = lenB - cornerLeg;
              innerStart = {
                  x: bCorrTop.x + unitCorr.x * fillerWidth,
                  y: bCorrTop.y + unitCorr.y * fillerWidth
              };
          }
      }
      
      innerEnd = aCorrTop;
      if (hasFillerA) {
          innerEnd = {
              x: splitA.x,
              y: rentableDepth
          };
      }
      
      // 3. Calculate Area
      const polyPointsList = [splitA, S, splitB, innerStart, sCorrTop, innerEnd];
      area = 0;
      for (let k = 0; k < polyPointsList.length; k++) {
          const j = (k + 1) % polyPointsList.length;
          area += polyPointsList[k].x * polyPointsList[j].y;
          area -= polyPointsList[j].x * polyPointsList[k].y;
      }
      area = Math.abs(area) / 2;
      
      // 4. Check Constraints & Adjust
      let changed = false;
      
      if (area > ABS_MAX_AREA && cornerLeg > MIN_CORNER_LEG + 2) {
          // Too big, shrink
          cornerLeg -= 3;
          changed = true;
      } else if (area < MIN_AREA && cornerLeg < globalMaxLeg - 2) {
          // Too small, grow
          cornerLeg += 3;
          changed = true;
      }
      
      if (!changed) {
          // Good size or stuck
          unitPoly = `${splitA.x},${splitA.y} ${S.x},${S.y} ${splitB.x},${splitB.y} ${innerStart.x},${innerStart.y} ${sCorrTop.x},${sCorrTop.y} ${innerEnd.x},${innerEnd.y}`;
          break;
      }
  }

  // Fallback if unitPoly is still empty (loop failed to converge or produce valid poly)
  if (!unitPoly) {
       // Use the initial points without fillers
       unitPoly = `${Q.x},${Q.y} ${S.x},${S.y} ${R.x},${R.y} ${bCorrTop.x},${bCorrTop.y} ${sCorrTop.x},${sCorrTop.y} ${aCorrTop.x},${aCorrTop.y}`;
       
       // Recalculate area for stats
       const polyPointsList = [Q, S, R, bCorrTop, sCorrTop, aCorrTop];
       area = 0;
       for (let k = 0; k < polyPointsList.length; k++) {
          const j = (k + 1) % polyPointsList.length;
          area += polyPointsList[k].x * polyPointsList[j].y;
          area -= polyPointsList[j].x * polyPointsList[k].y;
       }
       area = Math.abs(area) / 2;
  }

  // Helper to pick best type for filler
  const getBestFitType = (width: number) => {
      let bestType = UnitType.OneBed;
      let minDiff = Number.MAX_VALUE;
      ([UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed] as const).forEach(t => {
          const idealW = getUnitWidth(t, config, rentableDepth);
          const diff = Math.abs(width - idealW);
          if (diff < minDiff) {
              minDiff = diff;
              bestType = t;
          }
      });
      return bestType;
  };
  
  // 1. Generate Filler A (Top Edge)
  if (hasFillerA) {
      const fillerWidth = lenA - cornerLeg;
      const fillerType = getBestFitType(fillerWidth);
      
      // Re-calculate poly for filler A using the FINAL splitA
      // We know splitA is the end of the filler.
      // Start is Q.
      // Inner points: (Q.x, rentableDepth) and (splitA.x, rentableDepth)
      
      const fillerAPoly = `${Q.x},${Q.y} ${splitA.x},${splitA.y} ${splitA.x},${rentableDepth} ${Q.x},${rentableDepth}`;
      
      units.push({
          id: 'corner-filler-A',
          type: fillerType,
          x: Q.x,
          y: Q.y,
          width: fillerWidth,
          depth: rentableDepth,
          area: fillerWidth * rentableDepth,
          color: COLORS[fillerType],
          polyPoints: fillerAPoly
      });
  }
  
  // 2. Generate Filler B (Rotated Edge)
  if (hasFillerB) {
      const fillerWidth = lenB - cornerLeg;
      const fillerType = getBestFitType(fillerWidth);
      
      // Re-calculate inner point for Filler B
      // It is `fillerWidth` away from B_Corr_Top along the corridor line.
      const vecCorr = {x: sCorrTop.x - bCorrTop.x, y: sCorrTop.y - bCorrTop.y};
      const magCorr = Math.sqrt(vecCorr.x*vecCorr.x + vecCorr.y*vecCorr.y);
      const unitCorr = {x: vecCorr.x/magCorr, y: vecCorr.y/magCorr};
      
      const splitB_Inner = {
          x: bCorrTop.x + unitCorr.x * fillerWidth,
          y: bCorrTop.y + unitCorr.y * fillerWidth
      };
      
      const fillerBPoly = `${R.x},${R.y} ${splitB.x},${splitB.y} ${splitB_Inner.x},${splitB_Inner.y} ${bCorrTop.x},${bCorrTop.y}`;
      
      units.push({
          id: 'corner-filler-B',
          type: fillerType,
          x: R.x,
          y: R.y,
          width: fillerWidth,
          depth: rentableDepth,
          area: fillerWidth * rentableDepth,
          color: COLORS[fillerType],
          polyPoints: fillerBPoly
      });
  }
  
  // 3. Corner Unit (Remaining Wedge)
  // Already calculated in the loop


  units.push({
      id: 'corner-unit-L',
      type: UnitType.ThreeBed,
      x: cornerX, 
      y: 0,       
      width: buildingDepth, 
      depth: buildingDepth, 
      area: area,
      color: COLORS[UnitType.ThreeBed],
      polyPoints: unitPoly
  });

  return {
    units,
    cores,
    corridor: corridors,
    length: lengthA, 
    width: lengthB, 
    shape: 'L',
    stats: {
        gsf: barA.stats.gsf + barB.stats.gsf + area, 
        nrsf: barA.stats.nrsf + barB.stats.nrsf + area,
        efficiency: 0.85,
        unitCounts: {
            ...barA.stats.unitCounts,
            [UnitType.ThreeBed]: barA.stats.unitCounts[UnitType.ThreeBed] + barB.stats.unitCounts[UnitType.ThreeBed] + 1,
            [UnitType.TwoBed]: barA.stats.unitCounts[UnitType.TwoBed] + barB.stats.unitCounts[UnitType.TwoBed],
            [UnitType.OneBed]: barA.stats.unitCounts[UnitType.OneBed] + barB.stats.unitCounts[UnitType.OneBed],
            [UnitType.Studio]: barA.stats.unitCounts[UnitType.Studio] + barB.stats.unitCounts[UnitType.Studio]
        },
        totalUnits: barA.stats.totalUnits + barB.stats.totalUnits + 1
    },
    egress: barA.egress 
  };
};



const generateWLayout = (
  lengthA: number,
  lengthB: number,
  lengthC: number,
  config: UnitConfiguration,
  alignment: number,
  placeLargerUnitsAtEnds: boolean,
  coreWidth: number,
  coreDepth: number,
  buildingDepth: number,
  corridorWidth: number,
  egressConfig: EgressConfig,
  coreSide: 'North' | 'South',
  angle: number = 90
): FloorPlanData => {
  // Derive geometric constraints
  const rentableDepth = (buildingDepth - corridorWidth) / 2;
  
  // --- GEOMETRY CALCULATIONS ---
  // We assume symmetric corners for simplicity
  const rotation = 180 - angle;
  const rad = (rotation * Math.PI) / 180;
  const tanHalf = Math.tan(rad / 2);
  const geoOffset = buildingDepth * tanHalf;

  const targetCornerArea = config[UnitType.ThreeBed].area;
  const targetLeg = Math.max(35, targetCornerArea / buildingDepth);
  const steal = Math.max(0, targetLeg - geoOffset);

  // 1. Generate Wing A (Horizontal)
  const pivotA_X = lengthA - geoOffset;
  const effectiveLengthA = Math.max(pivotA_X - steal, 50);
  
  const barA = generateBarLayout(
    effectiveLengthA,
    config,
    alignment,
    placeLargerUnitsAtEnds,
    coreWidth,
    coreDepth,
    buildingDepth,
    corridorWidth,
    egressConfig,
    coreSide,
    true, // hasLeftEnd
    false // hasRightEnd (Connected to corner)
  );

  // 2. Generate Wing B (Rotated Down)
  // We define lengthB as the length of the Right Edge of Wing B (connecting Pivot 1 to Outer Vertex 2).
  // This is the "Inner-to-Outer" length.
  
  // Effective Length: 
  // Start: Steal (from Pivot 1)
  // End: LengthB - Steal (from IV2)
  const effectiveLengthB = Math.max(lengthB - 2 * steal, 50);
  
  const barB = generateBarLayout(
    effectiveLengthB,
    config,
    alignment,
    true, // Force larger units at ends
    coreWidth,
    coreDepth,
    buildingDepth,
    corridorWidth,
    egressConfig,
    coreSide,
    false, // No Left End
    false  // No Right End
  );

  // 3. Generate Wing C (Rotated Up - ZigZag)
  // Similar to Wing A, it connects at one end.
  const effectiveLengthC = Math.max(lengthC - geoOffset - steal, 50);

  const barC = generateBarLayout(
    effectiveLengthC,
    config,
    alignment,
    placeLargerUnitsAtEnds,
    coreWidth,
    coreDepth,
    buildingDepth,
    corridorWidth,
    egressConfig,
    coreSide,
    false, // No Left End (Connected to corner)
    true   // hasRightEnd
  );

  // --- TRANSFORMATIONS ---
  const units: UnitBlock[] = [];
  const cores: CoreBlock[] = [];
  const corridors: CorridorBlock[] = [];

  // 1. Add Bar A (No Transform)
  units.push(...barA.units.map(u => ({ ...u, id: `A-${u.id}` })));
  cores.push(...barA.cores.map(c => ({ ...c, id: `A-${c.id}` })));
  corridors.push(...barA.corridor);

  // 2. Transform Bar B
  // Rotate 'rad' (Down)
  const cos1 = Math.cos(rad);
  const sin1 = Math.sin(rad);
  const pivot1_Y = buildingDepth; // Pivot 1 is (pivotA_X, buildingDepth)

  const rotatePt1 = (x: number, y: number) => {
      const dx = x;
      // In Bar B generation, y=0 is Top, y=depth is Bottom.
      // We want y=depth (Bottom) to map to the Pivot Line (Inner Edge) which passes through Pivot 1.
      // So we subtract buildingDepth from y.
      // If y=buildingDepth, dy=0 -> Point is on Pivot Line.
      const dy = y - buildingDepth;
      return {
          x: (dx * cos1 - dy * sin1) + pivotA_X,
          y: (dx * sin1 + dy * cos1) + pivot1_Y
      };
  };

  const startOffsetB = steal;

  const transformB = (block: {x: number, y: number, width: number, depth?: number, height?: number, polyPoints?: string}) => {
      const shiftedX = block.x + startOffsetB;
      
      let polyString: string | undefined = undefined;
      if (block.polyPoints) {
          const points = block.polyPoints.trim().split(/\s+/).map(p => {
              const [x, y] = p.split(',').map(Number);
              return rotatePt1(x + startOffsetB, y);
          });
          polyString = points.map(p => `${p.x},${p.y}`).join(' ');
      } else {
          const bX = shiftedX;
          const bY = block.y;
          const bW = block.width;
          const bH = block.depth || block.height || 0;
          const corners = [{x: bX, y: bY}, {x: bX + bW, y: bY}, {x: bX + bW, y: bY + bH}, {x: bX, y: bY + bH}];
          const rotatedCorners = corners.map(p => rotatePt1(p.x, p.y));
          polyString = rotatedCorners.map(p => `${p.x},${p.y}`).join(' ');
      }
      
      const points = polyString!.split(' ').map(p => { const [x, y] = p.split(',').map(Number); return {x, y}; });
      const xs = points.map(p => p.x); const ys = points.map(p => p.y);
      return {
          x: Math.min(...xs), y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys),
          polyPoints: polyString, rotation: 0
      };
  };

  barB.units.forEach(u => { const t = transformB(u); units.push({ ...u, id: `B-${u.id}`, x: t.x, y: t.y, width: t.width, depth: t.depth, polyPoints: t.polyPoints, rects: undefined }); });
  barB.cores.forEach(c => { const t = transformB({...c, depth: c.height}); cores.push({ ...c, id: `B-${c.id}`, x: t.x, y: t.y, width: t.width, height: t.depth, polyPoints: t.polyPoints }); });
  barB.corridor.forEach(c => { const t = transformB({...c, depth: c.height}); corridors.push({ x: t.x, y: t.y, width: t.width, height: t.depth, polyPoints: t.polyPoints }); });

  // 3. Transform Bar C
  // Calculate Inner Vertex 2 (IV2)
  // IV2 is at the end of Wing B's inner edge.
  // In Bar B's local coordinate system, the inner edge is y=0 (Left side for Left Turn).
  // Wait, for a Left Turn, the inner edge is on the left side of the corridor.
  // In Bar B generation, y=0 is the Top edge, y=depth is the Bottom edge.
  // When rotated down (e.g., 90 deg), Top becomes Right, Bottom becomes Left.
  // So y=depth is the Left edge (Inner for Left Turn).
  // Let's verify: rotatePt1 maps y=buildingDepth to the Pivot 1 line.
  // So y=buildingDepth is the Inner edge for Corner 1 (Right Turn).
  // For Corner 2 (Left Turn), the Inner edge is the OTHER side of Wing B.
  // That means the Inner edge for Corner 2 is y=0 in Bar B's local space.
  
  // Let's re-evaluate the vertices for Corner 2 (Left Turn).
  // Wing B is rotated by `rad` (e.g., 90 deg down).
  // Left edge of Wing B (looking down) is y=0. Right edge is y=buildingDepth.
  // A Left Turn means Wing C goes to the left.
  // So the Inner Vertex (IV2) connects the Left edge of B (y=0) to the Top edge of C.
  // The Outer Vertex (OV2) connects the Right edge of B (y=buildingDepth) to the Bottom edge of C.
  
  // IV2 is at distance lengthB along the Left edge (y=0) of Wing B.
  const IV2 = rotatePt1(lengthB, 0);
  
  // OV2 is at distance lengthB + geoOffset along the Right edge (y=buildingDepth) of Wing B.
  // Wait, if it's a symmetric corner, the outer edge is longer.
  // Let's use the intersection logic to be precise.
  // C-Top (Inner) is a horizontal line passing through IV2.
  // C-Bottom (Outer) is a horizontal line at y = IV2.y + buildingDepth.
  // B-Right (Outer) is a line passing through rotatePt1(0, buildingDepth) with slope tan(rad).
  
  const cOuterY = IV2.y + buildingDepth;
  const bOuterOrigin = rotatePt1(0, buildingDepth);
  const tan = Math.tan(rad);
  
  // Intersection of B-Right and C-Bottom
  // x = x0 + (y - y0) / tan
  let ov2X = bOuterOrigin.x;
  if (Math.abs(tan) > 0.01) {
      ov2X = bOuterOrigin.x + (cOuterY - bOuterOrigin.y) / tan;
  }
  const OV2 = { x: ov2X, y: cOuterY };

  const transformC = (block: {x: number, y: number, width: number, depth?: number, height?: number, polyPoints?: string}) => {
      // C starts at steal relative to IV2 along the C axis.
      // C is horizontal.
      // block.x starts at 0.
      // We want block.x=0 to map to IV2.x + steal.
      // block.y=0 (Top/Inner) to map to IV2.y.
      
      const startX = IV2.x + steal;
      const startY = IV2.y;
      
      const translate = (x: number, y: number) => ({
          x: x + startX,
          y: y + startY
      });
      
      let polyString: string | undefined = undefined;
      if (block.polyPoints) {
          const points = block.polyPoints.trim().split(/\s+/).map(p => {
              const [x, y] = p.split(',').map(Number);
              return translate(x, y);
          });
          polyString = points.map(p => `${p.x},${p.y}`).join(' ');
      } else {
          const bX = block.x;
          const bY = block.y;
          const bW = block.width;
          const bH = block.depth || block.height || 0;
          const corners = [{x: bX, y: bY}, {x: bX + bW, y: bY}, {x: bX + bW, y: bY + bH}, {x: bX, y: bY + bH}];
          const rotatedCorners = corners.map(p => translate(p.x, p.y));
          polyString = rotatedCorners.map(p => `${p.x},${p.y}`).join(' ');
      }
      const points = polyString!.split(' ').map(p => { const [x, y] = p.split(',').map(Number); return {x, y}; });
      const xs = points.map(p => p.x); const ys = points.map(p => p.y);
      return {
          x: Math.min(...xs), y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys),
          polyPoints: polyString, rotation: 0
      };
  };

  barC.units.forEach(u => { const t = transformC(u); units.push({ ...u, id: `C-${u.id}`, x: t.x, y: t.y, width: t.width, depth: t.depth, polyPoints: t.polyPoints, rects: undefined }); });
  barC.cores.forEach(c => { const t = transformC({...c, depth: c.height}); cores.push({ ...c, id: `C-${c.id}`, x: t.x, y: t.y, width: t.width, height: t.depth, polyPoints: t.polyPoints }); });
  barC.corridor.forEach(c => { const t = transformC({...c, depth: c.height}); corridors.push({ x: t.x, y: t.y, width: t.width, height: t.depth, polyPoints: t.polyPoints }); });

  // --- CORNERS ---
  
  // Helper: Distance
  const dist = (p1: {x:number, y:number}, p2: {x:number, y:number}) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

  // --- CORNER 1 (A -> B, Right Turn) ---
  // Identical to L-Shape Corner
  {
      const cornerX = effectiveLengthA;
      const Q = {x: cornerX, y: 0}; // A Top Right (Outer)
      
      // Calculate R (B Top-Left Rotated, shifted by steal)
      // B starts at steal relative to Pivot 1
      const rPoint = rotatePt1(steal, 0);
      const rX = rPoint.x;
      const rY = rPoint.y;
      const R = {x: rX, y: rY}; // B Top Left (Outer)

      // Calculate S (Outer Intersection)
      let sX = rX;
      let sY = 0;
      if (Math.abs(rotation) > 0.1 && Math.abs(rotation - 180) > 0.1) {
          const tan = Math.tan(rad);
          sX = rX - (rY / tan);
      }
      const S = {x: sX, y: 0};

      // Corridor Points
      const aCorrTop = {x: cornerX, y: rentableDepth};
      const aCorrBot = {x: cornerX, y: rentableDepth + corridorWidth};
      
      const bCorrTop = rotatePt1(steal, rentableDepth);
      const bCorrBot = rotatePt1(steal, rentableDepth + corridorWidth);
      
      let sCorrTop = {x: cornerX, y: rentableDepth}; 
      let sCorrBot = {x: cornerX, y: rentableDepth + corridorWidth};
      
      if (Math.abs(rotation) > 1) {
          const tan = Math.tan(rad);
          sCorrTop = {
              x: bCorrTop.x + (rentableDepth - bCorrTop.y) / tan,
              y: rentableDepth
          };
          sCorrBot = {
              x: bCorrBot.x + (rentableDepth + corridorWidth - bCorrBot.y) / tan,
              y: rentableDepth + corridorWidth
          };
      }

      // 1. Corridor Wedge
      const corrPoly = `${aCorrTop.x},${aCorrTop.y} ${sCorrTop.x},${sCorrTop.y} ${bCorrTop.x},${bCorrTop.y} ${bCorrBot.x},${bCorrBot.y} ${sCorrBot.x},${sCorrBot.y} ${aCorrBot.x},${aCorrBot.y}`;
      units.push({
          id: 'corner-1-corridor',
          type: 'Corridor' as any, 
          x: cornerX, y: 0, width: 0, depth: 0, area: 0,
          color: COLORS.Corridor,
          polyPoints: corrPoly
      });

      // 2. Core Wedge (Inner)
      const aInnerCorner = {x: cornerX, y: buildingDepth};
      const bInnerCorner = rotatePt1(steal, buildingDepth);
      const corePoly = `${aInnerCorner.x},${aInnerCorner.y} ${aCorrBot.x},${aCorrBot.y} ${sCorrBot.x},${sCorrBot.y} ${bCorrBot.x},${bCorrBot.y} ${bInnerCorner.x},${bInnerCorner.y}`;
      
      units.push({
          id: 'corner-1-core-visual',
          type: 'Core' as any,
          x: pivotA_X, y: pivot1_Y, width: 0, depth: 0, area: 0,
          color: COLORS.Core,
          polyPoints: corePoly
      });

      // 3. Corner Unit (Outer)
      // Calculate lengths along the outer edge
      const lenA = dist(Q, S);
      const lenB = dist(R, S);
      
      // Iterative sizing for Corner Unit
      const angleRad = (angle * Math.PI) / 180;
      const distToCorr = rentableDepth / Math.tan(angleRad / 2);
      const dynamicMinLeg = distToCorr + 5; 
      
      let cornerLeg = Math.max(35, dynamicMinLeg); 
      const MIN_CORNER_LEG = Math.max(20, dynamicMinLeg);
      
      const TARGET_AREA = config[UnitType.ThreeBed].area;
      const MAX_AREA = TARGET_AREA * 1.25;
      const MIN_AREA = TARGET_AREA * 0.85;
      const ABS_MAX_AREA = TARGET_AREA * 1.35;
      
      let splitA = Q;
      let splitB = R;
      let hasFillerA = false;
      let hasFillerB = false;
      let unitPoly = '';
      let area = 0;
      let innerStart = bCorrTop;
      let innerEnd = aCorrTop;
      
      const maxLegA = lenA - 15;
      const maxLegB = lenB - 15;
      const globalMaxLeg = Math.min(maxLegA, maxLegB);

      for (let i = 0; i < 10; i++) {
          const MIN_FILLER = 15;
          hasFillerA = false;
          hasFillerB = false;
          splitA = Q;
          splitB = R;
          
          if (lenA > cornerLeg + MIN_FILLER) {
              hasFillerA = true;
              const fillerWidth = lenA - cornerLeg;
              const vecQS = {x: S.x - Q.x, y: S.y - Q.y};
              const magQS = Math.sqrt(vecQS.x*vecQS.x + vecQS.y*vecQS.y);
              const unitQS = {x: vecQS.x/magQS, y: vecQS.y/magQS};
              splitA = { x: Q.x + unitQS.x * fillerWidth, y: Q.y + unitQS.y * fillerWidth };
          }
          
          if (lenB > cornerLeg + MIN_FILLER) {
              hasFillerB = true;
              const fillerWidth = lenB - cornerLeg;
              const vecRS = {x: S.x - R.x, y: S.y - R.y};
              const magRS = Math.sqrt(vecRS.x*vecRS.x + vecRS.y*vecRS.y);
              const unitRS = {x: vecRS.x/magRS, y: vecRS.y/magRS};
              splitB = { x: R.x + unitRS.x * fillerWidth, y: R.y + unitRS.y * fillerWidth };
          }
          
          innerStart = bCorrTop;
          if (hasFillerB) {
              const vecCorr = {x: sCorrTop.x - bCorrTop.x, y: sCorrTop.y - bCorrTop.y};
              const magCorr = Math.sqrt(vecCorr.x*vecCorr.x + vecCorr.y*vecCorr.y);
              if (magCorr > 0.1) {
                  const unitCorr = {x: vecCorr.x/magCorr, y: vecCorr.y/magCorr};
                  const fillerWidth = lenB - cornerLeg;
                  innerStart = { x: bCorrTop.x + unitCorr.x * fillerWidth, y: bCorrTop.y + unitCorr.y * fillerWidth };
              }
          }
          
          innerEnd = aCorrTop;
          if (hasFillerA) {
              innerEnd = { x: splitA.x, y: rentableDepth };
          }
          
          const polyPointsList = [splitA, S, splitB, innerStart, sCorrTop, innerEnd];
          area = 0;
          for (let k = 0; k < polyPointsList.length; k++) {
              const j = (k + 1) % polyPointsList.length;
              area += polyPointsList[k].x * polyPointsList[j].y;
              area -= polyPointsList[j].x * polyPointsList[k].y;
          }
          area = Math.abs(area) / 2;
          
          let changed = false;
          if (area > ABS_MAX_AREA && cornerLeg > MIN_CORNER_LEG + 2) {
              cornerLeg -= 3;
              changed = true;
          } else if (area < MIN_AREA && cornerLeg < globalMaxLeg - 2) {
              cornerLeg += 3;
              changed = true;
          }
          
          if (!changed) {
              unitPoly = `${splitA.x},${splitA.y} ${S.x},${S.y} ${splitB.x},${splitB.y} ${innerStart.x},${innerStart.y} ${sCorrTop.x},${sCorrTop.y} ${innerEnd.x},${innerEnd.y}`;
              break;
          }
      }

      if (!unitPoly) {
           unitPoly = `${Q.x},${Q.y} ${S.x},${S.y} ${R.x},${R.y} ${bCorrTop.x},${bCorrTop.y} ${sCorrTop.x},${sCorrTop.y} ${aCorrTop.x},${aCorrTop.y}`;
           const polyPointsList = [Q, S, R, bCorrTop, sCorrTop, aCorrTop];
           area = 0;
           for (let k = 0; k < polyPointsList.length; k++) {
              const j = (k + 1) % polyPointsList.length;
              area += polyPointsList[k].x * polyPointsList[j].y;
              area -= polyPointsList[j].x * polyPointsList[k].y;
           }
           area = Math.abs(area) / 2;
      }

      const getBestFitType = (width: number) => {
          let bestType = UnitType.OneBed;
          let minDiff = Number.MAX_VALUE;
          ([UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed] as const).forEach(t => {
              const idealW = getUnitWidth(t, config, rentableDepth);
              const diff = Math.abs(width - idealW);
              if (diff < minDiff) {
                  minDiff = diff;
                  bestType = t;
              }
          });
          return bestType;
      };
      
      if (hasFillerA) {
          const fillerWidth = lenA - cornerLeg;
          const fillerType = getBestFitType(fillerWidth);
          const fillerAPoly = `${Q.x},${Q.y} ${splitA.x},${splitA.y} ${splitA.x},${rentableDepth} ${Q.x},${rentableDepth}`;
          units.push({
              id: 'corner-1-filler-A',
              type: fillerType,
              x: Q.x, y: Q.y, width: fillerWidth, depth: rentableDepth, area: fillerWidth * rentableDepth,
              color: COLORS[fillerType],
              polyPoints: fillerAPoly
          });
      }
      
      if (hasFillerB) {
          const fillerWidth = lenB - cornerLeg;
          const fillerType = getBestFitType(fillerWidth);
          const vecCorr = {x: sCorrTop.x - bCorrTop.x, y: sCorrTop.y - bCorrTop.y};
          const magCorr = Math.sqrt(vecCorr.x*vecCorr.x + vecCorr.y*vecCorr.y);
          const unitCorr = {x: vecCorr.x/magCorr, y: vecCorr.y/magCorr};
          const splitB_Inner = { x: bCorrTop.x + unitCorr.x * fillerWidth, y: bCorrTop.y + unitCorr.y * fillerWidth };
          const fillerBPoly = `${R.x},${R.y} ${splitB.x},${splitB.y} ${splitB_Inner.x},${splitB_Inner.y} ${bCorrTop.x},${bCorrTop.y}`;
          units.push({
              id: 'corner-1-filler-B',
              type: fillerType,
              x: R.x, y: R.y, width: fillerWidth, depth: rentableDepth, area: fillerWidth * rentableDepth,
              color: COLORS[fillerType],
              polyPoints: fillerBPoly
          });
      }

      units.push({
          id: 'corner-1-unit',
          type: UnitType.ThreeBed,
          x: cornerX, y: 0, width: buildingDepth, depth: buildingDepth, area: area,
          color: COLORS[UnitType.ThreeBed],
          polyPoints: unitPoly
      });
  }

  // --- CORNER 2 (B -> C, Left Turn) ---
  {
      // 1. Define Key Vertices
      // Inner Vertex (IV) is on the Left side of B (y=0) because it's a Left Turn.
      // It connects B-Left (y=0) and C-Top (y=0).
      const IV = IV2;

      // Outer Vertex (OV) is on the Right side of B (y=depth) because it's a Left Turn.
      // It connects B-Right (y=depth) and C-Bottom (y=depth).
      const OV = OV2;

      // 2. Define Cut Points (Start/End of Bars)
      // B End: Unrotated length relative to Pivot 1
      // B ends at effectiveLengthB + steal = lengthB - steal
      const bEndLen = lengthB - steal;
      
      // B Points (at cut line)
      const bInnerEnd = rotatePt1(bEndLen, 0);
      const bOuterEnd = rotatePt1(bEndLen, buildingDepth);
      const bCorrInner = rotatePt1(bEndLen, rentableDepth);
      const bCorrOuter = rotatePt1(bEndLen, rentableDepth + corridorWidth);

      // C Points (at cut line)
      // C starts at `steal` relative to IV (along C axis)
      // C is horizontal, starting at IV.
      // C Inner Start: (IV.x + steal, IV.y)
      const cInnerStart = { x: IV.x + steal, y: IV.y };
      const cOuterStart = { x: IV.x + steal, y: IV.y + buildingDepth }; // C Bottom
      const cCorrInner = { x: IV.x + steal, y: IV.y + rentableDepth };
      const cCorrOuter = { x: IV.x + steal, y: IV.y + rentableDepth + corridorWidth };

      // 3. Calculate Corridor Intersections
      // S_Corr_Inner: Intersection of B-Corr-Inner line and C-Corr-Inner line
      // B-Corr-Inner Line: through rotatePt1(0, rentableDepth) slope tan
      // C-Corr-Inner Line: y = IV.y + rentableDepth
      // Note: For Left Turn, Inner is y=0 side. So "Inner" corridor line is y=rentableDepth.
      
      const getIntersection = (yLocal: number) => {
          const p0 = rotatePt1(0, yLocal);
          const p1 = rotatePt1(100, yLocal); // Another point on the line
          // Line B: passing p0, p1.
          // Line C: y = IV.y + yLocal.
          
          // If vertical line B (90 deg): x = p0.x.
          if (Math.abs(p1.x - p0.x) < 0.01) {
              return { x: p0.x, y: IV.y + yLocal };
          }
          
          // Slope m = (y1-y0)/(x1-x0)
          const m = (p1.y - p0.y) / (p1.x - p0.x);
          // y - y0 = m(x - x0) -> x = x0 + (y - y0)/m
          const yTarget = IV.y + yLocal;
          const xTarget = p0.x + (yTarget - p0.y) / m;
          return { x: xTarget, y: yTarget };
      };

      const S_Corr_Inner = getIntersection(rentableDepth);
      const S_Corr_Outer = getIntersection(rentableDepth + corridorWidth);

      // 4. Generate Polygons
      
      // Corridor Wedge
      const corrPoly = `${bCorrInner.x},${bCorrInner.y} ${S_Corr_Inner.x},${S_Corr_Inner.y} ${cCorrInner.x},${cCorrInner.y} ${cCorrOuter.x},${cCorrOuter.y} ${S_Corr_Outer.x},${S_Corr_Outer.y} ${bCorrOuter.x},${bCorrOuter.y}`;
      
      units.push({
          id: 'corner-2-corridor',
          type: 'Corridor' as any,
          x: OV.x, y: OV.y, width: 0, depth: 0, area: 0,
          color: COLORS.Corridor,
          polyPoints: corrPoly
      });

      // Inner Wedge (Core/Filler) - Top Left (Inner)
      // B_Inner_End -> IV -> C_Inner_Start -> C_Corr_Inner -> S_Corr_Inner -> B_Corr_Inner
      const innerPoly = `${bInnerEnd.x},${bInnerEnd.y} ${IV.x},${IV.y} ${cInnerStart.x},${cInnerStart.y} ${cCorrInner.x},${cCorrInner.y} ${S_Corr_Inner.x},${S_Corr_Inner.y} ${bCorrInner.x},${bCorrInner.y}`;
      
      units.push({
          id: 'corner-2-core-visual',
          type: 'Core' as any,
          x: IV.x, y: IV.y, width: 0, depth: 0, area: 0,
          color: COLORS.Core,
          polyPoints: innerPoly
      });

      // Outer Wedge (Unit) - Bottom Right (Outer)
      // B_Outer_End -> OV -> C_Outer_Start -> C_Corr_Outer -> S_Corr_Outer -> B_Corr_Outer
      const Q2 = bOuterEnd;
      const S2 = OV;
      const R2 = cOuterStart;
      
      const aCorrTop2 = bCorrOuter;
      const sCorrTop2 = S_Corr_Outer;
      const bCorrTop2 = cCorrOuter;
      
      const lenA2 = dist(Q2, S2);
      const lenB2 = dist(R2, S2);
      
      const angleRad2 = (angle * Math.PI) / 180;
      const distToCorr2 = rentableDepth / Math.tan(angleRad2 / 2);
      const dynamicMinLeg2 = distToCorr2 + 5; 
      
      let cornerLeg2 = Math.max(35, dynamicMinLeg2); 
      const MIN_CORNER_LEG2 = Math.max(20, dynamicMinLeg2);
      
      const TARGET_AREA2 = config[UnitType.ThreeBed].area;
      const MAX_AREA2 = TARGET_AREA2 * 1.25;
      const MIN_AREA2 = TARGET_AREA2 * 0.85;
      const ABS_MAX_AREA2 = TARGET_AREA2 * 1.35;
      
      let splitA2 = Q2;
      let splitB2 = R2;
      let hasFillerA2 = false;
      let hasFillerB2 = false;
      let unitPoly2 = '';
      let area2 = 0;
      let innerStart2 = bCorrTop2;
      let innerEnd2 = aCorrTop2;
      
      const maxLegA2 = lenA2 - 15;
      const maxLegB2 = lenB2 - 15;
      const globalMaxLeg2 = Math.min(maxLegA2, maxLegB2);

      for (let i = 0; i < 10; i++) {
          const MIN_FILLER = 15;
          hasFillerA2 = false;
          hasFillerB2 = false;
          splitA2 = Q2;
          splitB2 = R2;
          
          if (lenA2 > cornerLeg2 + MIN_FILLER) {
              hasFillerA2 = true;
              const fillerWidth = lenA2 - cornerLeg2;
              const vecQS = {x: S2.x - Q2.x, y: S2.y - Q2.y};
              const magQS = Math.sqrt(vecQS.x*vecQS.x + vecQS.y*vecQS.y);
              const unitQS = {x: vecQS.x/magQS, y: vecQS.y/magQS};
              splitA2 = { x: Q2.x + unitQS.x * fillerWidth, y: Q2.y + unitQS.y * fillerWidth };
          }
          
          if (lenB2 > cornerLeg2 + MIN_FILLER) {
              hasFillerB2 = true;
              const fillerWidth = lenB2 - cornerLeg2;
              const vecRS = {x: S2.x - R2.x, y: S2.y - R2.y};
              const magRS = Math.sqrt(vecRS.x*vecRS.x + vecRS.y*vecRS.y);
              const unitRS = {x: vecRS.x/magRS, y: vecRS.y/magRS};
              splitB2 = { x: R2.x + unitRS.x * fillerWidth, y: R2.y + unitRS.y * fillerWidth };
          }
          
          innerStart2 = bCorrTop2;
          if (hasFillerB2) {
              const vecCorr = {x: sCorrTop2.x - bCorrTop2.x, y: sCorrTop2.y - bCorrTop2.y};
              const magCorr = Math.sqrt(vecCorr.x*vecCorr.x + vecCorr.y*vecCorr.y);
              if (magCorr > 0.1) {
                  const unitCorr = {x: vecCorr.x/magCorr, y: vecCorr.y/magCorr};
                  const fillerWidth = lenB2 - cornerLeg2;
                  innerStart2 = { x: bCorrTop2.x + unitCorr.x * fillerWidth, y: bCorrTop2.y + unitCorr.y * fillerWidth };
              }
          }
          
          innerEnd2 = aCorrTop2;
          if (hasFillerA2) {
              const vecCorr = {x: sCorrTop2.x - aCorrTop2.x, y: sCorrTop2.y - aCorrTop2.y};
              const magCorr = Math.sqrt(vecCorr.x*vecCorr.x + vecCorr.y*vecCorr.y);
              if (magCorr > 0.1) {
                  const unitCorr = {x: vecCorr.x/magCorr, y: vecCorr.y/magCorr};
                  const fillerWidth = lenA2 - cornerLeg2;
                  innerEnd2 = { x: aCorrTop2.x + unitCorr.x * fillerWidth, y: aCorrTop2.y + unitCorr.y * fillerWidth };
              }
          }
          
          const polyPointsList = [splitA2, S2, splitB2, innerStart2, sCorrTop2, innerEnd2];
          area2 = 0;
          for (let k = 0; k < polyPointsList.length; k++) {
              const j = (k + 1) % polyPointsList.length;
              area2 += polyPointsList[k].x * polyPointsList[j].y;
              area2 -= polyPointsList[j].x * polyPointsList[k].y;
          }
          area2 = Math.abs(area2) / 2;
          
          let changed = false;
          if (area2 > ABS_MAX_AREA2 && cornerLeg2 > MIN_CORNER_LEG2 + 2) {
              cornerLeg2 -= 3;
              changed = true;
          } else if (area2 < MIN_AREA2 && cornerLeg2 < globalMaxLeg2 - 2) {
              cornerLeg2 += 3;
              changed = true;
          }
          
          if (!changed) {
              unitPoly2 = `${splitA2.x},${splitA2.y} ${S2.x},${S2.y} ${splitB2.x},${splitB2.y} ${innerStart2.x},${innerStart2.y} ${sCorrTop2.x},${sCorrTop2.y} ${innerEnd2.x},${innerEnd2.y}`;
              break;
          }
      }

      if (!unitPoly2) {
           unitPoly2 = `${Q2.x},${Q2.y} ${S2.x},${S2.y} ${R2.x},${R2.y} ${bCorrTop2.x},${bCorrTop2.y} ${sCorrTop2.x},${sCorrTop2.y} ${aCorrTop2.x},${aCorrTop2.y}`;
           const polyPointsList = [Q2, S2, R2, bCorrTop2, sCorrTop2, aCorrTop2];
           area2 = 0;
           for (let k = 0; k < polyPointsList.length; k++) {
              const j = (k + 1) % polyPointsList.length;
              area2 += polyPointsList[k].x * polyPointsList[j].y;
              area2 -= polyPointsList[j].x * polyPointsList[k].y;
           }
           area2 = Math.abs(area2) / 2;
      }

      const getBestFitType2 = (width: number) => {
          let bestType = UnitType.OneBed;
          let minDiff = Number.MAX_VALUE;
          ([UnitType.Studio, UnitType.OneBed, UnitType.TwoBed, UnitType.ThreeBed] as const).forEach(t => {
              const idealW = getUnitWidth(t, config, rentableDepth);
              const diff = Math.abs(width - idealW);
              if (diff < minDiff) {
                  minDiff = diff;
                  bestType = t;
              }
          });
          return bestType;
      };
      
      if (hasFillerA2) {
          const fillerWidth = lenA2 - cornerLeg2;
          const fillerType = getBestFitType2(fillerWidth);
          const fillerAPoly = `${Q2.x},${Q2.y} ${splitA2.x},${splitA2.y} ${innerEnd2.x},${innerEnd2.y} ${aCorrTop2.x},${aCorrTop2.y}`;
          units.push({
              id: 'corner-2-filler-A',
              type: fillerType,
              x: Q2.x, y: Q2.y, width: fillerWidth, depth: rentableDepth, area: fillerWidth * rentableDepth,
              color: COLORS[fillerType],
              polyPoints: fillerAPoly
          });
      }
      
      if (hasFillerB2) {
          const fillerWidth = lenB2 - cornerLeg2;
          const fillerType = getBestFitType2(fillerWidth);
          const fillerBPoly = `${R2.x},${R2.y} ${splitB2.x},${splitB2.y} ${innerStart2.x},${innerStart2.y} ${bCorrTop2.x},${bCorrTop2.y}`;
          units.push({
              id: 'corner-2-filler-B',
              type: fillerType,
              x: R2.x, y: R2.y, width: fillerWidth, depth: rentableDepth, area: fillerWidth * rentableDepth,
              color: COLORS[fillerType],
              polyPoints: fillerBPoly
          });
      }

      units.push({
          id: 'corner-2-unit',
          type: UnitType.ThreeBed,
          x: OV.x, y: OV.y, width: buildingDepth, depth: buildingDepth, area: area2,
          color: COLORS[UnitType.ThreeBed],
          polyPoints: unitPoly2
      });
  }
  
  return {
    units,
    cores,
    corridor: corridors,
    length: lengthA,
    width: buildingDepth, // Approximate
    shape: 'W',
    stats: {
        gsf: barA.stats.gsf + barB.stats.gsf + barC.stats.gsf, // + corners
        nrsf: barA.stats.nrsf + barB.stats.nrsf + barC.stats.nrsf,
        efficiency: 0.85,
        unitCounts: {
            [UnitType.Studio]: barA.stats.unitCounts.Studio + barB.stats.unitCounts.Studio + barC.stats.unitCounts.Studio,
            [UnitType.OneBed]: barA.stats.unitCounts['1B'] + barB.stats.unitCounts['1B'] + barC.stats.unitCounts['1B'],
            [UnitType.TwoBed]: barA.stats.unitCounts['2B'] + barB.stats.unitCounts['2B'] + barC.stats.unitCounts['2B'],
            [UnitType.ThreeBed]: barA.stats.unitCounts['3B'] + barB.stats.unitCounts['3B'] + barC.stats.unitCounts['3B']
        },
        totalUnits: barA.stats.totalUnits + barB.stats.totalUnits + barC.stats.totalUnits
    },
    egress: barA.egress
  };
};

export const generateFloorPlan = (
  length: number, 
  config: UnitConfiguration, 
  alignment: number = 1.0, 
  placeLargerUnitsAtEnds: boolean = true,
  coreWidth: number = CORE_WIDTH,
  coreDepth: number = CORE_DEPTH, 
  buildingDepth: number = BUILDING_DEPTH, 
  corridorWidth: number = CORRIDOR_WIDTH,
  egressConfig: EgressConfig,
  coreSide: 'North' | 'South' = 'North',
  shape: BuildingShape = 'Bar',
  lengthB: number = 200,
  angle: number = 90,
  lengthC: number = 200
): FloorPlanData => {
  if (shape === 'W') {
      return generateWLayout(
          length,
          lengthB,
          lengthC,
          config,
          alignment,
          placeLargerUnitsAtEnds,
          coreWidth,
          coreDepth,
          buildingDepth,
          corridorWidth,
          egressConfig,
          coreSide,
          angle
      );
  }
  if (shape === 'L') {
      return generateLLayout(
          length,
          lengthB,
          config,
          alignment,
          placeLargerUnitsAtEnds,
          coreWidth,
          coreDepth,
          buildingDepth,
          corridorWidth,
          egressConfig,
          coreSide,
          angle
      );
  }
  return generateBarLayout(
      length, 
      config, 
      alignment, 
      placeLargerUnitsAtEnds, 
      coreWidth, 
      coreDepth, 
      buildingDepth, 
      corridorWidth, 
      egressConfig, 
      coreSide
  );
};