/**
 * Converts a line/polyline into a closed footprint polygon by buffering it.
 */

export type Vec3 = { x: number; y: number; z: number };

function getUnitVectorXY(p1: Vec3, p2: Vec3): Vec3 {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: dx / len, y: dy / len, z: 0 };
}

function getUnitNormalVectorXY(p1: Vec3, p2: Vec3): Vec3 {
  const uv = getUnitVectorXY(p1, p2);
  // Normal is (-y, x) for left side
  return { x: -uv.y, y: uv.x, z: 0 };
}

function getUnitNormalVectors(pts: Vec3[]): Vec3[] {
  const normals: Vec3[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    normals.push(getUnitNormalVectorXY(pts[i], pts[i + 1]));
  }
  return normals;
}

function getCornerShiftsOpen(pts: Vec3[], distance: number): Vec3[] {
  const shifts: Vec3[] = [];
  const normals = getUnitNormalVectors(pts);

  if (pts.length < 2) return shifts;

  // First point shift is just the normal of the first segment * distance
  shifts.push({ x: normals[0].x * distance, y: normals[0].y * distance, z: 0 });

  // Intermediate points
  for (let i = 1; i < pts.length - 1; i++) {
    const n1 = normals[i - 1];
    const n2 = normals[i];

    // Miter joint calculation
    // direction of the bisector
    const nSumX = n1.x + n2.x;
    const nSumY = n1.y + n2.y;
    
    // cross product to find sine of angle between normals
    const cross = n1.x * n2.y - n1.y * n2.x;
    const dot = n1.x * n2.x + n1.y * n2.y;

    if (Math.abs(cross) < 1e-6 && dot > 0) {
      // Parallel, same direction
      shifts.push({ x: n1.x * distance, y: n1.y * distance, z: 0 });
    } else if (Math.abs(cross) < 1e-6 && dot < 0) {
      // Parallel, opposite direction (folding back on itself)
      shifts.push({ x: n1.x * distance, y: n1.y * distance, z: 0 });
    } else {
      // Length of nSum vector
      const len2 = nSumX * nSumX + nSumY * nSumY;
      const miterFactor = 2 / len2; // this correctly scales the bisector for the offset distance
      
      shifts.push({
        x: nSumX * miterFactor * distance,
        y: nSumY * miterFactor * distance,
        z: 0
      });
    }
  }

  // Last point shift is the normal of the last segment * distance
  shifts.push({
    x: normals[normals.length - 1].x * distance,
    y: normals[normals.length - 1].y * distance,
    z: 0
  });

  return shifts;
}

function isClosedLine(pts: Vec3[]): boolean {
  if (pts.length < 3) return false;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const dist = Math.sqrt((first.x - last.x)**2 + (first.y - last.y)**2);
  return dist < 0.1; // within 10 cm
}

function getCornerShiftsClosed(pts: Vec3[], distance: number): Vec3[] {
  const shifts: Vec3[] = [];
  const n = pts.length - 1; // actual unique points
  const normals = getUnitNormalVectors(pts); // has n segments

  for (let i = 0; i < n; i++) {
    const prevIdx = (i - 1 + n) % n;
    const n1 = normals[prevIdx];
    const n2 = normals[i];

    // Miter joint
    const nSumX = n1.x + n2.x;
    const nSumY = n1.y + n2.y;
    
    const cross = n1.x * n2.y - n1.y * n2.x;
    const dot = n1.x * n2.x + n1.y * n2.y;

    if (Math.abs(cross) < 1e-6 && dot > 0) {
      shifts.push({ x: n1.x * distance, y: n1.y * distance, z: 0 });
    } else if (Math.abs(cross) < 1e-6 && dot < 0) {
      shifts.push({ x: n1.x * distance, y: n1.y * distance, z: 0 });
    } else {
      const len2 = nSumX * nSumX + nSumY * nSumY;
      const miterFactor = 2 / len2;
      shifts.push({
        x: nSumX * miterFactor * distance,
        y: nSumY * miterFactor * distance,
        z: 0
      });
    }
  }
  // The last point gets the exact same shift as the first
  shifts.push(shifts[0]);
  return shifts;
}

function bufferLine(pts: Vec3[], distance: number): Vec3[] {
  const closed = isClosedLine(pts);
  const shifts = closed ? getCornerShiftsClosed(pts, distance) : getCornerShiftsOpen(pts, distance);
  return pts.map((p, i) => ({
    x: p.x + shifts[i].x,
    y: p.y + shifts[i].y,
    z: p.z
  }));
}

export function lineToFootprintTopology(coordinates: Vec3[], width: number): { outer: { x: number, y: number }[], holes: { x: number, y: number }[][] } {
  if (!coordinates || coordinates.length < 2) return { outer: [], holes: [] };

  const closed = isClosedLine(coordinates);
  const halfWidth = width / 2;

  const leftSide = bufferLine(coordinates, halfWidth);
  const rightSide = bufferLine(coordinates, -halfWidth);

  if (closed) {
    // Determine which is outer and which is inner based on area (signed area)
    const areaLeft = getSignedArea(leftSide);
    const areaRight = getSignedArea(rightSide);
    
    // We want the outer boundary to be the one with the larger absolute area,
    // and we must ensure counter-clockwise orientation for outer, clockwise for hole.
    const outerLoop = Math.abs(areaLeft) > Math.abs(areaRight) ? leftSide : rightSide;
    const innerLoop = Math.abs(areaLeft) > Math.abs(areaRight) ? rightSide : leftSide;
    
    // Convert to {x,y} arrays
    const outerPts = outerLoop.map(p => ({ x: p.x, y: p.y }));
    const innerPts = innerLoop.map(p => ({ x: p.x, y: p.y }));
    
    // We can pop the last point to make them proper polygons (since last == first)
    outerPts.pop();
    innerPts.pop();

    return {
      outer: outerPts,
      holes: [innerPts]
    };
  } else {
    // Open line: combine left and right to form a single polygon
    const closedPolygon = [
      ...leftSide,
      ...rightSide.reverse()
    ];
    return {
      outer: closedPolygon.map(p => ({ x: p.x, y: p.y })),
      holes: []
    };
  }
}

function getSignedArea(pts: Vec3[]): number {
  let area = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    area += pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y;
  }
  return area / 2;
}

/**
 * Buffers a line by width to create a closed footprint polygon.
 * 
 * @param coordinates Array of Vec3 points representing the line
 * @param width Width to buffer (total width, will be buffered by width/2 on each side)
 * @returns Array of {x, y} points representing the closed polygon
 */
export function lineToFootprintPolygon(coordinates: Vec3[], width: number): { x: number, y: number }[] {
  return lineToFootprintTopology(coordinates, width).outer;
}