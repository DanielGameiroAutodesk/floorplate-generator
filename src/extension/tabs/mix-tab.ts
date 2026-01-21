/**
 * MIX Tab Module
 *
 * Handles the unit mix configuration tab where users define:
 * - Alignment strength (how strictly units mirror across corridor)
 * - Unit types with percentages, areas, and advanced settings
 */

import { state, calculateSmartDefaultsFromArea, createUnitTypeWithDefaults, generateUnitId } from '../state/ui-state';
import * as dom from '../utils/dom-refs';

// ============================================================================
// Module State
// ============================================================================

let markInputChangedCallback: (() => void) | null = null;

/**
 * Set the callback for when inputs change (triggers auto-regeneration).
 */
export function setMarkInputChanged(callback: () => void): void {
  markInputChangedCallback = callback;
}

function markInputChanged(): void {
  if (markInputChangedCallback) {
    markInputChangedCallback();
  }
}

// ============================================================================
// Unit Rows Rendering
// ============================================================================

/**
 * Render all unit type rows in the MIX tab.
 *
 * WHY: We re-render the entire list on changes rather than doing surgical
 * DOM updates because the list is small (typically 4-6 items) and full
 * re-render is simpler to reason about. This avoids bugs from partial updates.
 */
export function renderUnitRows(): void {
  dom.unitRowsContainer.innerHTML = '';

  state.unitTypes.forEach((unit) => {
    const row = document.createElement('div');
    row.className = `unit-row${unit.advancedExpanded ? ' expanded' : ''}`;
    row.dataset.unitId = unit.id;

    const adv = unit.useSmartDefaults ? calculateSmartDefaultsFromArea(unit.area) : unit.advanced;

    row.innerHTML = `
      <div class="unit-row-basic" data-unit-id="${unit.id}">
        <span class="expand-chevron" style="color: ${unit.color};">&#9658;</span>
        <div class="unit-label" data-unit-id="${unit.id}" contenteditable="false">${unit.name}</div>
        <div class="unit-inputs">
          <div class="unit-input pct">
            <input type="number" class="unit-pct-input" data-unit-id="${unit.id}" value="${unit.percentage}" min="0" max="100">
            <span class="suffix">%</span>
          </div>
          <div class="unit-input area">
            <input type="number" class="unit-area-input" data-unit-id="${unit.id}" value="${unit.area}" min="200" max="3000">
            <span class="suffix">sf</span>
          </div>
        </div>
        <button class="remove-btn" data-unit-id="${unit.id}" title="Remove unit type">&times;</button>
      </div>
      <div class="unit-advanced-panel${unit.useSmartDefaults ? ' smart-defaults' : ''}" style="display: ${unit.advancedExpanded ? 'block' : 'none'};">
        <div class="advanced-header">
          <span>Advanced Settings</span>
          <label class="smart-defaults-toggle">
            <input type="checkbox" class="smart-defaults-cb" data-unit-id="${unit.id}" ${unit.useSmartDefaults ? 'checked' : ''}>
            <span>Smart defaults</span>
          </label>
        </div>
        <div class="color-picker-row">
          <span>Color</span>
          <div class="color-picker-swatch" style="background: ${unit.color};">
            <input type="color" class="color-picker-input" value="${unit.color}" data-unit-id="${unit.id}">
          </div>
        </div>
        <div class="advanced-grid">
          <div class="advanced-section">
            <div class="section-label">Placement</div>
            <div class="checkbox-grid">
              <label class="checkbox-row">
                <input type="checkbox" class="corner-eligible-cb" data-unit-id="${unit.id}" ${adv.cornerEligible ? 'checked' : ''}>
                <span>Corner</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" class="lshape-eligible-cb" data-unit-id="${unit.id}" ${adv.lShapeEligible ? 'checked' : ''}>
                <span>L-shape</span>
              </label>
            </div>
            <div class="input-row">
              <span>Priority</span>
              <input type="number" class="priority-input" data-unit-id="${unit.id}" value="${adv.placementPriority}" min="1" max="100">
            </div>
          </div>
          <div class="advanced-section">
            <div class="section-label">Size Flexibility</div>
            <div class="input-row">
              <span>Tolerance</span>
              <input type="number" class="tolerance-input" data-unit-id="${unit.id}" value="${adv.sizeTolerance}" min="0" max="50">
              <span class="suffix">%</span>
            </div>
            <div class="input-row">
              <span>Min Width</span>
              <input type="number" class="min-width-input" data-unit-id="${unit.id}" value="${adv.minWidth}" min="10" max="30">
              <span class="suffix">ft</span>
            </div>
            <div class="input-row">
              <span>Max Width</span>
              <input type="number" class="max-width-input" data-unit-id="${unit.id}" value="${adv.maxWidth}" min="15" max="100">
              <span class="suffix">ft</span>
            </div>
          </div>
        </div>
      </div>
    `;

    dom.unitRowsContainer.appendChild(row);
  });

  attachUnitRowEventListeners();
  updateTotalMix();
}

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Attach event listeners to dynamically created unit row elements.
 *
 * WHY: Because unit rows are created dynamically, we can't attach listeners
 * at page load. We re-attach after each render. An alternative would be
 * event delegation on the container, but explicit listeners are clearer.
 */
function attachUnitRowEventListeners(): void {
  // Color picker change
  document.querySelectorAll('.color-picker-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const unitId = target.dataset.unitId;
      const unit = state.unitTypes.find(u => u.id === unitId);
      if (unit) {
        unit.color = target.value;
        // Update the color swatch background
        const swatch = target.parentElement as HTMLElement;
        swatch.style.background = target.value;
        // Update the chevron color
        const row = target.closest('.unit-row') as HTMLElement;
        const chevron = row.querySelector('.expand-chevron') as HTMLElement;
        if (chevron) chevron.style.color = target.value;
        markInputChanged();
      }
    });
  });

  // Double-click to edit label
  document.querySelectorAll('.unit-label').forEach(label => {
    label.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      target.contentEditable = 'true';
      target.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });

    // Save on blur
    label.addEventListener('blur', (e) => {
      const target = e.target as HTMLElement;
      target.contentEditable = 'false';
      const unitId = target.dataset.unitId;
      const unit = state.unitTypes.find(u => u.id === unitId);
      if (unit) {
        unit.name = target.textContent || 'Unit';
        markInputChanged();
      }
    });

    // Save on Enter key
    label.addEventListener('keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Enter') {
        e.preventDefault();
        (e.target as HTMLElement).blur();
      }
    });
  });

  // Percentage input change
  document.querySelectorAll('.unit-pct-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const unitId = target.dataset.unitId;
      const unit = state.unitTypes.find(u => u.id === unitId);
      if (unit) {
        unit.percentage = parseFloat(target.value) || 0;
        updateTotalMix();
        markInputChanged();
      }
    });
  });

  // Area input change
  document.querySelectorAll('.unit-area-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const unitId = target.dataset.unitId;
      const unit = state.unitTypes.find(u => u.id === unitId);
      if (unit) {
        unit.area = parseFloat(target.value) || 500;
        markInputChanged();
      }
    });
  });

  // Remove button click
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const unitId = target.dataset.unitId;

      // Don't allow removing if only 1 unit type left
      if (state.unitTypes.length <= 1) {
        alert('At least one unit type is required.');
        return;
      }

      state.unitTypes = state.unitTypes.filter(u => u.id !== unitId);
      renderUnitRows();
      markInputChanged();
    });
  });

  // Row click (toggle advanced panel) - ignore clicks on inputs/buttons
  document.querySelectorAll('.unit-row-basic').forEach(rowBasic => {
    rowBasic.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // Ignore clicks on inputs, buttons, and color picker
      if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('.unit-inputs') || target.closest('.unit-color')) {
        return;
      }
      const unitId = (rowBasic as HTMLElement).dataset.unitId;
      const unit = state.unitTypes.find(u => u.id === unitId);
      if (unit) {
        unit.advancedExpanded = !unit.advancedExpanded;
        const row = rowBasic.closest('.unit-row') as HTMLElement;
        const panel = row.querySelector('.unit-advanced-panel') as HTMLElement;
        row.classList.toggle('expanded', unit.advancedExpanded);
        panel.style.display = unit.advancedExpanded ? 'block' : 'none';
      }
    });
  });

  // Smart defaults checkbox
  document.querySelectorAll('.smart-defaults-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const unitId = target.dataset.unitId;
      const unit = state.unitTypes.find(u => u.id === unitId);
      if (unit) {
        unit.useSmartDefaults = target.checked;
        renderUnitRows();
        markInputChanged();
      }
    });
  });

  // Advanced settings inputs (only update if not using smart defaults)
  const advancedInputHandlers = [
    { selector: '.corner-eligible-cb', prop: 'cornerEligible', isCheckbox: true },
    { selector: '.lshape-eligible-cb', prop: 'lShapeEligible', isCheckbox: true },
    { selector: '.priority-input', prop: 'placementPriority', isCheckbox: false },
    { selector: '.tolerance-input', prop: 'sizeTolerance', isCheckbox: false },
    { selector: '.min-width-input', prop: 'minWidth', isCheckbox: false },
    { selector: '.max-width-input', prop: 'maxWidth', isCheckbox: false }
  ];

  advancedInputHandlers.forEach(({ selector, prop, isCheckbox }) => {
    document.querySelectorAll(selector).forEach(el => {
      el.addEventListener(isCheckbox ? 'change' : 'input', (e) => {
        const target = e.target as HTMLInputElement;
        const unitId = target.dataset.unitId;
        const unit = state.unitTypes.find(u => u.id === unitId);
        if (unit) {
          // PLACEMENT settings (cornerEligible, lShapeEligible) can ALWAYS be manually overridden
          // WHY: These are important user choices that should persist even with smart defaults on
          const isPlacementSetting = prop === 'cornerEligible' || prop === 'lShapeEligible';

          if (!unit.useSmartDefaults || isPlacementSetting) {
            const newValue = isCheckbox ? target.checked : (parseInt(target.value) || 0);
            (unit.advanced as unknown as Record<string, unknown>)[prop] = newValue;
            markInputChanged();
          }
        }
      });
    });
  });
}

// ============================================================================
// Total Mix Display
// ============================================================================

/**
 * Update the total mix percentage display.
 * Shows error state if percentages don't sum to 100%.
 */
export function updateTotalMix(): void {
  const total = state.unitTypes.reduce((sum, unit) => sum + unit.percentage, 0);

  dom.totalMix.textContent = `Total Mix: ${total}%`;

  if (total === 100) {
    dom.totalMix.classList.remove('error');
  } else {
    dom.totalMix.classList.add('error');
  }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the MIX tab with event listeners and initial render.
 */
export function initMixTab(): void {
  // Alignment slider
  dom.alignmentSlider.addEventListener('input', () => {
    const value = parseInt(dom.alignmentSlider.value);
    state.alignment = value;
    // WHY: Text labels instead of percentages help users understand the effect
    // "Strict" = walls align across corridor, "Flexible" = walls can offset
    if (value >= 80) {
      dom.alignmentValue.textContent = 'Strict';
    } else if (value >= 40) {
      dom.alignmentValue.textContent = 'Moderate';
    } else {
      dom.alignmentValue.textContent = 'Flexible';
    }
    markInputChanged();
  });

  // Add unit button
  dom.addUnitBtn.addEventListener('click', () => {
    // Use Forma Data Labels palette colors
    const colors = ['#A0D4DC', '#D0E1A4', '#F5C297', '#D9DDFC', '#F1A394', '#A7D2A6', '#A3CCF1', '#EBD5F6', '#F7CAD8', '#FCEAAE'];
    const usedColors = state.unitTypes.map(u => u.color);
    const availableColors = colors.filter(c => !usedColors.includes(c));
    const newColor = availableColors.length > 0
      ? availableColors[0]
      : '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

    // Create new unit with smart defaults based on default area
    const defaultArea = 800;
    const newUnit = createUnitTypeWithDefaults(
      generateUnitId(),
      'New Unit',
      newColor,
      0,
      defaultArea
    );

    state.unitTypes.push(newUnit);
    renderUnitRows();
    markInputChanged();
  });

  // Initial render
  renderUnitRows();
}
