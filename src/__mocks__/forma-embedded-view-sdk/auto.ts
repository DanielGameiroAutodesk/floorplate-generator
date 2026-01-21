/**
 * Mock for forma-embedded-view-sdk/auto
 * Used for testing storage-service and other extension code
 */

export const Forma = {
  extensions: {
    storage: {
      getTextObject: jest.fn(),
      setObject: jest.fn(),
      deleteObject: jest.fn()
    }
  },
  geometry: {
    getTriangles: jest.fn(),
    getPathsByCategory: jest.fn()
  },
  selection: {
    getSelection: jest.fn()
  },
  render: {
    addMesh: jest.fn(),
    cleanup: jest.fn()
  },
  proposal: {
    addElement: jest.fn()
  }
};

export default Forma;
