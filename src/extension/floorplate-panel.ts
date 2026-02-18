/**
 * Floorplate Panel Entry Script
 * Runs inside the Forma floating panel and receives floorplan data via MessagePort
 */

import { Forma } from 'forma-embedded-view-sdk/auto';
import { FloorPlanData, LayoutOption } from '../algorithm/types';
import { renderFloorplateSVG, renderEmptyFloorplate } from './components/FloorplateSVG';
import { renderMetricsPanel, renderEmptyMetricsPanel } from './components/MetricsPanel';

// DOM Elements
const svgContainer = document.getElementById('svg-container') as HTMLDivElement;
const metricsContainer = document.getElementById('metrics-container') as HTMLDivElement;
const emptyState = document.getElementById('empty-state') as HTMLDivElement;
const loading = document.getElementById('loading') as HTMLDivElement;
const toggleMetricsBtn = document.getElementById('toggle-metrics') as HTMLButtonElement;
const optionTabs = document.getElementById('option-tabs') as HTMLDivElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const saveFeedback = document.getElementById('save-feedback') as HTMLDivElement;
const bakeBtn = document.getElementById('bake-btn') as HTMLButtonElement;
const bakeFeedback = document.getElementById('bake-feedback') as HTMLDivElement;
const bakeFeedbackText = document.getElementById('bake-feedback-text') as HTMLSpanElement;

// State
let currentFloorplan: FloorPlanData | null = null;
let allOptions: LayoutOption[] = [];
let selectedOptionIndex = 0;
let currentStories = 1;
let metricsCollapsed = false;
let messagePort: MessagePort | null = null;
let isSaving = false;
let isBaking = false;

/**
 * Update the SVG visualization
 */
function updateSVG(): void {
  if (!svgContainer) return;

  // Get container dimensions
  const rect = svgContainer.getBoundingClientRect();
  const width = rect.width || 400;
  const height = rect.height || 300;

  // Hide empty state and loading
  if (emptyState) emptyState.style.display = 'none';
  if (loading) loading.style.display = 'none';

  if (currentFloorplan) {
    svgContainer.innerHTML = renderFloorplateSVG(
      currentFloorplan,
      width,
      height
    );
  } else {
    svgContainer.innerHTML = renderEmptyFloorplate(width, height);
    if (emptyState) emptyState.style.display = 'flex';
  }
}

/**
 * Update the metrics panel
 */
function updateMetrics(): void {
  if (!metricsContainer) return;

  if (currentFloorplan) {
    metricsContainer.innerHTML = renderMetricsPanel(currentFloorplan, undefined, currentStories);
  } else {
    metricsContainer.innerHTML = renderEmptyMetricsPanel();
  }
}

/**
 * Update the panel with new floorplan data
 */
function updatePanel(floorplan: FloorPlanData | null): void {
  currentFloorplan = floorplan;
  updateSVG();
  updateMetrics();
}

/**
 * Show loading state
 */
function showLoading(): void {
  if (emptyState) emptyState.style.display = 'none';
  if (loading) loading.style.display = 'flex';

  // Clear existing content
  const svg = svgContainer?.querySelector('svg');
  if (svg) svg.remove();
}

/**
 * Toggle the metrics panel visibility
 */
function toggleMetrics(): void {
  metricsCollapsed = !metricsCollapsed;

  if (metricsContainer) {
    if (metricsCollapsed) {
      metricsContainer.classList.add('collapsed');
    } else {
      metricsContainer.classList.remove('collapsed');
    }
  }

  // Re-render SVG with new available space after transition
  setTimeout(() => updateSVG(), 250);
}

/**
 * Update option tabs with stats
 */
function updateOptionTabs(): void {
  if (!optionTabs) return;

  const tabs = optionTabs.querySelectorAll('.option-tab');
  tabs.forEach((tab, index) => {
    // Update active state
    tab.classList.toggle('active', index === selectedOptionIndex);

    // Update stats if we have options
    const statsEl = tab.querySelector('.tab-stats') as HTMLElement;
    if (statsEl && allOptions[index]) {
      const stats = allOptions[index].floorplan.stats;
      statsEl.textContent = `${stats.totalUnits} units • ${(stats.efficiency * 100).toFixed(0)}%`;
    }
  });
}

/**
 * Handle tab click
 */
function handleTabClick(index: number): void {
  if (index === selectedOptionIndex) return;
  if (index < 0 || index >= allOptions.length) return;

  selectedOptionIndex = index;
  currentFloorplan = allOptions[index].floorplan;
  updateSVG();
  updateMetrics();
  updateOptionTabs();
  updateSaveButton();
  updateBakeButton();

  // Notify main extension of selection change
  if (messagePort) {
    messagePort.postMessage({
      type: 'OPTION_SELECTED',
      data: { index, strategy: allOptions[index].strategy }
    });
  }
}

/**
 * Update save button enabled state
 */
function updateSaveButton(): void {
  if (!saveBtn) return;
  saveBtn.disabled = allOptions.length === 0 || isSaving;
}

/**
 * Update bake button enabled state
 */
function updateBakeButton(): void {
  if (!bakeBtn) return;
  bakeBtn.disabled = allOptions.length === 0 || isBaking;
}

/**
 * Handle save button click
 */
function handleSave(): void {
  if (!currentFloorplan || allOptions.length === 0 || isSaving) return;

  isSaving = true;
  updateSaveButton();

  if (saveBtn) {
    saveBtn.classList.add('saving');
    const textEl = saveBtn.querySelector('.save-text');
    if (textEl) textEl.textContent = 'Saving...';
  }

  // Send save request to main extension
  if (messagePort) {
    messagePort.postMessage({
      type: 'SAVE_FLOORPLATE',
      data: {
        layoutOption: allOptions[selectedOptionIndex],
        optionIndex: selectedOptionIndex
      }
    });
  }
}

/**
 * Show save success feedback
 */
function showSaveFeedback(name: string): void {
  isSaving = false;
  updateSaveButton();

  if (saveBtn) {
    saveBtn.classList.remove('saving');
    const textEl = saveBtn.querySelector('.save-text');
    if (textEl) textEl.textContent = 'Save';
  }

  if (saveFeedback) {
    saveFeedback.innerHTML = `<span>Saved as "${name}"</span>`;
    saveFeedback.classList.add('show');
    setTimeout(() => {
      saveFeedback.classList.remove('show');
    }, 2500);
  }
}

/**
 * Handle bake button click
 */
function handleBake(): void {
  console.log('[DEBUG PANEL] handleBake called');
  console.log('[DEBUG PANEL] currentFloorplan:', !!currentFloorplan);
  console.log('[DEBUG PANEL] allOptions.length:', allOptions.length);
  console.log('[DEBUG PANEL] isBaking:', isBaking);

  if (!currentFloorplan || allOptions.length === 0 || isBaking) {
    console.log('[DEBUG PANEL] handleBake returning early due to guard conditions');
    return;
  }

  isBaking = true;
  updateBakeButton();

  if (bakeBtn) {
    bakeBtn.classList.add('baking');
    const textEl = bakeBtn.querySelector('.bake-text');
    if (textEl) textEl.textContent = 'Baking...';
  }

  // Send bake request to main extension
  console.log('[DEBUG PANEL] Sending BAKE_FLOORPLATE message, messagePort:', !!messagePort);
  if (messagePort) {
    const message = {
      type: 'BAKE_FLOORPLATE',
      data: {
        layoutOption: allOptions[selectedOptionIndex],
        optionIndex: selectedOptionIndex
      }
    };
    console.log('[DEBUG PANEL] Posting message:', JSON.stringify(message, null, 2).substring(0, 500));
    messagePort.postMessage(message);
    console.log('[DEBUG PANEL] Message posted successfully');
  } else {
    console.error('[DEBUG PANEL] No messagePort available!');
  }
}

/**
 * Show bake success feedback
 */
function showBakeFeedback(success: boolean, message: string): void {
  isBaking = false;
  updateBakeButton();

  if (bakeBtn) {
    bakeBtn.classList.remove('baking');
    const textEl = bakeBtn.querySelector('.bake-text');
    if (textEl) textEl.textContent = 'Bake';
  }

  if (bakeFeedback && bakeFeedbackText) {
    bakeFeedbackText.textContent = message;
    bakeFeedback.classList.remove('error');
    if (!success) {
      bakeFeedback.classList.add('error');
    }
    bakeFeedback.classList.add('show');
    setTimeout(() => {
      bakeFeedback.classList.remove('show');
    }, 3000);
  }
}

/**
 * Handle messages from the main extension
 */
function handleMessage(event: MessageEvent): void {
  const { type, data } = event.data;

  switch (type) {
    case 'UPDATE_OPTIONS':
      // Received all 3 options
      allOptions = data.options as LayoutOption[];
      selectedOptionIndex = data.selectedIndex ?? 0;
      currentStories = data.stories ?? 1;
      currentFloorplan = allOptions[selectedOptionIndex]?.floorplan ?? null;
      updateSVG();
      updateMetrics();
      updateOptionTabs();
      updateSaveButton();
      updateBakeButton();
      // ACK so the main panel knows we're alive
      if (messagePort) messagePort.postMessage({ type: 'ACK' });
      break;

    case 'UPDATE_FLOORPLAN':
      updatePanel(data as FloorPlanData);
      break;

    case 'SHOW_LOADING':
      showLoading();
      break;

    case 'CLEAR':
      allOptions = [];
      selectedOptionIndex = 0;
      updatePanel(null);
      updateOptionTabs();
      updateSaveButton();
      updateBakeButton();
      break;

    case 'SAVE_SUCCESS':
      showSaveFeedback(data.name);
      break;

    case 'SAVE_ERROR':
      // Reset save button state on error
      isSaving = false;
      updateSaveButton();
      if (saveBtn) {
        saveBtn.classList.remove('saving');
        const textEl = saveBtn.querySelector('.save-text');
        if (textEl) textEl.textContent = 'Save';
      }
      console.error('Save failed:', data.error);
      break;

    case 'BAKE_SUCCESS':
      showBakeFeedback(true, 'Baked to native building!');
      break;

    case 'BAKE_ERROR':
      showBakeFeedback(false, `Bake failed: ${data.error}`);
      console.error('Bake failed:', data.error);
      break;

    default:
      console.warn('Unknown message type:', type);
  }
}

/**
 * Initialize the panel
 */
function init(): void {
  // Set up metrics toggle button
  if (toggleMetricsBtn) {
    toggleMetricsBtn.addEventListener('click', toggleMetrics);
  }

  // Set up save button
  if (saveBtn) {
    saveBtn.addEventListener('click', handleSave);
  }

  // Set up bake button
  if (bakeBtn) {
    bakeBtn.addEventListener('click', handleBake);
  }

  // Set up option tab click handlers
  if (optionTabs) {
    const tabs = optionTabs.querySelectorAll('.option-tab');
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => handleTabClick(index));
    });
  }

  // Set up window resize handler
  window.addEventListener('resize', () => {
    // Debounce resize updates
    requestAnimationFrame(() => updateSVG());
  });

  // Listen for message port from main extension
  console.log('[DEBUG PANEL] Setting up message port listener...');
  Forma.onMessagePort(({ port }) => {
    console.log('[DEBUG PANEL] Message port received from main extension');
    messagePort = port;
    port.onmessage = handleMessage;

    // Send ready signal
    console.log('[DEBUG PANEL] Sending PANEL_READY signal');
    port.postMessage({ type: 'PANEL_READY' });
  });

  // Show initial empty state
  updatePanel(null);
  updateSaveButton();
  updateBakeButton();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
