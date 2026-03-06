/**
 * Floating Panel Manager
 *
 * Manages the floating preview panel that displays generated floorplate options.
 * Coordinates between the main extension panel and the Forma-hosted floating view
 * via Forma's native floating panel API and MessagePort for bidirectional messaging.
 *
 * ## Primary Responsibilities
 * - **Panel lifecycle**: Opens/closes the floating panel via `Forma.openFloatingPanel`
 * - **Message port**: Establishes and maintains `MessagePort` for communication
 * - **Event routing**: Handles OPTION_SELECTED, SAVE_FLOORPLATE, BAKE_FLOORPLATE from the panel
 * - **State sync**: Sends UPDATE_OPTIONS when generation completes or panel reconnects
 *
 * ## Architecture & Event Flow
 * - Main panel (this extension) holds `floatingPanelPort`; the panel iframe posts messages.
 * - Protocol: `{ type: string, data?: object }`. Main panel handles: PANEL_READY, ACK, OPTION_SELECTED, SAVE_FLOORPLATE, BAKE_FLOORPLATE.
 * - Forma does not notify on panel close; we infer loss via missing ACK and reset port.
 *
 * ## State Lifecycle
 * 1. **Closed**: `floatingPanelPort === null`, `isPanelOpen === false`
 * 2. **Open**: Port established, panel iframe loaded, PANEL_READY received
 * 3. **Reconnect**: User reopens "Show Results"; we reset port and re-open to get fresh connection
 *
 * ## Storage Synchronization
 * - No persistent storage; panel state is in-memory. Options are passed via postMessage.
 * - Saved floorplates are handled by storage-service; this module only notifies success/error.
 *
 * ## Side Effects
 * - Opens Forma floating panel (native UI)
 * - Invokes callbacks for option selection, save, bake (set by main.ts)
 */

import { Forma } from 'forma-embedded-view-sdk/auto';
import { LayoutOption } from '../../algorithm/types';
import { renderFloorplate } from '../../algorithm';

// ============================================================================
// Module State
// ============================================================================

let floatingPanelPort: MessagePort | null = null;
let isPanelOpen: boolean = false;
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
 * Register callbacks invoked when the panel triggers option selection, save, or bake.
 *
 * @param callbacks - Object with onOptionSelected, onSaveRequest, onBakeRequest.
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
 * Update the cached reference to generated options. Used after generation or when loading saved floorplates.
 *
 * @param options - Layout options (balanced, mix, efficiency).
 * @param selectedIndex - Index of the currently selected option.
 * @param stories - Number of stories for total-building metrics (defaults to 1).
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
 * Open the floorplate floating panel and establish a message port for communication.
 *
 * If the panel is already open (e.g. user closed and reopened elsewhere), we fall through
 * to create a new port. Forma does not notify on external close, so we reset port on ACK timeout.
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
      if (generatedOptionsRef.length > 0) {
        sendOptionsToPanel(generatedOptionsRef, selectedOptionIndexRef, storiesRef);
      }
      break;

    case 'ACK':
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
 * Send generated options to the floating panel for display.
 *
 * Triggers an ACK timeout; if the panel does not acknowledge within 1 second,
 * we reset the port and reopen to re-establish connection.
 *
 * @param options - Array of layout options (typically 3: balanced, mix, efficiency).
 * @param selectedIndex - Index of currently selected option.
 * @param stories - Number of stories for metrics (defaults to 1).
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
      // 1000ms: if panel doesn't ACK, assume port dead (e.g. user closed panel) and reconnect
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
 * Notify the floating panel that a save completed successfully.
 *
 * @param id - Storage ID of the saved floorplate.
 * @param name - Display name of the saved floorplate.
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
 * Notify the floating panel that a save failed.
 *
 * @param error - Error message to display.
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
 * Notify the floating panel that a bake completed successfully.
 *
 * @param urn - Forma URN of the baked building.
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
 * Notify the floating panel that a bake failed.
 *
 * @param error - Error message to display.
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
 * Check whether the floating panel is currently open and connected.
 *
 * @returns True if we have an active message port.
 */
export function isPanelCurrentlyOpen(): boolean {
  return isPanelOpen;
}

/**
 * Reset panel state when the panel is closed externally (e.g. user clicked X).
 *
 * Forma does not notify on panel close; we call this before reopen to ensure
 * a fresh port is created. Also clears the pending ACK timer.
 */
export function resetPanelState(): void {
  isPanelOpen = false;
  floatingPanelPort = null;
  if (pendingAckTimer) { clearTimeout(pendingAckTimer); pendingAckTimer = null; }
}

/**
 * Handle option selection from the floating panel. Renders the selected option to Forma.
 *
 * @param index - Index of selected option.
 * @param options - Array of available options.
 * @param currentIndex - Currently selected index (for no-op check).
 * @returns Object with selectedIndex and floorplan; floorplan null if index invalid.
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
  } catch (error) {
    console.error('Failed to render option:', error);
  }

  return { selectedIndex: index, floorplan: selectedOption.floorplan };
}
