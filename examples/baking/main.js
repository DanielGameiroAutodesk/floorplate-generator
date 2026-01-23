/**
 * Baking Workflow Example
 *
 * Demonstrates the complete workflow for:
 * 1. Selecting a building in Forma
 * 2. Generating a floorplate layout
 * 3. Baking the layout into a native Forma building
 *
 * Uses the FloorStack SDK API (v0.90.0) for building creation.
 */

import { Forma } from "https://esm.sh/forma-embedded-view-sdk@0.90.0/auto";

// State
let selectedPath = null;
let selectedFootprint = null;
let generatedFloorplan = null;

const output = document.getElementById('output');

function log(message) {
  output.textContent += '\n' + message;
  output.scrollTop = output.scrollHeight;
}

function setStepState(stepId, state) {
  const step = document.getElementById(stepId);
  step.classList.remove('complete', 'active', 'error');
  if (state) step.classList.add(state);
}

// ============================================================================
// Step 1: Select Building
// ============================================================================
window.selectBuilding = async function() {
  setStepState('step1', 'active');
  const result = document.getElementById('step1-result');

  try {
    log('Getting selection...');
    const selection = await Forma.selection.getSelection();

    if (!selection.length) {
      throw new Error('Please select a building in Forma');
    }

    selectedPath = selection[0];
    log(`Selected: ${selectedPath}`);

    // Get triangles to analyze footprint
    log('Fetching geometry...');
    const triangles = await Forma.geometry.getTriangles({ path: selectedPath });

    if (!triangles || triangles.length === 0) {
      throw new Error('No geometry found for selected element');
    }

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < triangles.length; i += 3) {
      const x = triangles[i], y = triangles[i + 1], z = triangles[i + 2];
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }

    selectedFootprint = {
      length: maxX - minX,
      depth: maxY - minY,
      height: maxZ - minZ,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      elevation: minZ
    };

    log(`Footprint: ${selectedFootprint.length.toFixed(1)}m x ${selectedFootprint.depth.toFixed(1)}m`);
    log(`Center: (${selectedFootprint.centerX.toFixed(1)}, ${selectedFootprint.centerY.toFixed(1)})`);

    result.innerHTML = `<div class="result success">
      Building selected: ${selectedFootprint.length.toFixed(1)}m x ${selectedFootprint.depth.toFixed(1)}m
      <br>Height: ${selectedFootprint.height.toFixed(1)}m
    </div>`;

    setStepState('step1', 'complete');
    document.getElementById('generateBtn').disabled = false;

  } catch (err) {
    log(`Error: ${err.message}`);
    result.innerHTML = `<div class="result error">${err.message}</div>`;
    setStepState('step1', 'error');
  }
};

// ============================================================================
// Step 2: Generate Floorplate
// ============================================================================
window.generateFloorplate = async function() {
  setStepState('step2', 'active');
  const result = document.getElementById('step2-result');

  try {
    log('Generating floorplate...');

    // Create a simple floorplate (in real usage, use the full generator)
    const numFloors = parseInt(document.getElementById('numFloors').value) || 5;
    const FLOOR_HEIGHT = 3.2;
    const CORRIDOR_WIDTH = 1.83; // 6 ft

    // Simple double-loaded corridor layout
    const unitDepth = (selectedFootprint.depth - CORRIDOR_WIDTH) / 2;
    const unitWidth = selectedFootprint.length / 4; // 4 units per side

    generatedFloorplan = {
      buildingLength: selectedFootprint.length,
      buildingDepth: selectedFootprint.depth,
      floorElevation: selectedFootprint.elevation,
      numFloors: numFloors,
      units: [],
      cores: [
        { id: 'core-1', x: 0, y: unitDepth, width: 3, depth: CORRIDOR_WIDTH, type: 'End', side: 'North' },
        { id: 'core-2', x: selectedFootprint.length - 3, y: unitDepth, width: 3, depth: CORRIDOR_WIDTH, type: 'End', side: 'North' }
      ],
      corridor: {
        x: 0,
        y: unitDepth,
        width: selectedFootprint.length,
        depth: CORRIDOR_WIDTH
      },
      transform: {
        centerX: selectedFootprint.centerX,
        centerY: selectedFootprint.centerY,
        rotation: 0
      }
    };

    // Generate units on north side
    for (let i = 0; i < 4; i++) {
      generatedFloorplan.units.push({
        id: `unit-n-${i}`,
        typeId: i % 2 === 0 ? '1br' : '2br',
        typeName: i % 2 === 0 ? '1BR' : '2BR',
        x: i * unitWidth,
        y: 0,
        width: unitWidth,
        depth: unitDepth,
        area: unitWidth * unitDepth,
        color: i % 2 === 0 ? '#98FB98' : '#87CEEB',
        side: 'North',
        isLShaped: false
      });
    }

    // Generate units on south side
    for (let i = 0; i < 4; i++) {
      generatedFloorplan.units.push({
        id: `unit-s-${i}`,
        typeId: i % 2 === 0 ? 'studio' : '1br',
        typeName: i % 2 === 0 ? 'Studio' : '1BR',
        x: i * unitWidth,
        y: unitDepth + CORRIDOR_WIDTH,
        width: unitWidth,
        depth: unitDepth,
        area: unitWidth * unitDepth,
        color: i % 2 === 0 ? '#FFC0CB' : '#98FB98',
        side: 'South',
        isLShaped: false
      });
    }

    log(`Generated ${generatedFloorplan.units.length} units, ${numFloors} floors`);
    log(`Cores: ${generatedFloorplan.cores.length}, Corridor: ${selectedFootprint.length.toFixed(1)}m`);

    result.innerHTML = `<div class="result success">
      Generated ${generatedFloorplan.units.length} units x ${numFloors} floors
      <br>2 cores, central corridor
    </div>`;

    setStepState('step2', 'complete');
    document.getElementById('bakeBtn').disabled = false;
    document.getElementById('bakeReplaceBtn').disabled = false;

  } catch (err) {
    log(`Error: ${err.message}`);
    result.innerHTML = `<div class="result error">${err.message}</div>`;
    setStepState('step2', 'error');
  }
};

// ============================================================================
// Step 3: Bake Building
// ============================================================================
window.bakeBuilding = async function(replaceOriginal = false) {
  setStepState('step3', 'active');
  const result = document.getElementById('step3-result');

  try {
    log('Converting to FloorStack format...');

    const FLOOR_HEIGHT = 3.2;
    const halfWidth = generatedFloorplan.buildingLength / 2;
    const halfDepth = generatedFloorplan.buildingDepth / 2;

    // Convert to FloorStack Plan format
    const vertices = [];
    const units = [];
    const vertexMap = new Map();
    let vertexIndex = 0;

    function getOrAddVertex(x, y) {
      // Center coordinates
      const cx = x - halfWidth;
      const cy = y - halfDepth;
      const key = `${cx.toFixed(4)},${cy.toFixed(4)}`;

      if (vertexMap.has(key)) {
        return vertexMap.get(key);
      }

      const id = `v${vertexIndex++}`;
      vertices.push({ id, x: cx, y: cy });
      vertexMap.set(key, id);
      return id;
    }

    // Convert units
    for (const unit of generatedFloorplan.units) {
      const v1 = getOrAddVertex(unit.x, unit.y);
      const v2 = getOrAddVertex(unit.x + unit.width, unit.y);
      const v3 = getOrAddVertex(unit.x + unit.width, unit.y + unit.depth);
      const v4 = getOrAddVertex(unit.x, unit.y + unit.depth);
      units.push({ polygon: [v1, v2, v3, v4], holes: [], program: 'LIVING_UNIT' });
    }

    // Convert cores
    for (const core of generatedFloorplan.cores) {
      const v1 = getOrAddVertex(core.x, core.y);
      const v2 = getOrAddVertex(core.x + core.width, core.y);
      const v3 = getOrAddVertex(core.x + core.width, core.y + core.depth);
      const v4 = getOrAddVertex(core.x, core.y + core.depth);
      units.push({ polygon: [v1, v2, v3, v4], holes: [], program: 'CORE' });
    }

    // Convert corridor
    const corridor = generatedFloorplan.corridor;
    const cv1 = getOrAddVertex(corridor.x, corridor.y);
    const cv2 = getOrAddVertex(corridor.x + corridor.width, corridor.y);
    const cv3 = getOrAddVertex(corridor.x + corridor.width, corridor.y + corridor.depth);
    const cv4 = getOrAddVertex(corridor.x, corridor.y + corridor.depth);
    units.push({ polygon: [cv1, cv2, cv3, cv4], holes: [], program: 'CORRIDOR' });

    const plan = { id: 'plan1', vertices, units };

    log(`Plan: ${vertices.length} vertices, ${units.length} units`);
    log('Creating building via FloorStack API...');

    // Create floors referencing the plan
    const floors = Array.from({ length: generatedFloorplan.numFloors }, () => ({
      planId: plan.id,
      height: FLOOR_HEIGHT
    }));

    // Call FloorStack API
    const { urn } = await Forma.elements.floorStack.createFromFloors({
      floors,
      plans: [plan]
    });

    log(`Building created: ${urn}`);

    // Calculate transform with position compensation
    const cos = Math.cos(generatedFloorplan.transform.rotation);
    const sin = Math.sin(generatedFloorplan.transform.rotation);

    const offsetX = (-halfWidth) * cos - (-halfDepth) * sin;
    const offsetY = (-halfWidth) * sin + (-halfDepth) * cos;

    const transform = [
      cos, sin, 0, 0,
      -sin, cos, 0, 0,
      0, 0, 1, 0,
      generatedFloorplan.transform.centerX - offsetX,
      generatedFloorplan.transform.centerY - offsetY,
      generatedFloorplan.floorElevation,
      1
    ];

    log('Adding to proposal...');
    await Forma.proposal.addElement({ urn, transform });

    // Remove original if requested
    if (replaceOriginal && selectedPath) {
      log('Removing original building...');
      try {
        await Forma.proposal.removeElement({ path: selectedPath });
        log('Original removed');
      } catch (e) {
        log(`Warning: Could not remove original: ${e.message}`);
      }
    }

    log('Bake complete!');

    result.innerHTML = `<div class="result success">
      Building baked successfully!
      <br>URN: ${urn.substring(0, 50)}...
      ${replaceOriginal ? '<br>Original building removed' : ''}
    </div>`;

    setStepState('step3', 'complete');

  } catch (err) {
    log(`Error: ${err.message}`);
    console.error(err);
    result.innerHTML = `<div class="result error">${err.message}</div>`;
    setStepState('step3', 'error');
  }
};

// Initialize
log('Baking example loaded');
log('SDK: forma-embedded-view-sdk@0.90.0');
