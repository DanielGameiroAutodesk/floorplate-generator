/**
 * Building Inspector - Fetches all metadata from native Forma buildings
 *
 * This module provides functionality to inspect native buildings in Forma
 * and display all available metadata including:
 * - Element properties and URN
 * - Graph Building (units, spaces, levels)
 * - Gross Floor Area Polygons (CORE, CORRIDOR, LIVING_UNIT, UNASSIGNED)
 * - Footprint geometry
 * - World transform matrix
 */

import { Forma } from 'forma-embedded-view-sdk/auto';

// Store the last inspection data for copy functionality
let lastInspectionData: Record<string, unknown> | null = null;

/**
 * Syntax-highlight JSON for display
 */
function syntaxHighlightJson(json: string): string {
  return json
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
      if (match.endsWith(':')) {
        return `<span class="key">${match}</span>`;
      }
      return `<span class="string">${match}</span>`;
    })
    .replace(/\b(true|false)\b/g, '<span class="boolean">$1</span>')
    .replace(/\b(null)\b/g, '<span class="null">$1</span>')
    .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="number">$1</span>');
}

/**
 * Set the inspection status message
 */
function setInspectStatus(type: 'loading' | 'success' | 'error', message: string): void {
  const statusEl = document.getElementById('inspect-status');
  const statusTextEl = document.getElementById('inspect-status-text');
  if (statusEl && statusTextEl) {
    statusEl.style.display = 'block';
    statusEl.className = `inspect-status ${type}`;
    statusTextEl.textContent = message;
  }
}

/**
 * Hide the inspection status message
 */
function hideInspectStatus(): void {
  const statusEl = document.getElementById('inspect-status');
  if (statusEl) {
    statusEl.style.display = 'none';
  }
}

/**
 * Handle inspect building button click
 */
async function handleInspectBuilding(): Promise<void> {
  const inspectBtn = document.getElementById('inspect-btn') as HTMLButtonElement;
  const resultsEl = document.getElementById('inspect-results');
  const summaryEl = document.getElementById('inspect-summary');
  const dataSectionsEl = document.getElementById('inspect-data-sections');
  const copyAllBtn = document.getElementById('copy-all-btn');

  if (inspectBtn) {
    inspectBtn.disabled = true;
    inspectBtn.innerHTML = '<span class="generate-btn-icon">&#128269;</span> Inspecting...';
  }

  setInspectStatus('loading', 'Fetching building data...');

  try {
    // Get current selection
    const selection = await Forma.selection.getSelection();

    if (!selection || selection.length === 0) {
      setInspectStatus('error', 'Please select a building in Forma first');
      return;
    }

    const path = selection[0];
    console.log('Inspecting element at path:', path);

    // Fetch element data
    const { element, elements } = await Forma.elements.getByPath({ path, recursive: true });
    console.log('Element:', element);
    console.log('All elements:', elements);

    // Fetch world transform
    const { transform } = await Forma.elements.getWorldTransform({ path });
    console.log('World transform:', transform);

    // Fetch representations
    let graphBuilding = null;
    let grossFloorAreaPolygons = null;
    let footprint = null;

    if (element.representations?.graphBuilding) {
      try {
        graphBuilding = await Forma.elements.representations.graphBuilding({ urn: element.urn });
        console.log('Graph Building:', graphBuilding);
      } catch (e) {
        console.warn('Could not fetch graphBuilding representation:', e);
      }
    }

    if (element.representations?.grossFloorAreaPolygons) {
      try {
        grossFloorAreaPolygons = await Forma.elements.representations.grossFloorAreaPolygons({ urn: element.urn });
        console.log('GFA Polygons:', grossFloorAreaPolygons);
      } catch (e) {
        console.warn('Could not fetch grossFloorAreaPolygons representation:', e);
      }
    }

    if (element.representations?.footprint) {
      try {
        footprint = await Forma.elements.representations.footprint({ urn: element.urn });
        console.log('Footprint:', footprint);
      } catch (e) {
        console.warn('Could not fetch footprint representation:', e);
      }
    }

    // Store for copy functionality
    lastInspectionData = {
      path,
      element,
      allElements: elements,
      transform,
      graphBuilding,
      grossFloorAreaPolygons,
      footprint
    };

    // Update UI - hide empty state, show results
    if (resultsEl) {
      const emptyEl = resultsEl.querySelector('.inspect-empty');
      if (emptyEl) (emptyEl as HTMLElement).style.display = 'none';
    }

    // Update summary cards
    if (summaryEl) {
      summaryEl.style.display = 'block';

      const categoryEl = document.getElementById('summary-category');
      const unitsEl = document.getElementById('summary-units');
      const levelsEl = document.getElementById('summary-levels');
      const gfaEl = document.getElementById('summary-gfa');

      if (categoryEl) categoryEl.textContent = element.properties?.category || 'N/A';
      if (unitsEl) unitsEl.textContent = graphBuilding?.data?.units?.length?.toString() || 'N/A';
      if (levelsEl) levelsEl.textContent = graphBuilding?.data?.levels?.length?.toString() || 'N/A';
      if (gfaEl) gfaEl.textContent = grossFloorAreaPolygons ? 'Yes' : 'No';
    }

    // Update data sections
    if (dataSectionsEl) {
      dataSectionsEl.style.display = 'block';

      // Element properties
      const elementJson = document.getElementById('json-element');
      if (elementJson) {
        elementJson.innerHTML = syntaxHighlightJson(JSON.stringify({
          urn: element.urn,
          properties: element.properties,
          metadata: element.metadata,
          representations: Object.keys(element.representations || {}),
          childrenCount: element.children?.length || 0
        }, null, 2));
      }

      // Graph Building
      const graphBuildingJson = document.getElementById('json-graphBuilding');
      if (graphBuildingJson) {
        if (graphBuilding?.data) {
          graphBuildingJson.innerHTML = syntaxHighlightJson(JSON.stringify(graphBuilding.data, null, 2));
        } else {
          graphBuildingJson.textContent = 'No graphBuilding representation available';
        }
      }

      // GFA Polygons
      const gfaJson = document.getElementById('json-gfa');
      if (gfaJson) {
        if (grossFloorAreaPolygons?.data) {
          gfaJson.innerHTML = syntaxHighlightJson(JSON.stringify(grossFloorAreaPolygons.data, null, 2));
        } else {
          gfaJson.textContent = 'No grossFloorAreaPolygons representation available';
        }
      }

      // Footprint
      const footprintJson = document.getElementById('json-footprint');
      if (footprintJson) {
        if (footprint?.data) {
          footprintJson.innerHTML = syntaxHighlightJson(JSON.stringify(footprint.data, null, 2));
        } else {
          footprintJson.textContent = 'No footprint representation available';
        }
      }

      // Transform
      const transformJson = document.getElementById('json-transform');
      if (transformJson) {
        transformJson.innerHTML = syntaxHighlightJson(JSON.stringify({
          matrix: transform,
          description: 'Column-major 4x4 affine transformation matrix'
        }, null, 2));
      }

      // Raw element
      const rawJson = document.getElementById('json-raw');
      if (rawJson) {
        rawJson.innerHTML = syntaxHighlightJson(JSON.stringify(element, null, 2));
      }
    }

    // Show copy button
    if (copyAllBtn) {
      copyAllBtn.style.display = 'block';
    }

    setInspectStatus('success', `Successfully inspected element: ${element.properties?.category || 'unknown'}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Inspection failed:', error);
    setInspectStatus('error', `Inspection failed: ${errorMessage}`);
  } finally {
    if (inspectBtn) {
      inspectBtn.disabled = false;
      inspectBtn.innerHTML = '<span class="generate-btn-icon">&#128269;</span> Inspect Selected Building';
    }
  }
}

/**
 * Initialize the inspector tab
 */
export function initInspectTab(): void {
  const inspectBtn = document.getElementById('inspect-btn');
  const copyAllBtn = document.getElementById('copy-all-btn');

  // Inspect button click handler
  inspectBtn?.addEventListener('click', handleInspectBuilding);

  // Copy all button handler
  copyAllBtn?.addEventListener('click', () => {
    if (lastInspectionData) {
      navigator.clipboard.writeText(JSON.stringify(lastInspectionData, null, 2))
        .then(() => {
          setInspectStatus('success', 'Copied to clipboard!');
          setTimeout(hideInspectStatus, 2000);
        })
        .catch(() => {
          setInspectStatus('error', 'Failed to copy to clipboard');
        });
    }
  });

  // Section toggle handlers
  document.querySelectorAll('.inspect-section-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const sectionId = target.dataset.section;
      const sectionContent = document.getElementById(`section-${sectionId}`);

      if (sectionContent) {
        const isVisible = sectionContent.style.display !== 'none';
        sectionContent.style.display = isVisible ? 'none' : 'block';
        target.classList.toggle('expanded', !isVisible);
      }
    });
  });
}

/**
 * Get the last inspection data (for external use)
 */
export function getLastInspectionData(): Record<string, unknown> | null {
  return lastInspectionData;
}
