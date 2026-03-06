import {
  DrawPolygon,
  set2DCallback,
  simplePolygonElementRenderer,
} from "src/integrations/tools-common/Drawing/basicShape/DrawPolygon"
import { basicElementPresets } from "src/integrations/basic-elements/basicElementPresets"
import {
  DrawGroundLine,
  set2DLineCallback,
  simpleLineElementRenderer,
} from "src/integrations/tools-common/Drawing/basicShape/DrawGroundLine"
import { Draw25DBox, set25DCallback } from "src/integrations/tools-common/Drawing/compoundShape/DrawBox25D"
import DrawPoint from "src/integrations/tools-common/Drawing/basicShape/DrawPoint"
import { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { PointsRenderer } from "src/integrations/tools-common/Drawing/basicShape/EditPointsOnGround"
import type { Shape } from "src/lib/three/Shape/types"
import { simpleVolume25DElementRenderer } from "src/integrations/tools-common/Drawing/compoundShape/DefaultPreviews"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import SurfaceToolbar from "src/integrations/Toolbars/CoreToolbar/domain/common/SurfaceToolbar"
import VolumeToolbar from "src/integrations/Toolbars/CoreToolbar/domain/common/VolumeToolbar"
import { LineToolbar } from "src/integrations/Toolbars/CoreToolbar/domain/common/LineToolbar"

export type Vec3 = { x: number; y: number; z: number }
export type ExtrudedPolygon = { coordinates: Vec3[]; height: number }
export type Line = { coordinates: Vec3[]; close: boolean }

/**
 * API for creating various geometries through Designmode's built-in tooling.
 *
 * This is heavily inspired by the existing DrawAPI, but tries to be more
 * portable outside of designmode by not relying on consumers to supply
 * CoreAPI-dependent callbacks or react components.
 *
 * As a result, this API is not as flexible as DrawAPI for designmode-specific
 * functionality, but it should be easier to use in other contexts.
 *
 */
export interface PortableDesignToolAPI {
  /**
   * Activates the tooling for creating a point in 3d space.
   *
   * @returns The created point.
   */
  getPoint(this: void): Promise<Vec3 | undefined>

  /**
   * Activates the tooling for creating a 2D (on terrain) polygon
   *
   * @returns The created polygon.
   */
  getPolygon(this: void): Promise<Vec3[] | undefined>

  /**
   * Activates the tooling for creating a volume by vertically extruding a polygon
   *
   * @returns The created extruded polygon.
   */
  getExtrudedPolygon(this: void): Promise<ExtrudedPolygon | undefined>

  /**
   * Activates the tooling for creating a line on terrain polygon
   *
   * @returns The created line.
   */
  getLine(this: void): Promise<Line | undefined>
}

export const portableDesignToolApi: PortableDesignToolAPI = {
  getPoint() {
    return new Promise<Vec3 | undefined>((resolve) => {
      const onComplete = (point: Vec3 | undefined) => {
        exitCurrentTool()
        resolve(point)
      }
      const PreviewComponent = ({ point }: { point: Vec3 }) => <PointsRenderer points={[point]} />
      toolAPI.setTool({
        id: "drawPoint",
        toolbar: () => <ToolbarCloseButton />,
        tool: () => <DrawPoint onComplete={onComplete} PreviewComponent={PreviewComponent} />,
        propertyPanel: "default",
      })
    })
  },
  getPolygon() {
    return new Promise<Vec3[] | undefined>((resolve) => {
      const onComplete = (shape?: Shape) => {
        exitCurrentTool()
        resolve(shape ? shape.vertices : undefined)
      }

      const PreviewComponent = simplePolygonElementRenderer(basicElementPresets.generic2D)
      set2DCallback(onComplete, PreviewComponent, "freeform")
      toolAPI.setTool({
        id: "drawPolygon",
        toolbar: () => <SurfaceToolbar category={"surface"} defaultMode={"freeform"} />,
        tool: DrawPolygon,
        propertyPanel: "default",
      })
    })
  },
  getExtrudedPolygon() {
    return new Promise<ExtrudedPolygon | undefined>((resolve) => {
      const onComplete = (volume?: { shape: Shape; height: number }) => {
        exitCurrentTool()
        resolve(volume ? { coordinates: volume.shape.vertices, height: volume.height } : undefined)
      }

      const PreviewComponent = simpleVolume25DElementRenderer(basicElementPresets.generic25D)
      set25DCallback(onComplete, PreviewComponent, "freeform")
      toolAPI.setTool({
        id: "draw25DBox",
        toolbar: () => <VolumeToolbar category={"volume"} defaultMode={"freeform"} />,
        tool: Draw25DBox,
        propertyPanel: "default",
      })
    })
  },
  getLine() {
    return new Promise<Line | undefined>((resolve) => {
      const onComplete = (line?: { shape: Shape; close: boolean }) => {
        exitCurrentTool()
        resolve(line ? { coordinates: line.shape.vertices, close: line.close } : undefined)
      }

      const PreviewComponent = simpleLineElementRenderer(basicElementPresets.generic2DLine)
      set2DLineCallback(onComplete, PreviewComponent, "freeform")
      toolAPI.setTool({
        id: "drawGroundLine",
        toolbar: () => <LineToolbar propertyPreset={"line"} defaultMode={"freeform"} />,
        tool: DrawGroundLine,
        propertyPanel: "default",
      })
    })
  },
}
