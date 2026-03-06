import type {
  CompleteCallback2D,
  PolygonPreviewComponent,
} from "src/integrations/tools-common/Drawing/basicShape/DrawPolygon"
import {
  DrawPolygon,
  set2DCallback,
  simplePolygonElementRenderer,
} from "src/integrations/tools-common/Drawing/basicShape/DrawPolygon"
import type { AdjustmentFunction as _AdjustmentFunction } from "src/lib/three/Shape/types"
import { basicElementPresets } from "src/integrations/basic-elements/basicElementPresets"
import type {
  CompleteCallback2DLine,
  LinePreviewComponent,
} from "src/integrations/tools-common/Drawing/basicShape/DrawGroundLine"
import {
  DrawGroundLine,
  set2DLineCallback,
  simpleLineElementRenderer,
} from "src/integrations/tools-common/Drawing/basicShape/DrawGroundLine"
import type {
  CompleteCallback25D,
  Volume25DPreviewComponent,
} from "src/integrations/tools-common/Drawing/compoundShape/DrawBox25D"
import { Draw25DBox, set25DCallback } from "src/integrations/tools-common/Drawing/compoundShape/DrawBox25D"
import type { Properties } from "@spacemakerai/element-types"
import { simpleVolume25DElementRenderer } from "src/integrations/tools-common/Drawing/compoundShape/DefaultPreviews"
import VolumeToolbar from "src/integrations/Toolbars/CoreToolbar/domain/common/VolumeToolbar"
import SurfaceToolbar from "src/integrations/Toolbars/CoreToolbar/domain/common/SurfaceToolbar"
import { LineToolbar } from "src/integrations/Toolbars/CoreToolbar/domain/common/LineToolbar"
import type { FC } from "react"
import DrawPoint from "src/integrations/tools-common/Drawing/basicShape/DrawPoint"
import type { EditPoint } from "src/integrations/tools-common/Drawing/basicShape/EditPointsOnGround"
import type { Vec3 } from "src/lib/geometry/geometryTypes"
import type { Handles, UpdatedHandles } from "src/integrations/extensions/EditHandles"
import { createEditHandles, EditHandlesToolbar } from "src/integrations/extensions/EditHandles"
import { toolAPI } from "src/core/toolsState"

/**
 * API for creating various geometries through Designmode's built-in tooling
 */
export interface DrawAPI {
  /**
   * Activates the tooling for creating a point in 3d space
   * @param onComplete the callback to run when a point has been created
   * @param toolbar rendering toolbar while placing point
   * @param PreviewComponent component for rendering a preview of the point while drawing
   */

  getPoint(onComplete: CompleteCallbackPoint, toolbar: FC, PreviewComponent?: PointPreviewComponent): void

  editHandles_EXPERIMENTAL(
    handles: Handles,
    onComplete: (updatedHandles: UpdatedHandles) => void,
    onCommit: (updatedHandles: UpdatedHandles) => void,
    onPreview: (updatedHandles: UpdatedHandles) => void,
  ): { updateHandles: (handles: Handles) => void }

  /**
   * Activates the tooling for creating a 2D (on terrain) polygon
   *
   * @param onComplete the callback to run when a polygon has been created
   * @param PreviewComponent component for rendering a preview of the shape while drawing
   * @param defaultMode the default mode to start the tool in
   */
  getPolygon(
    onComplete: CompleteCallback2D,
    PreviewComponent?: PolygonPreviewComponent,
    defaultMode?: "rectangle" | "circle" | "pick" | "freeform",
  ): void

  /**
   * Activates the tooling for creating a volume by vertically extruding a polygon
   *
   * @param onComplete the callback to run when a volume has been created
   * @param PreviewComponent component for rendering a preview of the shape while drawing
   * @param defaultMode the default mode to start the tool in
   * @param discreteHeight optional parameter for setting a discrete height for the volume (e.g. story height for buildings)
   */
  get25DVolume(
    onComplete: CompleteCallback25D,
    PreviewComponent?: Volume25DPreviewComponent,
    defaultMode?: "rectangle" | "circle" | "pick" | "freeform",
    discreteHeight?: number,
  ): void

  /**
   * Activates the tooling for creating a line on terrain polygon
   *
   * @param onComplete the callback to run when a line has been created
   * @param PreviewComponent component for rendering a preview of the shape while drawing
   * @param RightPanelComponent custom right panel while using this tool
   * @param defaultMode the default mode to start the tool in
   */
  getLine(
    onComplete: CompleteCallback2DLine,
    PreviewComponent?: LinePreviewComponent,
    RightPanelComponent?: FC,
    defaultMode?: "freeform" | "pick",
  ): void

  /**
   * Creates a React component that renders a vertically extruded polygon using the passed properties to control visuals
   * @param props the properties used to control visuals
   */
  simpleVolume25DElementRenderer(props: Properties): Volume25DPreviewComponent

  /**
   * Creates a React component that renders a polygon on the terrain using the passed properties to control visuals
   * @param props the properties used to control visuals
   */
  simplePolygonElementRenderer(props: Properties): PolygonPreviewComponent

  /**
   * Creates a React component that renders a line on the terrain using the passed properties to control visuals
   * @param props the properties used to control visuals
   */
  simpleLineElementRenderer(props: Properties): LinePreviewComponent
}

export const drawApi: DrawAPI = {
  getPoint(onComplete: CompleteCallbackPoint, toolbar: FC, PreviewComponent?: PointPreviewComponent) {
    toolAPI.setTool({
      id: "drawPoint",
      tool: () => <DrawPoint onComplete={onComplete} PreviewComponent={PreviewComponent} />,
      toolbar,
      propertyPanel: "default",
    })
  },
  editHandles_EXPERIMENTAL(
    handles: Handles,
    onComplete: (updatedHandles: UpdatedHandles) => void,
    onCommit: (updatedHandles: UpdatedHandles) => void,
    onPreview: (updatedHandles: UpdatedHandles) => void,
  ): { updateHandles: (handles: Handles) => void } {
    const { updateHandles, component } = createEditHandles(handles, onComplete, onCommit, onPreview)
    toolAPI.setTool({
      id: "editHandles_EXPERIMENTAL",
      toolbar: EditHandlesToolbar,
      tool: () => component,
      propertyPanel: "default",
    })
    return { updateHandles }
  },
  getPolygon(onComplete, PreviewComponent, defaultMode) {
    set2DCallback(onComplete, PreviewComponent, defaultMode)
    toolAPI.setTool({
      id: "drawPolygon",
      toolbar: () => <SurfaceToolbar category={"surface"} defaultMode={defaultMode ?? "freeform"} />,
      tool: DrawPolygon,
      propertyPanel: "default",
    })
  },
  get25DVolume(onComplete, PreviewComponent, defaultMode, discreteHeight) {
    set25DCallback(onComplete, PreviewComponent, defaultMode, discreteHeight)
    toolAPI.setTool({
      id: "draw25DBox",
      toolbar: () => <VolumeToolbar category={"volume"} defaultMode={defaultMode ?? "freeform"} />,
      tool: Draw25DBox,
      propertyPanel: "default",
    })
  },
  getLine(onComplete, PreviewComponent, rightPanel, defaultMode) {
    set2DLineCallback(onComplete, PreviewComponent, defaultMode)
    toolAPI.setTool({
      id: "drawGroundLine",
      toolbar: () => <LineToolbar propertyPreset={"line"} defaultMode={defaultMode ?? "freeform"} />,
      tool: DrawGroundLine,
      propertyPanel: rightPanel || "default",
    })
  },
  simplePolygonElementRenderer,
  simpleVolume25DElementRenderer,
  simpleLineElementRenderer,
}

export type AdjustmentFunction = _AdjustmentFunction

export const propertyPresets = basicElementPresets

export type { LinePreviewComponent } from "src/integrations/tools-common/Drawing/basicShape/DrawGroundLine"
export type { ShapeCreationMetaData } from "src/integrations/tools-common/Drawing/types"

export type PointsPreviewComponent = FC<{ points: Vec3[] }>
export type PointPreviewComponent = FC<{ point: Vec3 }>
export type CompleteCallbackPoint = (point?: { x: number; y: number; z: number }) => void
export type CompleteCallbackEditPoint = (point: EditPoint) => void
