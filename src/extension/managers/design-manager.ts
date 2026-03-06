import { Forma } from 'forma-embedded-view-sdk/auto';
import { 
  generateFloorplateVariants, 
  generateMultiWingFloorplateVariants
} from '../../algorithm';
import { BuildingFootprint, LayoutOption, Wing, WingIntersection, CornerType } from '../../algorithm/types';
import { MultiWingAnalysis } from '../../algorithm/wing-detection';

export type Vec3 = { x: number; y: number; z: number };
import { FEET_TO_METERS } from '../../algorithm/constants';
import { state } from '../state/ui-state';
import { getUnitConfiguration, getUnitColors, getEgressConfig } from '../state/unit-config';
import { lineToFootprintTopology } from '../utils/line-to-polygon';
import { bakeWithFloorStack } from '../bake-building';
import { Logger } from '../../algorithm/utils/logger';
import * as dom from '../utils/dom-refs';

/**
 * Helper to compute the angle of the first segment of the line.
 */
function getLineAngle(pts: Vec3[]): number {
  if (pts.length < 2) return 0;
  return Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
}

/**
 * Calculates length of a polyline.
 */
function getLineLength(pts: Vec3[]): number {
  let length = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i+1].x - pts[i].x;
    const dy = pts[i+1].y - pts[i].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

function isClosedLine(pts: Vec3[]): boolean {
  if (pts.length < 3) return false;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const dist = Math.sqrt((first.x - last.x)**2 + (first.y - last.y)**2);
  return dist < 0.1; // within 10 cm
}

/**
 * Creates a deterministic MultiWingAnalysis directly from the drawn line.
 * This guarantees perfect wing detection for V-shapes and complex polylines,
 * bypassing the need to analyze the buffered footprint polygon.
 */
function createAnalysisFromLine(line: Vec3[], widthMeters: number): MultiWingAnalysis {
  const wings: Wing[] = [];
  const intersections: WingIntersection[] = [];

  const closed = isClosedLine(line);
  const pts = closed ? line.slice(0, -1) : line;
  const numWings = closed ? pts.length : pts.length - 1;

  for (let i = 0; i < numWings; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    let direction = Math.atan2(dy, dx);
    if (direction < 0) direction += Math.PI;
    if (direction >= Math.PI) direction -= Math.PI;

    const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    
    const halfW = widthMeters / 2;
    const halfL = length / 2;
    const minX = center.x - halfL - halfW;
    const maxX = center.x + halfL + halfW;
    const minY = center.y - halfL - halfW;
    const maxY = center.y + halfL + halfW;

    wings.push({
      id: i,
      vertices: [], // Not strictly needed for multi-wing generator logic
      direction,
      length,
      width: widthMeters,
      centerline: {
        start: { x: p1.x, y: p1.y },
        end: { x: p2.x, y: p2.y }
      },
      bounds: { minX, maxX, minY, maxY },
      center
    });
  }

  const numIntersections = closed ? numWings : numWings - 1;
  for (let i = 0; i < numIntersections; i++) {
    const w1Idx = i;
    const w2Idx = (i + 1) % numWings;
    
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    const p3 = pts[(i + 2) % pts.length];
    
    const v1x = p2.x - p1.x; const v1y = p2.y - p1.y;
    const v2x = p3.x - p2.x; const v2y = p3.y - p2.y;
    
    // Cross product to determine angle between segments
    const dirA = { x: -v1x, y: -v1y }; // away from intersection
    const dirB = { x: v2x, y: v2y };   // away from intersection
    const lenA = Math.sqrt(dirA.x * dirA.x + dirA.y * dirA.y);
    const lenB = Math.sqrt(dirB.x * dirB.x + dirB.y * dirB.y);
    
    // Check for degenerate segments
    if (lenA < 1e-4 || lenB < 1e-4) continue;

    const dot = (dirA.x * dirB.x + dirA.y * dirB.y) / (lenA * lenB);
    const cosTheta = Math.max(-1, Math.min(1, dot));
    const angle = Math.acos(cosTheta);
    
    intersections.push({
      point: { x: p2.x, y: p2.y, interiorAngle: angle, cornerType: CornerType.CONCAVE, index: 0 },
      type: 'inner',
      wingIds: [w1Idx, w2Idx],
      angle
    });
  }

  let shape: 'bar' | 'L' | 'U' | 'V' | 'H' | 'snake' | 'courtyard' | 'complex' = 'bar';
  if (closed) shape = 'courtyard';
  else if (wings.length === 2) shape = 'V';
  else if (wings.length > 2) shape = 'snake';

  return {
    wings,
    intersections,
    isSimpleBar: wings.length === 1 && !closed,
    shape,
    wingRoles: [],
    netWingLengths: new Map()
  };
}

export async function startDesignMode(): Promise<void> {
  // Update UI to drawing state
  dom.designBtn.innerHTML = '<span class="generate-btn-icon">&#9998;</span> Drawing...';
  dom.designBtn.classList.remove('mode-btn-secondary');
  dom.selectBtn.classList.add('mode-btn-secondary');
  dom.selectBtn.disabled = true;

  try {
    const lineResponse = await Forma.designTool.getLine();
    
    if (!lineResponse || !lineResponse.coordinates || lineResponse.coordinates.length < 2) {
      // Cancelled or invalid
      resetDesignUI();
      return;
    }

    // Move to generating state
    dom.designBtn.innerHTML = '<span class="generate-btn-icon">&#9881;</span> Generating...';
    
    await handleDesignGenerate(lineResponse.coordinates);
    
    } catch (error) {
    Logger.error(`Design mode error: ${error}`);
  } finally {
    resetDesignUI();
  }
}

function resetDesignUI() {
  dom.designBtn.innerHTML = 'Design';
  dom.designBtn.classList.add('mode-btn-secondary');
  dom.selectBtn.classList.remove('mode-btn-secondary');
  dom.selectBtn.disabled = false;
}

  async function handleDesignGenerate(line: Vec3[]): Promise<void> {
    const widthMeters = state.designWidth * FEET_TO_METERS;
    const { outer: polygon, holes } = lineToFootprintTopology(line, widthMeters);

    // Set floorZ to the z-coordinate of the first point
    const floorZ = line[0].z;
    
    // Determine if simple bar or multi-wing
    const isSimpleBar = line.length === 2 && !isClosedLine(line);
    
    // Construct analysis directly from the drawn line!
    const precomputedAnalysis = createAnalysisFromLine(line, widthMeters);
    
    const treatAsSimpleBar = isSimpleBar;
    
    // Get configs
    const unitConfig = getUnitConfiguration();
    const egressConfig = getEgressConfig();
    const unitColors = getUnitColors();
    const corridorWidth = state.corridorWidth * FEET_TO_METERS;
    const coreWidth = state.coreWidth * FEET_TO_METERS;
    const coreDepth = state.coreDepth * FEET_TO_METERS;
  
    const generatorOptions = {
      corridorWidth,
      coreWidth,
      coreDepth,
      coreSide: state.corePlacement,
      customColors: unitColors,
      alignment: state.alignment / 100,
      includeIntersectionCustomUnits: true
    };
  
    let generatedOptions: LayoutOption[] = [];
  
    if (treatAsSimpleBar) {
      // 2-point line -> Rectangle
      // If drawn with multiple points but it's basically straight, we should still construct a straight footprint.
      // Easiest is to just take the first and last point.
      const firstPt = line[0];
      const lastPt = line[line.length - 1];
      const straightLine = [firstPt, lastPt];
      
      const length = getLineLength(straightLine);
      const rotation = getLineAngle(straightLine);
  
      const footprint: BuildingFootprint = {
        width: length,
        depth: widthMeters,
        height: state.stories * 3.2,
        centerX: (firstPt.x + lastPt.x) / 2,
        centerY: (firstPt.y + lastPt.y) / 2,
        minX: Math.min(firstPt.x, lastPt.x),
        maxX: Math.max(firstPt.x, lastPt.x),
        minY: Math.min(firstPt.y, lastPt.y),
        maxY: Math.max(firstPt.y, lastPt.y),
        floorZ,
        rotation
      };
  
      generatedOptions = generateFloorplateVariants(footprint, unitConfig, egressConfig, generatorOptions);
    } else {
      // 3+ point line -> Multi-wing
      const topology = { outer: polygon, holes };
      
      generatedOptions = generateMultiWingFloorplateVariants(
        polygon, unitConfig, egressConfig, generatorOptions, topology, precomputedAnalysis
      );
    }

  if (!generatedOptions || generatedOptions.length === 0) {
    throw new Error('Failed to generate building options');
  }

  // Take the first option (Balanced)
  const selectedOption = generatedOptions[0];

  // Set the floor elevation correctly for the bake process
  selectedOption.floorplan.floorElevation = floorZ;

  dom.designBtn.innerHTML = '<span class="generate-btn-icon">&#9881;</span> Baking...';

  const result = await bakeWithFloorStack(selectedOption.floorplan, {
    numFloors: state.stories,
    name: 'Design Building'
  });

  if (result.success) {
    Logger.info(`Auto-bake successful! URN: ${result.urn}`);
  } else {
    throw new Error(result.error || 'Unknown error during bake');
  }
}