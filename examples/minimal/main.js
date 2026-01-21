/**
 * Minimal Forma Extension Example
 *
 * This ~50 line example demonstrates the 5 core concepts for building
 * Forma extensions:
 *
 * 1. CONNECT - Import and initialize the Forma SDK
 * 2. SELECT  - Get the user's current building selection
 * 3. READ    - Fetch geometry data (triangles) for the selected element
 * 4. PROCESS - Perform calculations (bounding box analysis)
 * 5. DISPLAY - Show results to the user
 */

// ============================================================================
// 1. CONNECT - Import the Forma SDK
// ============================================================================
import { Forma } from "https://esm.sh/forma-embedded-view-sdk@latest/auto";

// ============================================================================
// 2. SELECT - Get the user's current selection
// ============================================================================
async function getSelectedBuilding() {
  const selection = await Forma.selection.getSelection();
  if (!selection.length) {
    throw new Error("Please select a building in Forma");
  }
  return selection[0]; // Return the first selected element path
}

// ============================================================================
// 3. READ - Fetch geometry data for the element
// ============================================================================
async function getGeometry(elementPath) {
  const triangles = await Forma.geometry.getTriangles({ path: elementPath });
  if (!triangles || triangles.length === 0) {
    throw new Error("No geometry found for selected element");
  }
  return triangles;
}

// ============================================================================
// 4. PROCESS - Calculate bounding box from triangle vertices
// ============================================================================
function calculateBoundingBox(triangles) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  // Triangles are stored as [x1,y1,z1, x2,y2,z2, x3,y3,z3, ...]
  for (let i = 0; i < triangles.length; i += 3) {
    const x = triangles[i], y = triangles[i + 1], z = triangles[i + 2];
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }

  return {
    width: maxX - minX,
    depth: maxY - minY,
    height: maxZ - minZ,
    volume: (maxX - minX) * (maxY - minY) * (maxZ - minZ),
    footprint: (maxX - minX) * (maxY - minY),
  };
}

// ============================================================================
// 5. DISPLAY - Main function that ties everything together
// ============================================================================
window.analyzeBuilding = async function() {
  const status = document.getElementById("status");
  const output = document.getElementById("output");
  const btn = document.getElementById("analyzeBtn");

  try {
    btn.disabled = true;
    status.textContent = "Getting selection...";
    const path = await getSelectedBuilding();

    status.textContent = "Reading geometry...";
    const triangles = await getGeometry(path);

    status.textContent = "Analyzing...";
    const bbox = calculateBoundingBox(triangles);

    output.textContent = `Building Analysis
================
Width:     ${bbox.width.toFixed(2)} m (${(bbox.width * 3.281).toFixed(0)} ft)
Depth:     ${bbox.depth.toFixed(2)} m (${(bbox.depth * 3.281).toFixed(0)} ft)
Height:    ${bbox.height.toFixed(2)} m (${(bbox.height * 3.281).toFixed(0)} ft)
Footprint: ${bbox.footprint.toFixed(0)} sq m (${(bbox.footprint * 10.764).toFixed(0)} sq ft)
Volume:    ${bbox.volume.toFixed(0)} cubic m

Vertices:  ${(triangles.length / 3).toLocaleString()} points
Triangles: ${(triangles.length / 9).toLocaleString()} faces`;

    status.textContent = "Done!";
  } catch (err) {
    output.textContent = `Error: ${err.message}`;
    status.textContent = "Failed";
  } finally {
    btn.disabled = false;
  }
};
