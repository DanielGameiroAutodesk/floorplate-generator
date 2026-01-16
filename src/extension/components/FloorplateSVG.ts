/**
 * Floorplate SVG Renderer
 * Renders FloorPlanData as a 2D SVG visualization
 */

import { FloorPlanData, UnitBlock, CoreBlock, CorridorBlock, UnitType } from '../../algorithm/types';
import { FEET_TO_METERS } from '../../algorithm/constants';

// Unit type display abbreviations
const UNIT_ABBREVIATIONS: Record<UnitType, string> = {
  [UnitType.Studio]: 'Studio',
  [UnitType.OneBed]: '1B',
  [UnitType.TwoBed]: '2B',
  [UnitType.ThreeBed]: '3B'
};

// Colors for SVG (CSS hex format) - using Forma Data Labels palette
const SVG_COLORS: Record<UnitType | 'Core' | 'Corridor', string> = {
  [UnitType.Studio]: '#A0D4DC',   // data-blue
  [UnitType.OneBed]: '#D0E1A4',   // data-green
  [UnitType.TwoBed]: '#F5C297',   // data-orange
  [UnitType.ThreeBed]: '#D9DDFC', // data-purple
  Core: '#3C3C3C',                 // forma-text-default
  Corridor: '#EEEEEE'              // forma-surface-250
};

// Convert meters to feet for display
function metersToFeet(meters: number): number {
  return meters / FEET_TO_METERS;
}

// Format area for display (e.g., "1905sf")
function formatArea(sqMeters: number): string {
  const sqFeet = Math.round(sqMeters / (FEET_TO_METERS * FEET_TO_METERS));
  return `${sqFeet}sf`;
}

// Format dimension for display (e.g., "300'")
function formatDimension(meters: number): string {
  const feet = Math.round(metersToFeet(meters));
  return `${feet}'`;
}

interface SVGRenderOptions {
  padding?: number;          // Padding around the floorplate (for dimension labels)
  showDimensions?: boolean;  // Show building dimensions
  showLabels?: boolean;      // Show unit labels
  showAreas?: boolean;       // Show unit areas
}

/**
 * Render FloorPlanData to SVG string
 */
export function renderFloorplateSVG(
  floorplan: FloorPlanData,
  containerWidth: number,
  containerHeight: number,
  options: SVGRenderOptions = {}
): string {
  const {
    padding = 50,
    showDimensions = true,
    showLabels = true,
    showAreas = true
  } = options;

  const { buildingLength, buildingDepth, units, cores, corridor } = floorplan;

  // Calculate SVG viewBox dimensions
  // The algorithm uses local coordinates centered at origin
  // We need to transform to SVG coordinates (top-left origin)
  const halfLength = buildingLength / 2;
  const halfDepth = buildingDepth / 2;

  // SVG coordinate system: x goes right, y goes down
  // Algorithm coordinates: x goes right (length), y goes up (depth)
  // We need to flip y-axis for SVG

  // Calculate scale to fit container while maintaining aspect ratio
  const availableWidth = containerWidth - 2 * padding;
  const availableHeight = containerHeight - 2 * padding;
  const scaleX = availableWidth / buildingLength;
  const scaleY = availableHeight / buildingDepth;
  const scale = Math.min(scaleX, scaleY);

  // Calculate actual SVG dimensions
  const svgWidth = buildingLength * scale + 2 * padding;
  const svgHeight = buildingDepth * scale + 2 * padding;

  // Transform function: local coords -> SVG coords
  const toSVG = (x: number, y: number) => ({
    x: (x + halfLength) * scale + padding,
    y: (halfDepth - y) * scale + padding  // Flip y-axis
  });

  // Build SVG elements
  const elements: string[] = [];

  // Building outline
  const outlineStart = toSVG(-halfLength, halfDepth);
  elements.push(`
    <rect
      x="${outlineStart.x}"
      y="${outlineStart.y}"
      width="${buildingLength * scale}"
      height="${buildingDepth * scale}"
      fill="none"
      stroke="#3C3C3C"
      stroke-width="2"
    />
  `);

  // Dimension labels (if enabled)
  if (showDimensions) {
    // Length dimension (bottom)
    const lengthLabelPos = toSVG(0, -halfDepth);
    elements.push(`
      <text
        x="${lengthLabelPos.x}"
        y="${lengthLabelPos.y + 30}"
        text-anchor="middle"
        font-family="Artifakt Element, Arial, sans-serif"
        font-size="12"
        font-weight="bold"
        fill="#3C3C3C"
      >${formatDimension(buildingLength)}</text>
    `);

    // Depth dimension (left)
    const depthLabelPos = toSVG(-halfLength, 0);
    elements.push(`
      <text
        x="${depthLabelPos.x - 20}"
        y="${depthLabelPos.y}"
        text-anchor="middle"
        font-family="Artifakt Element, Arial, sans-serif"
        font-size="12"
        font-weight="bold"
        fill="#3C3C3C"
        transform="rotate(-90, ${depthLabelPos.x - 20}, ${depthLabelPos.y})"
      >${formatDimension(buildingDepth)}</text>
    `);
  }

  // Corridor
  elements.push(renderCorridor(corridor, scale, toSVG, buildingLength));

  // Cores
  cores.forEach(core => {
    elements.push(renderCore(core, scale, toSVG));
  });

  // Units
  units.forEach(unit => {
    elements.push(renderUnit(unit, scale, toSVG, showLabels, showAreas));
  });

  // Build final SVG
  return `
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 ${svgWidth} ${svgHeight}"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>
          .unit-label { font-family: Artifakt Element, Arial, sans-serif; font-weight: bold; fill: #3C3C3C; }
          .unit-area { font-family: Artifakt Element, Arial, sans-serif; fill: #3C3C3C; opacity: 0.9; }
          .core-label { font-family: Artifakt Element, Arial, sans-serif; font-weight: bold; fill: #FFFFFF; }
          .corridor-label { font-family: Artifakt Element, Arial, sans-serif; font-weight: 500; fill: #3C3C3C; }
        </style>
      </defs>
      ${elements.join('\n')}
    </svg>
  `;
}

/**
 * Render corridor as SVG
 */
function renderCorridor(
  corridor: CorridorBlock,
  scale: number,
  toSVG: (x: number, y: number) => { x: number; y: number },
  _buildingLength: number
): string {
  const topLeft = toSVG(corridor.x, corridor.y + corridor.depth);
  const width = corridor.width * scale;
  const height = corridor.depth * scale;

  const corridorWidthFeet = Math.round(metersToFeet(corridor.depth));

  // Center of corridor for label
  const centerX = topLeft.x + width / 2;
  const centerY = topLeft.y + height / 2;

  return `
    <g class="corridor">
      <rect
        x="${topLeft.x}"
        y="${topLeft.y}"
        width="${width}"
        height="${height}"
        fill="${SVG_COLORS.Corridor}"
        stroke="#D9D9D9"
        stroke-width="1"
      />
      <text
        x="${centerX}"
        y="${centerY + 4}"
        text-anchor="middle"
        class="corridor-label"
        font-size="11"
      >Corridor (${corridorWidthFeet}')</text>
    </g>
  `;
}

/**
 * Render core as SVG
 */
function renderCore(
  core: CoreBlock,
  scale: number,
  toSVG: (x: number, y: number) => { x: number; y: number }
): string {
  const topLeft = toSVG(core.x, core.y + core.depth);
  const width = core.width * scale;
  const height = core.depth * scale;

  // Center of core for label
  const centerX = topLeft.x + width / 2;
  const centerY = topLeft.y + height / 2;

  // Determine if we should rotate the label (for narrow cores)
  const isNarrow = width < height * 0.6;
  const rotation = isNarrow ? -90 : 0;
  const fontSize = Math.min(12, Math.min(width, height) * 0.3);

  return `
    <g class="core">
      <rect
        x="${topLeft.x}"
        y="${topLeft.y}"
        width="${width}"
        height="${height}"
        fill="${SVG_COLORS.Core}"
        stroke="#3C3C3C"
        stroke-width="1"
      />
      <text
        x="${centerX}"
        y="${centerY}"
        text-anchor="middle"
        dominant-baseline="middle"
        class="core-label"
        font-size="${fontSize}"
        ${isNarrow ? `transform="rotate(${rotation}, ${centerX}, ${centerY})"` : ''}
      >CORE</text>
    </g>
  `;
}

/**
 * Render unit as SVG (rectangle or polygon)
 */
function renderUnit(
  unit: UnitBlock,
  scale: number,
  toSVG: (x: number, y: number) => { x: number; y: number },
  showLabel: boolean,
  showArea: boolean
): string {
  // Use unit.color if available, fallback to SVG_COLORS lookup by legacy type
  const color = unit.color || (unit.type ? SVG_COLORS[unit.type] : '#808080');
  // Use typeName for label, fallback to legacy abbreviations or typeId
  const abbrev = unit.typeName || (unit.type ? UNIT_ABBREVIATIONS[unit.type] : unit.typeId);
  const areaText = formatArea(unit.area);

  if (unit.polyPoints && unit.polyPoints.length >= 3) {
    // Polygon unit (L-shaped or other)
    return renderPolygonUnit(unit, scale, toSVG, color, abbrev, areaText, showLabel, showArea);
  } else {
    // Rectangle unit
    return renderRectUnit(unit, scale, toSVG, color, abbrev, areaText, showLabel, showArea);
  }
}

/**
 * Render rectangular unit
 */
function renderRectUnit(
  unit: UnitBlock,
  scale: number,
  toSVG: (x: number, y: number) => { x: number; y: number },
  color: string,
  abbrev: string,
  areaText: string,
  showLabel: boolean,
  showArea: boolean
): string {
  const topLeft = toSVG(unit.x, unit.y + unit.depth);
  const width = unit.width * scale;
  const height = unit.depth * scale;

  // Center for labels
  const centerX = topLeft.x + width / 2;
  const centerY = topLeft.y + height / 2;

  // Adjust font sizes based on unit size
  const labelFontSize = Math.min(14, Math.min(width, height) * 0.25);
  const areaFontSize = Math.min(10, labelFontSize * 0.7);

  const labelY = showArea ? centerY - areaFontSize * 0.3 : centerY;
  const areaY = labelY + labelFontSize * 0.9;

  return `
    <g class="unit" data-type="${unit.type}" data-id="${unit.id}">
      <rect
        x="${topLeft.x}"
        y="${topLeft.y}"
        width="${width}"
        height="${height}"
        fill="${color}"
        stroke="#3C3C3C"
        stroke-width="1"
      />
      ${showLabel ? `
        <text
          x="${centerX}"
          y="${labelY}"
          text-anchor="middle"
          dominant-baseline="middle"
          class="unit-label"
          font-size="${labelFontSize}"
        >${abbrev}</text>
      ` : ''}
      ${showArea ? `
        <text
          x="${centerX}"
          y="${areaY}"
          text-anchor="middle"
          dominant-baseline="middle"
          class="unit-area"
          font-size="${areaFontSize}"
        >${areaText}</text>
      ` : ''}
    </g>
  `;
}

/**
 * Render polygon unit (L-shaped or other)
 */
function renderPolygonUnit(
  unit: UnitBlock,
  _scale: number,
  toSVG: (x: number, y: number) => { x: number; y: number },
  color: string,
  abbrev: string,
  areaText: string,
  showLabel: boolean,
  showArea: boolean
): string {
  const points = unit.polyPoints!;

  // Transform all points to SVG coordinates
  const svgPoints = points.map(p => toSVG(p.x, p.y));
  const pointsString = svgPoints.map(p => `${p.x},${p.y}`).join(' ');

  // Calculate centroid for label placement
  let cx = 0, cy = 0;
  svgPoints.forEach(p => {
    cx += p.x;
    cy += p.y;
  });
  cx /= svgPoints.length;
  cy /= svgPoints.length;

  // Estimate size for font scaling
  const minX = Math.min(...svgPoints.map(p => p.x));
  const maxX = Math.max(...svgPoints.map(p => p.x));
  const minY = Math.min(...svgPoints.map(p => p.y));
  const maxY = Math.max(...svgPoints.map(p => p.y));
  const width = maxX - minX;
  const height = maxY - minY;

  const labelFontSize = Math.min(14, Math.min(width, height) * 0.2);
  const areaFontSize = Math.min(10, labelFontSize * 0.7);

  const labelY = showArea ? cy - areaFontSize * 0.3 : cy;
  const areaY = labelY + labelFontSize * 0.9;

  return `
    <g class="unit" data-type="${unit.type}" data-id="${unit.id}">
      <polygon
        points="${pointsString}"
        fill="${color}"
        stroke="#3C3C3C"
        stroke-width="1"
      />
      ${showLabel ? `
        <text
          x="${cx}"
          y="${labelY}"
          text-anchor="middle"
          dominant-baseline="middle"
          class="unit-label"
          font-size="${labelFontSize}"
        >${abbrev}</text>
      ` : ''}
      ${showArea ? `
        <text
          x="${cx}"
          y="${areaY}"
          text-anchor="middle"
          dominant-baseline="middle"
          class="unit-area"
          font-size="${areaFontSize}"
        >${areaText}</text>
      ` : ''}
    </g>
  `;
}

/**
 * Create an empty placeholder SVG when no floorplan is available
 */
export function renderEmptyFloorplate(width: number, height: number): string {
  return `
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 ${width} ${height}"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="${width}" height="${height}" fill="#F5F5F5" />
      <text
        x="${width / 2}"
        y="${height / 2}"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="Artifakt Element, Arial, sans-serif"
        font-size="11"
        fill="#ABABAB"
      >Select a building to generate a floorplate</text>
    </svg>
  `;
}
