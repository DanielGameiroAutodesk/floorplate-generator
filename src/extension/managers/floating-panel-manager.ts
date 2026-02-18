/**
 * Floating Panel Manager
 *
 * Manages the floating preview panel that displays generated options.
 * Uses Forma's native floating panel API and MessagePort for communication.
 *
 * WHY floating panel instead of modal?
 * 1. Users can position it anywhere on screen while working
 * 2. It persists across selection changes (modals would close)
 * 3. Matches Forma's UX patterns for visualization panels
 * 4. MessagePort keeps it synchronized with main panel
 */

import { Forma } from 'forma-embedded-view-sdk/auto';
import { LayoutOption } from '../../algorithm/types';
import { renderFloorplate } from '../../algorithm';

// ============================================================================
// Module State
// ============================================================================

let floatingPanelPort: MessagePort | null = null;
let isPanelOpen: boolean = false;
let lastPanelAckTime: number = 0;
let pendingAckTimer: ReturnType<typeof setTimeout> | null = null;

// Callbacks set by main module
let onOptionSelectedCallback: ((index: number) => Promise<void>) | null = null;
let onSaveRequestCallback: ((layoutOption: LayoutOption) => Promise<void>) | null = null;
let onBakeRequestCallback: ((layoutOption: LayoutOption) => Promise<void>) | null = null;

// Reference to generated options (set by generation manager)
let generatedOptionsRef: LayoutOption[] = [];
let selectedOptionIndexRef: number = 0;
let storiesRef: number = 1;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Set callbacks for panel events.
 */
export function setPanelCallbacks(callbacks: {
  onOptionSelected: (index: number) => Promise<void>;
  onSaveRequest: (layoutOption: LayoutOption) => Promise<void>;
  onBakeRequest: (layoutOption: LayoutOption) => Promise<void>;
}): void {
  onOptionSelectedCallback = callbacks.onOptionSelected;
  onSaveRequestCallback = callbacks.onSaveRequest;
  onBakeRequestCallback = callbacks.onBakeRequest;
}

/**
 * Update the reference to generated options (called after generation).
 */
export function setGeneratedOptions(options: LayoutOption[], selectedIndex: number, stories?: number): void {
  generatedOptionsRef = options;
  selectedOptionIndexRef = selectedIndex;
  if (stories !== undefined) storiesRef = stories;
}

// ============================================================================
// Panel Lifecycle
// ============================================================================

/**
 * Get the base URL for the extension.
 * Works in both development (localhost:5173) and production (deployed URL).
 */
function getExtensionBaseUrl(): string {
  const currentScript = document.currentScript as HTMLScriptElement;
  if (currentScript && currentScript.src) {
    const url = new URL(currentScript.src);
    return `${url.origin}`;
  }
  // Fallback: use window.location.origin (works for Vite dev server)
  return window.location.origin;
}

/**
 * Open the floorplate floating panel.
 *
 * WHY we use Forma.openFloatingPanel:
 * - Native Forma UI that users expect
 * - Handles positioning, resizing, minimizing
 * - Integrates with Forma's panel management
 */
export async function openFloorplatePanel(): Promise<void> {
  if (floatingPanelPort) return;

  const baseUrl = getExtensionBaseUrl();
  const panelUrl = `${baseUrl}/floorplate-panel.html`;

  try {
    await Forma.openFloatingPanel({
      embeddedViewId: 'floorplate-preview',
      url: panelUrl,
      title: 'Floorplate Preview',
      preferredSize: { width: 700, height: 450 },
      placement: { type: 'right', offsetTop: 50 },
      minimumWidth: 400,
      minimumHeight: 300
    });
  } catch (error) {
    const msg = String(error);
    if (!msg.includes('already open')) {
      console.error('Failed to open floating panel:', error);
      return;
    }
    // "View already open" — panel exists but we lost our port. Fall through to reconnect.
  }

  try {
    floatingPanelPort = await Forma.createMessagePort({
      embeddedViewId: 'floorplate-preview'
    });
    floatingPanelPort.onmessage = handlePanelMessage;
    isPanelOpen = true;
  } catch (portError) {
    console.error('Failed to create message port:', portError);
    isPanelOpen = false;
    floatingPanelPort = null;
  }
}

/**
 * Handle incoming messages from the floating panel.
 */
async function handlePanelMessage(event: MessageEvent): Promise<void> {
  const { type, data } = event.data;

  switch (type) {
    case 'PANEL_READY':
      // Panel has loaded and is ready to receive data
      console.log('Floating panel ready');
      lastPanelAckTime = Date.now();
      if (generatedOptionsRef.length > 0) {
        sendOptionsToPanel(generatedOptionsRef, selectedOptionIndexRef, storiesRef);
      }
      break;

    case 'ACK':
      lastPanelAckTime = Date.now();
      if (pendingAckTimer) { clearTimeout(pendingAckTimer); pendingAckTimer = null; }
      break;

    case 'OPTION_SELECTED':
      // User selected a different option in the floating panel
      if (onOptionSelectedCallback) {
        await onOptionSelectedCallback(data.index);
      }
      break;

    case 'SAVE_FLOORPLATE':
      // User clicked save in the floating panel
      if (onSaveRequestCallback) {
        await onSaveRequestCallback(data.layoutOption);
      }
      break;

    case 'BAKE_FLOORPLATE':
      if (onBakeRequestCallback) {
        await onBakeRequestCallback(data.layoutOption);
      }
      break;
  }
}

// ============================================================================
// Communication
// ============================================================================

/**
 * Send all generated options to the floating panel for display.
 *
 * @param options - Array of layout options (typically 3: balanced, mix, efficiency)
 * @param selectedIndex - Index of currently selected option
 * @param stories - Number of stories from UI state
 */
export function sendOptionsToPanel(options: LayoutOption[], selectedIndex: number, stories?: number): void {
  if (floatingPanelPort) {
    try {
      floatingPanelPort.postMessage({
        type: 'UPDATE_OPTIONS',
        data: { options, selectedIndex, stories: stories ?? 1 }
      });

      const sentOptions = options;
      const sentIndex = selectedIndex;
      if (pendingAckTimer) clearTimeout(pendingAckTimer);
      pendingAckTimer = setTimeout(async () => {
        resetPanelState();
        pendingAckTimer = null;
        await openFloorplatePanel();
        if (floatingPanelPort) {
          generatedOptionsRef = sentOptions;
          selectedOptionIndexRef = sentIndex;
          sendOptionsToPanel(sentOptions, sentIndex);
        }
      }, 1000);
    } catch {
      resetPanelState();
    }
  }
}

/**
 * Notify panel of successful save.
 */
export function notifySaveSuccess(id: string, name: string): void {
  if (floatingPanelPort) {
    floatingPanelPort.postMessage({
      type: 'SAVE_SUCCESS',
      data: { id, name }
    });
  }
}

/**
 * Notify panel of save error.
 */
export function notifySaveError(error: string): void {
  if (floatingPanelPort) {
    floatingPanelPort.postMessage({
      type: 'SAVE_ERROR',
      data: { error }
    });
  }
}

/**
 * Notify panel of successful bake.
 */
export function notifyBakeSuccess(urn: string): void {
  if (floatingPanelPort) {
    floatingPanelPort.postMessage({
      type: 'BAKE_SUCCESS',
      data: { urn }
    });
  }
}

/**
 * Notify panel of bake error.
 */
export function notifyBakeError(error: string): void {
  if (floatingPanelPort) {
    floatingPanelPort.postMessage({
      type: 'BAKE_ERROR',
      data: { error }
    });
  }
}

// ============================================================================
// State Accessors
// ============================================================================

/**
 * Check if the floating panel is currently open.
 */
export function isPanelCurrentlyOpen(): boolean {
  return isPanelOpen;
}

/**
 * Reset panel state when the panel is closed externally (e.g. user clicked X).
 * Forma does not notify us on close, so we must reset before reopening.
 */
export function resetPanelState(): void {
  isPanelOpen = false;
  floatingPanelPort = null;
  if (pendingAckTimer) { clearTimeout(pendingAckTimer); pendingAckTimer = null; }
}

/**
 * Handle option selection from the floating panel.
 * Renders the selected option to Forma.
 *
 * @param index - Index of selected option
 * @param options - Array of available options
 * @returns The newly selected option index
 */
export async function handleOptionSelected(
  index: number,
  options: LayoutOption[],
  currentIndex: number
): Promise<{ selectedIndex: number; floorplan: LayoutOption['floorplan'] | null }> {
  if (index < 0 || index >= options.length) {
    return { selectedIndex: currentIndex, floorplan: null };
  }
  if (index === currentIndex) {
    return { selectedIndex: currentIndex, floorplan: options[currentIndex].floorplan };
  }

  const selectedOption = options[index];

  // Render to Forma
  try {
    const meshData = renderFloorplate(selectedOption.floorplan);
    await Forma.render.addMesh({
      geometryData: {
        position: meshData.positions,
        color: meshData.colors
      }
    });
    console.log('Rendered option:', selectedOption.strategy);
  } catch (error) {
    console.error('Failed to render option:', error);
  }

  return { selectedIndex: index, floorplan: selectedOption.floorplan };
}
