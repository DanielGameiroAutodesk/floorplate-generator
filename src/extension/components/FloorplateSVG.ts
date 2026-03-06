/**
 * Floorplate SVG Renderer
 * Renders FloorPlanData as a 2D SVG visualization
 */

import { FloorPlanData, UnitBlock, CoreBlock, CorridorBlock, FillerBlock, UnitType } from '../../algorithm/types';
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

interface WingDimensionInfo {
  id: number;
  length: number;
  width: number;
  center: { x: number; y: number };
  direction: number;
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

  const { buildingLength, buildingDepth, units, cores, fillers, corridor } = floorplan;
  const corridorSegments: CorridorBlock[] = (floorplan as { corridorSegments?: CorridorBlock[] }).corridorSegments ?? [];

  // Calculate SVG viewBox dimensions
  // The algorithm uses local coordinates centered at origin
  // We need to transform to SVG coordinates (top-left origin)
  const halfLength = buildingLength / 2;
  const halfDepth = buildingDepth / 2;

  // SVG coordinate system: x goes right, y goes down
  // Algorithm coordinates: x goes right (length), y goes up (depth)
  // We need to flip y-axis for SVG
  const isMultiWing = ((floorplan as { wingInfo?: { wingCount?: number } }).wingInfo?.wingCount ?? 0) > 1;

  const addRectPoints = (
    points: { x: number; y: number }[],
    x: number,
    y: number,
    width: number,
    depth: number
  ) => {
    points.push(
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + depth },
      { x, y: y + depth }
    );
  };

  const geometryPoints: { x: number; y: number }[] = [];
  units.forEach(unit => {
    if (unit.polyPoints && unit.polyPoints.length >= 3) {
      geometryPoints.push(...unit.polyPoints);
    } else {
      addRectPoints(geometryPoints, unit.x, unit.y, unit.width, unit.depth);
    }
  });
  cores.forEach(core => {
    if (core.polyPoints && core.polyPoints.length >= 3) {
      geometryPoints.push(...core.polyPoints);
    } else {
      addRectPoints(geometryPoints, core.x, core.y, core.width, core.depth);
    }
  });
  fillers.forEach(filler => {
    if (filler.polyPoints && filler.polyPoints.length >= 3) {
      geometryPoints.push(...filler.polyPoints);
    } else {
      addRectPoints(geometryPoints, filler.x, filler.y, filler.width, filler.depth);
    }
  });
  // Include all corridor segments (multi-wing) or primary corridor in bounding box
  if (corridorSegments.length > 0) {
    corridorSegments.forEach(seg => {
      if (seg.polyPoints && seg.polyPoints.length >= 3) {
        geometryPoints.push(...seg.polyPoints);
      } else {
        addRectPoints(geometryPoints, seg.x, seg.y, seg.width, seg.depth);
      }
    });
  } else if (corridor.polyPoints && corridor.polyPoints.length >= 3) {
    geometryPoints.push(...corridor.polyPoints);
  } else {
    addRectPoints(geometryPoints, corridor.x, corridor.y, corridor.width, corridor.depth);
  }
  if (geometryPoints.length === 0) {
    addRectPoints(geometryPoints, -halfLength, -halfDepth, buildingLength, buildingDepth);
  }
  const minX = Math.min(...geometryPoints.map(p => p.x));
  const maxX = Math.max(...geometryPoints.map(p => p.x));
  const minY = Math.min(...geometryPoints.map(p => p.y));
  const maxY = Math.max(...geometryPoints.map(p => p.y));
  const renderLength = Math.max(0.0001, maxX - minX);
  const renderDepth = Math.max(0.0001, maxY - minY);

  // Calculate scale to fit container while maintaining aspect ratio
  const availableWidth = containerWidth - 2 * padding;
  const availableHeight = containerHeight - 2 * padding;
  const scaleX = availableWidth / renderLength;
  const scaleY = availableHeight / renderDepth;
  const scale = Math.min(scaleX, scaleY);

  // Calculate actual SVG dimensions
  const svgWidth = renderLength * scale + 2 * padding;
  const svgHeight = renderDepth * scale + 2 * padding;

  // Transform function: floorplan/world coords -> SVG coords
  const toSVG = (x: number, y: number) => ({
    x: (x - minX) * scale + padding,
    y: (maxY - y) * scale + padding  // Flip y-axis
  });

  // Build SVG elements
  const elements: string[] = [];
  const dimensionElements: string[] = [];

  // Building outline (skip for multi-wing, where a rectangle is misleading)
  if (!isMultiWing) {
    const outlineStart = toSVG(minX, maxY);
    elements.push(`
      <rect
        x="${outlineStart.x}"
        y="${outlineStart.y}"
        width="${renderLength * scale}"
        height="${renderDepth * scale}"
        fill="none"
        stroke="#3C3C3C"
        stroke-width="2"
      />
    `);
  }

  // Dimension labels (if enabled)
  if (showDimensions) {
    const wingDimensions =
      (((floorplan as { wingInfo?: { wings?: WingDimensionInfo[] } }).wingInfo?.wings) ?? [])
        .filter(wing => Number.isFinite(wing.length) && Number.isFinite(wing.width) && wing.length > 0 && wing.width > 0);
    const corridorGraph = (floorplan as {
      corridorGraph?: { nodes: { x: number; y: number }[]; edges: [number, number][] };
    }).corridorGraph;
    const corridorGraphNodes = corridorGraph?.nodes ?? [];
    const corridorGraphEdges = corridorGraph?.edges ?? [];

    if (isMultiWing && corridorGraphNodes.length > 0 && corridorGraphEdges.length > 0) {
      corridorGraphEdges.forEach(([fromIdx, toIdx], idx) => {
        const from = corridorGraphNodes[fromIdx];
        const to = corridorGraphNodes[toIdx];
        if (!from || !to) return;

        const segLength = Math.hypot(to.x - from.x, to.y - from.y);
        if (segLength < 1e-6) return;

        const start = toSVG(from.x, from.y);
        const end = toSVG(to.x, to.y);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const drawLen = Math.hypot(dx, dy);
        if (drawLen < 1e-6) return;

        const perpX = -dy / drawLen;
        const perpY = dx / drawLen;
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        const labelOffset = 11;
        const labelX = midX + perpX * labelOffset;
        const labelY = midY + perpY * labelOffset;
        const labelAngle = Math.atan2(dy, dx) * 180 / Math.PI;

        dimensionElements.push(`
          <g class="corridor-dim corridor-dim-${idx}" opacity="1">
            <line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#6E6E6E" stroke-width="1.8" stroke-dasharray="5,3" />
            <text
              x="${labelX}"
              y="${labelY}"
              text-anchor="middle"
              font-family="Artifakt Element, Arial, sans-serif"
              font-size="11"
              font-weight="700"
              fill="#1F1F1F"
              style="paint-order:stroke;stroke:#FFFFFF;stroke-width:2;"
              transform="rotate(${labelAngle}, ${labelX}, ${labelY})"
            >L: ${formatDimension(segLength)}</text>
          </g>
        `);
      });
    } else if (isMultiWing && wingDimensions.length > 0) {
      wingDimensions.forEach((wing, idx) => {
        const dirX = Math.cos(wing.direction);
        const dirY = Math.sin(wing.direction);
        const perpX = -dirY;
        const perpY = dirX;
        const halfLen = wing.length / 2;
        const halfWid = wing.width / 2;

        const lenStart = toSVG(wing.center.x - dirX * halfLen, wing.center.y - dirY * halfLen);
        const lenEnd = toSVG(wing.center.x + dirX * halfLen, wing.center.y + dirY * halfLen);
        const widStart = toSVG(wing.center.x - perpX * halfWid, wing.center.y - perpY * halfWid);
        const widEnd = toSVG(wing.center.x + perpX * halfWid, wing.center.y + perpY * halfWid);

        const lenMidX = (lenStart.x + lenEnd.x) / 2;
        const lenMidY = (lenStart.y + lenEnd.y) / 2;
        const lenAngle = Math.atan2(lenEnd.y - lenStart.y, lenEnd.x - lenStart.x) * 180 / Math.PI;
        const lenLabelOffset = 14;
        const lenLabelX = lenMidX + perpX * lenLabelOffset;
        const lenLabelY = lenMidY - perpY * lenLabelOffset;

        const widMidX = (widStart.x + widEnd.x) / 2;
        const widMidY = (widStart.y + widEnd.y) / 2;
        const widAngle = Math.atan2(widEnd.y - widStart.y, widEnd.x - widStart.x) * 180 / Math.PI;
        const widLabelOffset = 12;
        const widLabelX = widMidX + dirX * widLabelOffset;
        const widLabelY = widMidY - dirY * widLabelOffset;
        const centerMarker = toSVG(wing.center.x, wing.center.y);

        dimensionElements.push(`
          <g class="segment-dim segment-dim-${idx}" opacity="1">
            <line x1="${lenStart.x}" y1="${lenStart.y}" x2="${lenEnd.x}" y2="${lenEnd.y}" stroke="#6E6E6E" stroke-width="1.5" stroke-dasharray="4,3" />
            <text
              x="${lenLabelX}"
              y="${lenLabelY}"
              text-anchor="middle"
              font-family="Artifakt Element, Arial, sans-serif"
              font-size="11"
              font-weight="700"
              fill="#1F1F1F"
              style="paint-order:stroke;stroke:#FFFFFF;stroke-width:2;"
              transform="rotate(${lenAngle}, ${lenLabelX}, ${lenLabelY})"
            >L: ${formatDimension(wing.length)}</text>

            <line x1="${widStart.x}" y1="${widStart.y}" x2="${widEnd.x}" y2="${widEnd.y}" stroke="#8A8A8A" stroke-width="1.2" />
            <text
              x="${widLabelX}"
              y="${widLabelY}"
              text-anchor="start"
              font-family="Artifakt Element, Arial, sans-serif"
              font-size="10"
              font-weight="700"
              fill="#1F1F1F"
              style="paint-order:stroke;stroke:#FFFFFF;stroke-width:2;"
              transform="rotate(${widAngle}, ${widLabelX}, ${widLabelY})"
            >D: ${formatDimension(wing.width)}</text>
            <circle cx="${centerMarker.x}" cy="${centerMarker.y}" r="7" fill="#FFFFFF" stroke="#303030" stroke-width="1.5" />
            <text
              x="${centerMarker.x}"
              y="${centerMarker.y + 0.5}"
              text-anchor="middle"
              dominant-baseline="middle"
              font-family="Artifakt Element, Arial, sans-serif"
              font-size="9"
              font-weight="700"
              fill="#303030"
            >${idx + 1}</text>
          </g>
        `);
      });

      const legendWidth = 170;
      const legendLineHeight = 14;
      const legendHeight = 26 + wingDimensions.length * legendLineHeight;
      const legendX = 8;
      const legendY = 8;
      const legendRows = wingDimensions.map((wing, idx) => (
        `<text x="${legendX + 10}" y="${legendY + 22 + idx * legendLineHeight}" font-family="Artifakt Element, Arial, sans-serif" font-size="10" font-weight="700" fill="#1F1F1F">${idx + 1}) L ${formatDimension(wing.length)}  D ${formatDimension(wing.width)}</text>`
      )).join('');
      dimensionElements.push(`
        <g class="segment-dim-legend" opacity="0.98">
          <rect x="${legendX}" y="${legendY}" width="${legendWidth}" height="${legendHeight}" rx="4" ry="4" fill="#FFFFFF" stroke="#9A9A9A" stroke-width="1" />
          <text x="${legendX + 10}" y="${legendY + 12}" font-family="Artifakt Element, Arial, sans-serif" font-size="10" font-weight="700" fill="#303030">Wing dimensions</text>
          ${legendRows}
        </g>
      `);
    } else {
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;

      // Length dimension (bottom)
      const lengthLabelPos = toSVG(midX, minY);
      dimensionElements.push(`
        <text
          x="${lengthLabelPos.x}"
          y="${lengthLabelPos.y + 30}"
          text-anchor="middle"
          font-family="Artifakt Element, Arial, sans-serif"
          font-size="12"
          font-weight="bold"
          fill="#3C3C3C"
        >${formatDimension(renderLength)}</text>
      `);

      // Depth dimension (left)
      const depthLabelPos = toSVG(minX, midY);
      dimensionElements.push(`
        <text
          x="${depthLabelPos.x - 20}"
          y="${depthLabelPos.y}"
          text-anchor="middle"
          font-family="Artifakt Element, Arial, sans-serif"
          font-size="12"
          font-weight="bold"
          fill="#3C3C3C"
          transform="rotate(-90, ${depthLabelPos.x - 20}, ${depthLabelPos.y})"
        >${formatDimension(renderDepth)}</text>
      `);
    }
  }

  // Corridor — render all segments for multi-wing, or primary corridor for single bar
  if (corridorSegments.length > 0) {
    corridorSegments.forEach((seg, idx) => {
      const showLabelForSegment = !isMultiWing || idx === 0;
      elements.push(renderCorridor(seg, scale, toSVG, showLabelForSegment));
    });
  } else {
    elements.push(renderCorridor(corridor, scale, toSVG, true));
  }

  // Cores
  cores.forEach(core => {
    elements.push(renderCore(core, scale, toSVG));
  });

  // Fillers are rendered as core-like blocks to show footprint coverage.
  fillers.forEach((filler, idx) => {
    elements.push(renderFillerAsCore(filler, idx, scale, toSVG));
  });

  // Units
  units.forEach(unit => {
    elements.push(renderUnit(unit, scale, toSVG, showLabels, showAreas));
  });

  // Draw dimensions last so labels are visible over units.
  elements.push(...dimensionElements);

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

function renderFillerAsCore(
  filler: FillerBlock,
  idx: number,
  scale: number,
  toSVG: (x: number, y: number) => { x: number; y: number }
): string {
  const asCore: CoreBlock = {
    id: filler.id || `filler-${idx}`,
    x: filler.x,
    y: filler.y,
    width: filler.width,
    depth: filler.depth,
    type: 'Mid',
    side: filler.side,
    polyPoints: filler.polyPoints
  };
  return renderCore(asCore, scale, toSVG);
}

/**
 * Render corridor as SVG
 */
function renderCorridor(
  corridor: CorridorBlock,
  scale: number,
  toSVG: (x: number, y: number) => { x: number; y: number },
  showLabel: boolean
): string {
  if (corridor.polyPoints && corridor.polyPoints.length >= 3) {
    const svgPoints = corridor.polyPoints.map(p => toSVG(p.x, p.y));
    const pointsString = svgPoints.map(p => `${p.x},${p.y}`).join(' ');
    const centerX = svgPoints.reduce((s, p) => s + p.x, 0) / svgPoints.length;
    const centerY = svgPoints.reduce((s, p) => s + p.y, 0) / svgPoints.length;
    const corridorWidthFeet = Math.round(metersToFeet(corridor.depth));
    return `
      <g class="corridor">
        <polygon
          points="${pointsString}"
          fill="${SVG_COLORS.Corridor}"
          stroke="${SVG_COLORS.Corridor}"
          stroke-width="1"
        />
        ${showLabel ? `
        <text
          x="${centerX}"
          y="${centerY + 4}"
          text-anchor="middle"
          class="corridor-label"
          font-size="11"
        >Corridor (${corridorWidthFeet}')</text>
        ` : ''}
      </g>
    `;
  }

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
        stroke="${SVG_COLORS.Corridor}"
        stroke-width="1"
      />
      ${showLabel ? `
      <text
        x="${centerX}"
        y="${centerY + 4}"
        text-anchor="middle"
        class="corridor-label"
        font-size="11"
      >Corridor (${corridorWidthFeet}')</text>
      ` : ''}
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
  if (core.polyPoints && core.polyPoints.length >= 3) {
    const svgPoints = core.polyPoints.map(p => toSVG(p.x, p.y));
    const pointsString = svgPoints.map(p => `${p.x},${p.y}`).join(' ');
    const centerX = svgPoints.reduce((s, p) => s + p.x, 0) / svgPoints.length;
    const centerY = svgPoints.reduce((s, p) => s + p.y, 0) / svgPoints.length;
    const minX = Math.min(...svgPoints.map(p => p.x));
    const maxX = Math.max(...svgPoints.map(p => p.x));
    const minY = Math.min(...svgPoints.map(p => p.y));
    const maxY = Math.max(...svgPoints.map(p => p.y));
    const width = maxX - minX;
    const height = maxY - minY;
    const fontSize = Math.min(12, Math.min(width, height) * 0.3);
    return `
      <g class="core">
        <polygon
          points="${pointsString}"
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
        >CORE</text>
      </g>
    `;
  }

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
