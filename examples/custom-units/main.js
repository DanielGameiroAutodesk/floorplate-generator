/**
 * Custom Unit Types Example
 *
 * Demonstrates how to configure custom unit types for the Floorplate Generator.
 *
 * This example shows:
 * 1. Defining unit types with custom dimensions
 * 2. Setting percentage targets for unit mix
 * 3. Configuring colors for visualization
 * 4. Advanced options like L-shape eligibility
 */

// Default unit types (US multifamily standard)
const defaultUnitTypes = [
  { id: 'studio', name: 'Studio', area: 500, percentage: 20, color: '#FFC0CB' },
  { id: '1br', name: '1BR', area: 750, percentage: 30, color: '#98FB98' },
  { id: '2br', name: '2BR', area: 1000, percentage: 35, color: '#87CEEB' },
  { id: '3br', name: '3BR', area: 1250, percentage: 15, color: '#DDA0DD' }
];

let unitTypes = [...defaultUnitTypes];
let nextId = 1;

/**
 * Render all unit type cards
 */
function renderUnitTypes() {
  const container = document.getElementById('unit-types');
  container.innerHTML = unitTypes.map((ut, index) => `
    <div class="unit-type" data-index="${index}">
      <h4>
        <span style="display:inline-block;width:16px;height:16px;background:${ut.color};vertical-align:middle;margin-right:8px;border-radius:2px;"></span>
        ${ut.name}
        <button class="remove-btn" onclick="removeUnitType(${index})" ${unitTypes.length <= 1 ? 'disabled' : ''}>Remove</button>
      </h4>
      <label>Name: <input type="text" value="${ut.name}" onchange="updateUnit(${index}, 'name', this.value)"></label>
      <label>Area (sq ft): <input type="number" value="${ut.area}" min="200" max="3000" step="50" onchange="updateUnit(${index}, 'area', +this.value)"></label>
      <label>Target %: <input type="number" value="${ut.percentage}" min="0" max="100" step="5" onchange="updateUnit(${index}, 'percentage', +this.value)"></label>
      <label>Color: <input type="color" value="${ut.color}" onchange="updateUnit(${index}, 'color', this.value)"></label>
    </div>
  `).join('');
}

/**
 * Update a unit type property
 */
window.updateUnit = function(index, property, value) {
  unitTypes[index][property] = value;
  if (property === 'name') {
    // Update ID to match name (lowercase, no spaces)
    unitTypes[index].id = value.toLowerCase().replace(/\s+/g, '-');
  }
  renderUnitTypes();
};

/**
 * Add a new unit type
 */
window.addUnitType = function() {
  const newType = {
    id: `custom-${nextId++}`,
    name: `Custom ${nextId}`,
    area: 800,
    percentage: 0,
    color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
  };
  unitTypes.push(newType);
  renderUnitTypes();
};

/**
 * Remove a unit type
 */
window.removeUnitType = function(index) {
  if (unitTypes.length > 1) {
    unitTypes.splice(index, 1);
    renderUnitTypes();
  }
};

/**
 * Generate a preview of the configuration
 */
window.generatePreview = function() {
  const output = document.getElementById('output');
  const status = document.getElementById('status');

  // Validate percentages
  const totalPercentage = unitTypes.reduce((sum, ut) => sum + ut.percentage, 0);

  // Convert to generator format
  const config = unitTypes.map(ut => ({
    typeId: ut.id,
    typeName: ut.name,
    targetArea: ut.area * 0.0929,  // Convert sq ft to sq m
    targetPercentage: ut.percentage / 100,
    color: hexToRgba(ut.color),
    // Advanced options (defaults)
    minDepth: 6 * 0.3048,  // 6 ft in meters
    maxDepth: 12 * 0.3048, // 12 ft in meters
    canBeLShaped: ut.area >= 700, // Allow L-shapes for larger units
    isCornerEligible: true
  }));

  output.textContent = `Unit Types Configuration
========================
Total percentage: ${totalPercentage}% ${totalPercentage !== 100 ? '(Warning: should equal 100%)' : '(OK)'}

${unitTypes.map(ut => `
${ut.name} (${ut.id})
  Target area: ${ut.area} sq ft (${(ut.area * 0.0929).toFixed(1)} sq m)
  Target mix:  ${ut.percentage}%
  Color:       ${ut.color}
  L-shape OK:  ${ut.area >= 700 ? 'Yes' : 'No'}`).join('\n')}

Generator Config (JSON):
${JSON.stringify(config, null, 2)}`;

  status.textContent = totalPercentage === 100 ? 'Configuration valid' : 'Warning: percentages should sum to 100%';
};

/**
 * Convert hex color to RGBA object
 */
function hexToRgba(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    a: 255
  } : { r: 200, g: 200, b: 200, a: 255 };
}

/**
 * Apply configuration to the main generator (if running in Forma)
 */
window.applyToGenerator = async function() {
  const status = document.getElementById('status');

  // Check if we're in Forma context
  if (typeof window.parent !== 'undefined' && window.parent !== window) {
    // Try to communicate with parent frame (main extension)
    try {
      window.parent.postMessage({
        type: 'UNIT_TYPES_UPDATE',
        payload: unitTypes.map(ut => ({
          typeId: ut.id,
          typeName: ut.name,
          targetArea: ut.area * 0.0929,
          targetPercentage: ut.percentage / 100,
          color: hexToRgba(ut.color),
          canBeLShaped: ut.area >= 700,
          isCornerEligible: true
        }))
      }, '*');
      status.textContent = 'Configuration sent to generator';
    } catch (err) {
      status.textContent = 'Error: Could not communicate with generator';
    }
  } else {
    status.textContent = 'Note: Not running in Forma. Copy the JSON config manually.';
    generatePreview();
  }
};

// Initialize
renderUnitTypes();
