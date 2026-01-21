/**
 * Storage Service - Forma Extension Storage API Wrapper
 *
 * Handles persistence of saved floorplates using Forma's extension storage API.
 * Data is stored per-project in Forma's cloud storage (S3-backed).
 */

import { Forma } from 'forma-embedded-view-sdk/auto';
import {
  SavedFloorplate,
  SavedFloorplateSummary,
  OptimizationStrategy
} from '../algorithm/types';

// Storage key constants
const INDEX_KEY = 'floorplate-saves-index';
const SAVE_KEY_PREFIX = 'floorplate-save-';

// Index schema version for future migrations
const INDEX_VERSION = 1;

interface SavesIndex {
  version: number;
  items: SavedFloorplateSummary[];
}

/**
 * Generate a unique ID for a new save
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generates a building ID from dimensions for grouping saves.
 *
 * Buildings with the same dimensions get the same ID, allowing users
 * to filter saved floorplates by building. This is useful when working
 * with multiple buildings in a project.
 *
 * @param width - Building width in feet
 * @param depth - Building depth in feet
 * @returns A 12-character alphanumeric ID string
 *
 * @example
 * ```typescript
 * const id = generateBuildingId(300, 65);
 * // Returns something like "MzAwLjAtNjUu"
 * ```
 */
export function generateBuildingId(width: number, depth: number): string {
  const signature = `${width.toFixed(1)}-${depth.toFixed(1)}`;
  // Simple base64-like encoding for readability
  return btoa(signature).replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
}

/**
 * Generates a default name for a saved floorplate.
 *
 * Creates a human-readable name including the optimization strategy
 * and timestamp. Users can rename saves later via `updateFloorplateName()`.
 *
 * @param strategy - The optimization strategy used ('balanced', 'mixOptimized', 'efficiencyOptimized')
 * @returns A formatted string like "Balanced - Jan 15, 2:30 PM"
 *
 * @example
 * ```typescript
 * const name = generateDefaultName('mixOptimized');
 * // Returns "Mix Optimized - Jan 15, 2:30 PM"
 * ```
 */
export function generateDefaultName(strategy: OptimizationStrategy): string {
  const strategyNames: Record<OptimizationStrategy, string> = {
    balanced: 'Balanced',
    mixOptimized: 'Mix Optimized',
    efficiencyOptimized: 'Efficiency'
  };

  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'short' });
  const day = now.getDate();
  const time = now.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return `${strategyNames[strategy]} - ${month} ${day}, ${time}`;
}

/**
 * Load the saves index from storage
 */
async function loadIndex(): Promise<SavesIndex> {
  try {
    const result = await Forma.extensions.storage.getTextObject({ key: INDEX_KEY });
    if (result?.data) {
      const parsed = JSON.parse(result.data) as SavesIndex;
      // Handle version migrations here if needed
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to load saves index, starting fresh:', error);
  }

  // Return empty index if not found or error
  return { version: INDEX_VERSION, items: [] };
}

/**
 * Save the index to storage
 */
async function saveIndex(index: SavesIndex): Promise<void> {
  await Forma.extensions.storage.setObject({
    key: INDEX_KEY,
    data: JSON.stringify(index)
  });
}

/**
 * Create a summary from a full SavedFloorplate
 */
function createSummary(floorplate: SavedFloorplate): SavedFloorplateSummary {
  return {
    id: floorplate.id,
    name: floorplate.name,
    createdAt: floorplate.createdAt,
    updatedAt: floorplate.updatedAt,
    buildingId: floorplate.buildingId,
    previewStats: floorplate.previewStats
  };
}

/**
 * Saves a floorplate to Forma's cloud storage.
 *
 * Stores the complete floorplate data (layout, UI state, statistics) and
 * updates the index for fast listing. Data is persisted to Forma's
 * project-scoped cloud storage (S3-backed).
 *
 * @param floorplate - Complete SavedFloorplate object to persist.
 *                     Must include id, name, layoutOption, uiState, and buildingId.
 * @returns Promise that resolves when save is complete
 * @throws Error if storage operation fails
 *
 * @example
 * ```typescript
 * const saved = createSavedFloorplate(layoutOption, uiState, buildingId);
 * await saveFloorplate(saved);
 * console.log('Saved:', saved.name);
 * ```
 */
export async function saveFloorplate(floorplate: SavedFloorplate): Promise<void> {
  // Save the full floorplate data
  const key = `${SAVE_KEY_PREFIX}${floorplate.id}`;
  await Forma.extensions.storage.setObject({
    key,
    data: JSON.stringify(floorplate),
    metadata: JSON.stringify({
      name: floorplate.name,
      strategy: floorplate.previewStats.strategy,
      savedAt: floorplate.createdAt
    })
  });

  // Update the index
  const index = await loadIndex();
  const existingIdx = index.items.findIndex(item => item.id === floorplate.id);
  const summary = createSummary(floorplate);

  if (existingIdx >= 0) {
    index.items[existingIdx] = summary;
  } else {
    // Add to beginning of list (newest first)
    index.items.unshift(summary);
  }

  await saveIndex(index);
}

/**
 * Loads a complete floorplate from storage by ID.
 *
 * Retrieves the full SavedFloorplate object including the complete
 * FloorPlanData that can be rendered directly.
 *
 * @param id - The unique identifier of the saved floorplate
 * @returns The complete SavedFloorplate if found, null otherwise
 *
 * @example
 * ```typescript
 * const saved = await loadFloorplate('abc-123');
 * if (saved) {
 *   const meshData = renderFloorplate(saved.layoutOption.floorplan);
 *   // Render to Forma...
 * }
 * ```
 */
export async function loadFloorplate(id: string): Promise<SavedFloorplate | null> {
  try {
    const key = `${SAVE_KEY_PREFIX}${id}`;
    const result = await Forma.extensions.storage.getTextObject({ key });
    if (result?.data) {
      return JSON.parse(result.data) as SavedFloorplate;
    }
  } catch (error) {
    console.error('Failed to load floorplate:', error);
  }
  return null;
}

/**
 * Lists all saved floorplates (summaries only, not full data).
 *
 * Returns lightweight summary objects for displaying in a list UI.
 * To get full floorplate data for rendering, use `loadFloorplate(id)`.
 *
 * @returns Array of SavedFloorplateSummary objects, newest first
 *
 * @example
 * ```typescript
 * const saves = await listFloorplates();
 * saves.forEach(save => {
 *   console.log(`${save.name}: ${save.previewStats.totalUnits} units`);
 * });
 * ```
 */
export async function listFloorplates(): Promise<SavedFloorplateSummary[]> {
  const index = await loadIndex();
  return index.items;
}

/**
 * Deletes a saved floorplate from storage.
 *
 * Removes both the floorplate data and its index entry. This operation
 * is permanent and cannot be undone.
 *
 * @param id - The unique identifier of the floorplate to delete
 * @returns Promise that resolves when deletion is complete
 *
 * @example
 * ```typescript
 * if (confirm('Delete this saved floorplate?')) {
 *   await deleteFloorplate(saveId);
 *   await refreshSavedList();
 * }
 * ```
 */
export async function deleteFloorplate(id: string): Promise<void> {
  // Delete the floorplate data
  const key = `${SAVE_KEY_PREFIX}${id}`;
  try {
    await Forma.extensions.storage.deleteObject({ key });
  } catch (error) {
    console.warn('Failed to delete floorplate data (may not exist):', error);
  }

  // Update the index
  const index = await loadIndex();
  index.items = index.items.filter(item => item.id !== id);
  await saveIndex(index);
}

/**
 * Renames a saved floorplate.
 *
 * Updates the name and sets the updatedAt timestamp. The name change
 * is reflected both in the full data and in the index.
 *
 * @param id - The unique identifier of the floorplate to rename
 * @param newName - The new display name
 * @returns Promise that resolves when rename is complete
 * @throws Error if floorplate with given ID is not found
 *
 * @example
 * ```typescript
 * await updateFloorplateName(saveId, 'Final Design v2');
 * ```
 */
export async function updateFloorplateName(id: string, newName: string): Promise<void> {
  // Load the full floorplate
  const floorplate = await loadFloorplate(id);
  if (!floorplate) {
    throw new Error(`Floorplate not found: ${id}`);
  }

  // Update name and timestamp
  floorplate.name = newName;
  floorplate.updatedAt = new Date().toISOString();

  // Save back
  await saveFloorplate(floorplate);
}

/**
 * Creates a copy of an existing saved floorplate.
 *
 * The duplicate gets a new ID and a name with "(Copy)" appended.
 * Useful for creating variations from a base design.
 *
 * @param id - The unique identifier of the floorplate to duplicate
 * @returns The newly created SavedFloorplate copy
 * @throws Error if floorplate with given ID is not found
 *
 * @example
 * ```typescript
 * const copy = await duplicateFloorplate(originalId);
 * console.log('Created copy:', copy.name); // "Original Name (Copy)"
 * ```
 */
export async function duplicateFloorplate(id: string): Promise<SavedFloorplate> {
  // Load the original
  const original = await loadFloorplate(id);
  if (!original) {
    throw new Error(`Floorplate not found: ${id}`);
  }

  // Create a copy with new ID and name
  const now = new Date().toISOString();
  const duplicate: SavedFloorplate = {
    ...original,
    id: generateId(),
    name: `${original.name} (Copy)`,
    createdAt: now,
    updatedAt: now
  };

  // Save the duplicate
  await saveFloorplate(duplicate);

  return duplicate;
}

/**
 * Creates a new SavedFloorplate object ready for storage.
 *
 * Factory function that assembles all required data for a saved floorplate,
 * including auto-generated ID, name, and timestamps.
 *
 * @param layoutOption - The LayoutOption containing the floorplan and strategy
 * @param uiState - The serialized UI state for restoring settings on load
 * @param buildingId - Building identifier for grouping saves
 * @returns A complete SavedFloorplate object ready to pass to `saveFloorplate()`
 *
 * @example
 * ```typescript
 * const saved = createSavedFloorplate(
 *   generatedOptions[selectedIndex],
 *   getSerializableUIState(),
 *   currentBuildingId
 * );
 * await saveFloorplate(saved);
 * ```
 */
export function createSavedFloorplate(
  layoutOption: SavedFloorplate['layoutOption'],
  uiState: SavedFloorplate['uiState'],
  buildingId: string
): SavedFloorplate {
  const now = new Date().toISOString();
  const stats = layoutOption.floorplan.stats;

  return {
    id: generateId(),
    name: generateDefaultName(layoutOption.strategy),
    createdAt: now,
    updatedAt: now,
    layoutOption,
    uiState,
    buildingId,
    previewStats: {
      totalUnits: stats.totalUnits,
      efficiency: stats.efficiency,
      strategy: layoutOption.strategy,
      buildingDimensions: `${uiState.length}' x ${uiState.buildingDepth}'`
    }
  };
}
