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
 * Generate a building ID from dimensions (for grouping saves)
 * Uses a simple hash of width + depth to identify "same" building
 */
export function generateBuildingId(width: number, depth: number): string {
  const signature = `${width.toFixed(1)}-${depth.toFixed(1)}`;
  // Simple base64-like encoding for readability
  return btoa(signature).replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
}

/**
 * Generate a default name for a saved floorplate
 * Format: "{Strategy} - {Month} {Day}, {Time}"
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
 * Save a floorplate to storage
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
 * Load a full floorplate from storage
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
 * List all saved floorplates (returns summaries only)
 */
export async function listFloorplates(): Promise<SavedFloorplateSummary[]> {
  const index = await loadIndex();
  return index.items;
}

/**
 * Delete a saved floorplate
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
 * Update the name of a saved floorplate
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
 * Duplicate a saved floorplate
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
 * Create a new SavedFloorplate object (helper for main.ts)
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
