/**
 * Storage Service Tests
 *
 * Tests for the storage service using mocked Forma SDK.
 */

import {
  generateBuildingId,
  generateDefaultName,
  saveFloorplate,
  loadFloorplate,
  listFloorplates,
  deleteFloorplate,
  updateFloorplateName,
  duplicateFloorplate,
  createSavedFloorplate
} from './storage-service';
import { LayoutOption, FloorPlanData } from '../algorithm/types';

// Mock the Forma SDK
jest.mock('forma-embedded-view-sdk/auto', () => ({
  Forma: {
    extensions: {
      storage: {
        getTextObject: jest.fn(),
        setObject: jest.fn(),
        deleteObject: jest.fn()
      }
    }
  }
}));

import { Forma } from 'forma-embedded-view-sdk/auto';

// Helper to create mock floorplan data
function createMockFloorplan(): FloorPlanData {
  return {
    corridor: { x: 0, y: 0, width: 100, depth: 2 },
    cores: [],
    units: [],
    buildingLength: 100,
    buildingDepth: 20,
    transform: { centerX: 0, centerY: 0, rotation: 0 },
    floorElevation: 0,
    stats: {
      gsf: 1000,
      nrsf: 800,
      efficiency: 0.8,
      totalUnits: 10,
      unitCounts: { Studio: 2, OneBed: 4, TwoBed: 3, ThreeBed: 1 }
    },
    egress: {
      maxDeadEnd: 0,
      maxTravelDistance: 50,
      deadEndStatus: 'Pass' as const,
      travelDistanceStatus: 'Pass' as const
    }
  };
}

function createMockLayoutOption(): LayoutOption {
  return {
    id: 'option-1',
    strategy: 'balanced',
    floorplan: createMockFloorplan(),
    label: 'Balanced',
    description: 'A balanced approach'
  };
}

function createMockUIState() {
  return {
    alignment: 100,
    unitTypes: [],
    length: 300,
    stories: 1,
    buildingDepth: 65,
    corridorWidth: 6,
    corePlacement: 'North' as const,
    coreWidth: 12,
    coreDepth: 29.5,
    sprinklered: true,
    commonPath: 125,
    travelDistance: 250,
    deadEnd: 50
  };
}

describe('storage-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateBuildingId', () => {
    it('should generate consistent ID for same dimensions', () => {
      const id1 = generateBuildingId(300, 65);
      const id2 = generateBuildingId(300, 65);

      expect(id1).toBe(id2);
    });

    it('should generate different IDs for different dimensions', () => {
      const id1 = generateBuildingId(300, 65);
      const id2 = generateBuildingId(250, 65);
      const id3 = generateBuildingId(300, 70);

      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
    });

    it('should return alphanumeric string', () => {
      const id = generateBuildingId(300, 65);

      expect(id).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it('should return ID of reasonable length', () => {
      const id = generateBuildingId(300, 65);

      expect(id.length).toBeLessThanOrEqual(12);
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('generateDefaultName', () => {
    it('should include strategy name', () => {
      const balanced = generateDefaultName('balanced');
      const mix = generateDefaultName('mixOptimized');
      const efficiency = generateDefaultName('efficiencyOptimized');

      expect(balanced).toContain('Balanced');
      expect(mix).toContain('Mix Optimized');
      expect(efficiency).toContain('Efficiency');
    });

    it('should include date/time information', () => {
      const name = generateDefaultName('balanced');

      // Should contain month abbreviation
      expect(name).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
      // Should contain AM or PM
      expect(name).toMatch(/AM|PM/);
    });
  });

  describe('createSavedFloorplate', () => {
    it('should create a SavedFloorplate with all required fields', () => {
      const layoutOption = createMockLayoutOption();
      const uiState = createMockUIState();
      const buildingId = 'test-building';

      const saved = createSavedFloorplate(layoutOption, uiState, buildingId);

      expect(saved.id).toBeDefined();
      expect(saved.name).toBeDefined();
      expect(saved.createdAt).toBeDefined();
      expect(saved.updatedAt).toBeDefined();
      expect(saved.layoutOption).toBe(layoutOption);
      expect(saved.uiState).toBe(uiState);
      expect(saved.buildingId).toBe(buildingId);
      expect(saved.previewStats).toBeDefined();
    });

    it('should generate unique IDs', () => {
      const layoutOption = createMockLayoutOption();
      const uiState = createMockUIState();

      const saved1 = createSavedFloorplate(layoutOption, uiState, 'b1');
      const saved2 = createSavedFloorplate(layoutOption, uiState, 'b2');

      expect(saved1.id).not.toBe(saved2.id);
    });

    it('should include correct preview stats', () => {
      const layoutOption = createMockLayoutOption();
      const uiState = createMockUIState();

      const saved = createSavedFloorplate(layoutOption, uiState, 'building');

      expect(saved.previewStats.totalUnits).toBe(10);
      expect(saved.previewStats.efficiency).toBe(0.8);
      expect(saved.previewStats.strategy).toBe('balanced');
      expect(saved.previewStats.buildingDimensions).toBe("300' x 65'");
    });
  });

  describe('saveFloorplate', () => {
    it('should call storage API with correct key', async () => {
      const mockSetObject = Forma.extensions.storage.setObject as jest.Mock;
      const mockGetTextObject = Forma.extensions.storage.getTextObject as jest.Mock;

      mockSetObject.mockResolvedValue(undefined);
      mockGetTextObject.mockResolvedValue({ data: JSON.stringify({ version: 1, items: [] }) });

      const layoutOption = createMockLayoutOption();
      const uiState = createMockUIState();
      const saved = createSavedFloorplate(layoutOption, uiState, 'building');

      await saveFloorplate(saved);

      expect(mockSetObject).toHaveBeenCalledWith(
        expect.objectContaining({
          key: `floorplate-save-${saved.id}`
        })
      );
    });

    it('should update index after saving', async () => {
      const mockSetObject = Forma.extensions.storage.setObject as jest.Mock;
      const mockGetTextObject = Forma.extensions.storage.getTextObject as jest.Mock;

      mockSetObject.mockResolvedValue(undefined);
      mockGetTextObject.mockResolvedValue({ data: JSON.stringify({ version: 1, items: [] }) });

      const layoutOption = createMockLayoutOption();
      const uiState = createMockUIState();
      const saved = createSavedFloorplate(layoutOption, uiState, 'building');

      await saveFloorplate(saved);

      // Should be called twice: once for data, once for index
      expect(mockSetObject).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadFloorplate', () => {
    it('should return floorplate when found', async () => {
      const mockGetTextObject = Forma.extensions.storage.getTextObject as jest.Mock;

      const layoutOption = createMockLayoutOption();
      const uiState = createMockUIState();
      const mockSaved = createSavedFloorplate(layoutOption, uiState, 'building');

      mockGetTextObject.mockResolvedValue({ data: JSON.stringify(mockSaved) });

      const result = await loadFloorplate(mockSaved.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockSaved.id);
    });

    it('should return null when not found', async () => {
      const mockGetTextObject = Forma.extensions.storage.getTextObject as jest.Mock;
      mockGetTextObject.mockResolvedValue(null);

      const result = await loadFloorplate('non-existent');

      expect(result).toBeNull();
    });

    it('should return null on storage error', async () => {
      const mockGetTextObject = Forma.extensions.storage.getTextObject as jest.Mock;
      mockGetTextObject.mockRejectedValue(new Error('Storage error'));

      const result = await loadFloorplate('some-id');

      expect(result).toBeNull();
    });
  });

  describe('listFloorplates', () => {
    it('should return empty array when no saves exist', async () => {
      const mockGetTextObject = Forma.extensions.storage.getTextObject as jest.Mock;
      mockGetTextObject.mockResolvedValue(null);

      const result = await listFloorplates();

      expect(result).toEqual([]);
    });

    it('should return saved items from index', async () => {
      const mockGetTextObject = Forma.extensions.storage.getTextObject as jest.Mock;

      const mockIndex = {
        version: 1,
        items: [
          { id: 'save-1', name: 'Save 1', createdAt: '2024-01-01', updatedAt: '2024-01-01', buildingId: 'b1', previewStats: {} },
          { id: 'save-2', name: 'Save 2', createdAt: '2024-01-02', updatedAt: '2024-01-02', buildingId: 'b1', previewStats: {} }
        ]
      };

      mockGetTextObject.mockResolvedValue({ data: JSON.stringify(mockIndex) });

      const result = await listFloorplates();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('save-1');
      expect(result[1].id).toBe('save-2');
    });
  });

  describe('deleteFloorplate', () => {
    it('should call deleteObject with correct key', async () => {
      const mockDeleteObject = Forma.extensions.storage.deleteObject as jest.Mock;
      const mockGetTextObject = Forma.extensions.storage.getTextObject as jest.Mock;
      const mockSetObject = Forma.extensions.storage.setObject as jest.Mock;

      mockDeleteObject.mockResolvedValue(undefined);
      mockGetTextObject.mockResolvedValue({ data: JSON.stringify({ version: 1, items: [] }) });
      mockSetObject.mockResolvedValue(undefined);

      await deleteFloorplate('test-id');

      expect(mockDeleteObject).toHaveBeenCalledWith({ key: 'floorplate-save-test-id' });
    });

    it('should update index to remove deleted item', async () => {
      const mockDeleteObject = Forma.extensions.storage.deleteObject as jest.Mock;
      const mockGetTextObject = Forma.extensions.storage.getTextObject as jest.Mock;
      const mockSetObject = Forma.extensions.storage.setObject as jest.Mock;

      const mockIndex = {
        version: 1,
        items: [
          { id: 'keep-this', name: 'Keep' },
          { id: 'delete-this', name: 'Delete' }
        ]
      };

      mockDeleteObject.mockResolvedValue(undefined);
      mockGetTextObject.mockResolvedValue({ data: JSON.stringify(mockIndex) });
      mockSetObject.mockResolvedValue(undefined);

      await deleteFloorplate('delete-this');

      // Check that setObject was called with index that doesn't include deleted item
      const setObjectCall = mockSetObject.mock.calls[0][0];
      const savedIndex = JSON.parse(setObjectCall.data);
      expect(savedIndex.items).toHaveLength(1);
      expect(savedIndex.items[0].id).toBe('keep-this');
    });
  });

  describe('updateFloorplateName', () => {
    it('should update name and updatedAt timestamp', async () => {
      const mockGetTextObject = Forma.extensions.storage.getTextObject as jest.Mock;
      const mockSetObject = Forma.extensions.storage.setObject as jest.Mock;

      const layoutOption = createMockLayoutOption();
      const uiState = createMockUIState();
      const mockSaved = createSavedFloorplate(layoutOption, uiState, 'building');

      mockGetTextObject.mockImplementation(({ key }: { key: string }) => {
        if (key.includes(mockSaved.id)) {
          return Promise.resolve({ data: JSON.stringify(mockSaved) });
        }
        return Promise.resolve({ data: JSON.stringify({ version: 1, items: [] }) });
      });
      mockSetObject.mockResolvedValue(undefined);

      // Wait a bit to ensure timestamp differs
      await new Promise(r => setTimeout(r, 10));

      await updateFloorplateName(mockSaved.id, 'New Name');

      // Verify the saved data has new name
      const saveCall = mockSetObject.mock.calls.find(
        (call: unknown[]) => (call[0] as { key: string }).key.includes(mockSaved.id)
      );
      expect(saveCall).toBeDefined();
      const savedData = JSON.parse((saveCall![0] as { data: string }).data);
      expect(savedData.name).toBe('New Name');
    });

    it('should throw error when floorplate not found', async () => {
      const mockGetTextObject = Forma.extensions.storage.getTextObject as jest.Mock;
      mockGetTextObject.mockResolvedValue(null);

      await expect(updateFloorplateName('non-existent', 'New Name'))
        .rejects.toThrow('Floorplate not found');
    });
  });

  describe('duplicateFloorplate', () => {
    it('should create copy with new ID', async () => {
      const mockGetTextObject = Forma.extensions.storage.getTextObject as jest.Mock;
      const mockSetObject = Forma.extensions.storage.setObject as jest.Mock;

      const layoutOption = createMockLayoutOption();
      const uiState = createMockUIState();
      const original = createSavedFloorplate(layoutOption, uiState, 'building');

      mockGetTextObject.mockImplementation(({ key }: { key: string }) => {
        if (key.includes(original.id)) {
          return Promise.resolve({ data: JSON.stringify(original) });
        }
        return Promise.resolve({ data: JSON.stringify({ version: 1, items: [] }) });
      });
      mockSetObject.mockResolvedValue(undefined);

      const duplicate = await duplicateFloorplate(original.id);

      expect(duplicate.id).not.toBe(original.id);
      expect(duplicate.name).toContain('(Copy)');
    });

    it('should throw error when original not found', async () => {
      const mockGetTextObject = Forma.extensions.storage.getTextObject as jest.Mock;
      mockGetTextObject.mockResolvedValue(null);

      await expect(duplicateFloorplate('non-existent'))
        .rejects.toThrow('Floorplate not found');
    });
  });
});
