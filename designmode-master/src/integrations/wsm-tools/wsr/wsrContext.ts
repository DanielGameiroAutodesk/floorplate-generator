import type { IToolAppContext, MessageHandler } from "@spacemakerai/web-sketch-renderer"
import {
  FormItIntegration,
  FormItTools,
  NullTool,
  ResourceManager,
  SketchScene,
  SketchScene2D,
  ToolManager,
  CameraManager,
  CameraMode,
  FormItLineStyleTheme,
  FastDataUtils,
} from "@spacemakerai/web-sketch-renderer"

import * as THREE from "three"

import type { SceneManager } from "src/core/three/sceneManager"

import sceneManager from "src/core/three/sceneManager"

import type { WebGLRenderer } from "three"
import type { SketchSceneOptions, IconDescription } from "@spacemakerai/web-sketch-renderer"

import { getNameFromFormItCommand, toolMeta } from "./toolMeta"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import type { OrbitControls } from "three/examples/jsm/Addons.js"

import NodeDefault from "./icons/node/Node_Default.png"
//import NodeHover from "./icons/node/Node_Hover.png"
import NodeSnapping from "./icons/node/Node_Snapping.png"
import NodeCentroid from "./icons/node/Node_Centroid.png"
import OnFace from "./icons/node/OnFace.png"
import OnEdge from "./icons/node/OnEdge.png"
import FromAxis from "./icons/node/OnFace.png"
import { captureException } from "@sentry/browser"
import {
  SNAPPING_ACTIVE_COLOR,
  SNAPPING_PASSIVE_COLOR,
  SNAPPING_XAXIS_COLOR,
  SNAPPING_YAXIS_COLOR,
  SNAPPING_ZAXIS_COLOR,
} from "src/integrations/tools-common/Drawing/shapeTool/visuals/snappingLineMaterials"
import { colors } from "src/lib/colors"
import { I3DS_DEFAULT_FACE_COLOR } from "./materials/i3dsMaterials"
import { Analytics } from "src/core/analytics"
import { is3dSketchInstanceValid } from "src/integrations/wsm-tools/wsm-integration/wsm-utils"
import { lineMeshCache } from "src/integrations/wsm-tools/wsm-integration/line-mesh-cache"
import { pathStartsWith } from "./tools/toolUtils"

const createMarkerIconOverrides = (): { [key: string]: IconDescription } => {
  const textureLoader = new THREE.TextureLoader()

  const inputPoint = textureLoader.load(NodeDefault)
  //const hovered = new THREE.TextureLoader().load("/node-icons/Node_Hover.png")
  const bullseye = textureLoader.load(NodeSnapping)
  const centroid = textureLoader.load(NodeCentroid)
  const onFace = textureLoader.load(OnFace)
  const onEdge = textureLoader.load(OnEdge)
  const fromAxis = textureLoader.load(FromAxis)

  // TODO: calculate this in a better way somehow?
  const iconRadius = 8.0 / 1080

  return {
    "WSM.InputPointStyleNames.kPosition": {
      iconTexture: inputPoint,
      color: new THREE.Color(1, 1, 1),
      radius: iconRadius,
    },
    "WSM.InputPointStyleNames.FromAxis": {
      iconTexture: fromAxis,
      color: new THREE.Color(1, 1, 1),
      radius: iconRadius,
    },
    // these two are going to be disabled soon
    "WSM.InputPointStyleNames.LCSOrigin": {
      iconTexture: centroid,
      color: new THREE.Color(0, 0, 0),
      radius: iconRadius,
    },
    "WSM.InputPointStyleNames.LCSOriginFG": {
      iconTexture: centroid,
      color: new THREE.Color(0, 0, 0),
      radius: iconRadius,
    },
    "WSM.InputPointStyleNames.GroundPlane": {
      iconTexture: inputPoint,
      color: new THREE.Color(1, 1, 1),
      radius: iconRadius,
    },
    "WSM.InputPointStyleNames.CameraPlane": {
      iconTexture: inputPoint,
      color: new THREE.Color(1, 1, 1),
      radius: iconRadius,
    },
    "WSM.InputPointStyleNames.WorkPlane": {
      iconTexture: inputPoint,
      color: new THREE.Color(1, 1, 1),
      radius: iconRadius,
    },
    "WSM.InputPointStyleNames.kWSMObjectFaceType": {
      iconTexture: onFace,
      color: new THREE.Color(1, 1, 1),
      radius: iconRadius,
    },
    "WSM.InputPointStyleNames.kWSMObjectEdgeType": {
      iconTexture: onEdge,
      color: new THREE.Color(1, 1, 1),
      radius: iconRadius,
    },
    "WSM.InputPointStyleNames.kWSMObjectEdgeMidPointType": {
      iconTexture: centroid,
      color: new THREE.Color(1, 1, 1),
      radius: iconRadius,
    },
    "WSM.InputPointStyleNames.kWSMObjectCircleCenterType": {
      iconTexture: centroid,
      color: new THREE.Color(1, 1, 1),
      radius: iconRadius,
    },
    "WSM.InputPointStyleNames.kWSMObjectEdgeMidSnappedToPointType": {
      iconTexture: bullseye,
      color: new THREE.Color(1, 1, 1),
      radius: iconRadius,
    },
    "WSM.InputPointStyleNames.kWSMObjectVertexType": {
      iconTexture: bullseye,
      color: new THREE.Color(1, 1, 1),
      radius: iconRadius,
    },
    "WSM.InputPointStyleNames.kWSMObjectFaceCentroidPointType": {
      iconTexture: centroid,
      color: new THREE.Color(1, 1, 1),
      radius: iconRadius,
    },
    "WSM.InputPointStyleNames.kWSMObjectFaceCentroidSnappedToPointType": {
      iconTexture: bullseye,
      color: new THREE.Color(1, 1, 1),
      radius: iconRadius,
    },
  }
}

/**
 * Manages a sketchScene and the FormItIntegration related objects.
 */
export class WSRContext implements IToolAppContext {
  sketchScene: SketchScene
  sketchScene2D: SketchScene2D
  cameraManager: CameraManager
  renderer: WebGLRenderer
  resourceManager: ResourceManager
  toolManager: ToolManager

  formItIntegration: FormItIntegration
  canvas: HTMLCanvasElement
  canvas2d: HTMLCanvasElement

  cameraChangedHandle: any

  needsRedraw: boolean = true

  render: () => void

  private animationId: number = -1

  onRequestSceneUpdate: () => void

  #hideFormItDimensions: boolean = false
  levelGeometryRenderRequestHandle: any
  pauseUpdatesHandle: any
  inferenceChangedHandler: any

  get hideFormItDimensions() {
    return this.#hideFormItDimensions
  }

  set hideFormItDimensions(hide: boolean) {
    this.#hideFormItDimensions = hide
    this.sketchScene2D.hideDimensions = hide
    this.formItIntegration.hideDimensions = hide
  }

  set hideFormItIntegrationDimensions(hide: boolean) {
    this.formItIntegration.hideDimensions = hide
  }

  set hidesketchScene2DDimensions(hide: boolean) {
    this.sketchScene2D.hideDimensions = hide
  }

  resizeHandler: () => void
  dblClickHandler: () => void

  orbitControls: OrbitControls
  startCameraOperation: () => void
  stopCameraOperation: () => void

  /**
   * This is used as a marker for determining if
   * whatever operation this context was used for
   * finished successfully. It has no other operation
   * within this class.
   */
  wasCompleted: boolean = false

  constructor(
    sceneManager: SceneManager,
    public readonly mainHistoryId: number,
    public readonly scene: THREE.Object3D,
    public sketchSceneOptions: SketchSceneOptions,
    public readonly messageHandler: MessageHandler,
    public readonly instancePath?: WSM.GroupInstancePathInterface,
    visualizationOnly?: boolean,
  ) {
    const { canvas, perspectiveCamera, orthographicCamera, controls, renderer, render } = sceneManager

    this.orbitControls = controls as any
    this.startCameraOperation = () => {
      FormIt.Cameras.StartCameraOperation()
      this.needsRedraw = true
    }

    this.stopCameraOperation = () => {
      FormIt.Cameras.StopCameraOperation()
      this.needsRedraw = true
    }

    controls.addEventListener("start", this.startCameraOperation)
    controls.addEventListener("end", this.stopCameraOperation)

    this.onRequestSceneUpdate = () => {
      this.needsRedraw = true
    }

    this.render = render
    this.canvas = canvas
    this.canvas2d = document.getElementById("design-mode-2d-graphics") as HTMLCanvasElement
    this.renderer = renderer

    if (typeof sketchSceneOptions.markerIconOverride === "undefined") {
      sketchSceneOptions.markerIconOverride = createMarkerIconOverrides()
    }

    this.resourceManager = new ResourceManager(messageHandler, true)
    this.resourceManager.config.showNonManifold = true
    this.resourceManager.config.showOccludedSelections = false

    this.cameraManager = new CameraManager(
      this.resourceManager,
      controls as any,
      perspectiveCamera,
      orthographicCamera,
      canvas.clientWidth,
      canvas.clientHeight,
    )

    this.sketchScene = new SketchScene(
      this.resourceManager,
      this.cameraManager,
      this.mainHistoryId,
      this.scene,
      sketchSceneOptions,
    )
    this.sketchScene.root.renderOrder = 3

    const lineTheme = new FormItLineStyleTheme()
    lineTheme.XAxisColor = new THREE.Color(SNAPPING_XAXIS_COLOR.getHex())
    lineTheme.YAxisColor = new THREE.Color(SNAPPING_YAXIS_COLOR.getHex())
    lineTheme.ZAxisColor = new THREE.Color(SNAPPING_ZAXIS_COLOR.getHex())
    lineTheme.SketchToolLineColor = new THREE.Color(colors.blue50)
    lineTheme.dashedAxisLines = false

    this.formItIntegration = new FormItIntegration(this, {
      enableMarkers: true,
      noReset: true,
      lineMaterials: {
        "WSM.LineStyleNames.kLSLineInference": new LineMaterial({
          color: SNAPPING_ACTIVE_COLOR.getHex(),
          linewidth: 1.0,
          vertexColors: false,
          alphaToCoverage: true,

          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1.0,
        }),
      },
      lineTheme,
      activeInferenceAxisColor: new THREE.Color(SNAPPING_ACTIVE_COLOR.getHex()),
      passiveInferenceAxisColor: new THREE.Color(SNAPPING_PASSIVE_COLOR.getHex()),
    })
    this.formItIntegration.setupFormItKeyboardShortcuts(JSON.stringify(toolMeta))

    FormIt.SetFeatureFlag("WSM.Inferencing.kUseAppRendering", true)
    FormIt.SetFeatureFlag(WSM.Inferencing.kOnlyShowLineMidPoint, true)
    FormIt.SetFeatureFlag(WSM.Inferencing.kHideLCSSnapPoint, true)
    FormIt.SetFeatureFlag(WSM.Inferencing.kHideXYZInferenceLines, false)

    this.sketchScene2D = new SketchScene2D(
      this.resourceManager,
      this.canvas2d,
      this.canvas,
      this.formItIntegration.messageHandler,
      {
        approxCharWidthRatio: 0.5,
        hideStaleGraphics: true,
      },
    )
    this.toolManager = new ToolManager(new NullTool("NullTool"))

    // check if we have levels, if we do apply a default face color
    if (this.instancePath) {
      const hasLevels =
        this.instancePath.ids.length > 0
          ? WSM.APIGetObjectLevelsReadOnly(this.instancePath.ids[0].History, this.instancePath.ids[0].Object).length > 0
          : false

      if (hasLevels) {
        this.sketchScene.setDefaultFaceColor(new THREE.Color(I3DS_DEFAULT_FACE_COLOR))
      }
    }

    this.onWindowResize()

    this.resizeHandler = () => this.onWindowResize()
    window.addEventListener("resize", this.resizeHandler)

    // analytics for double-clicking a mesh to convert to an object
    this.dblClickHandler = () => this.onDoubleClickMesh()
    window.addEventListener("formItDblClickConvertMeshToObject", () => {
      this.onDoubleClickMesh()
    })

    this.cameraChangedHandle = messageHandler.addMessageHandler("FormIt.Message.kCameraChanged", () => {
      this.onRequestSceneUpdate()
    })

    this.levelGeometryRenderRequestHandle = messageHandler.addMessageHandler(
      "FormIt.Message.kLevelGeometryRenderRequest",
      () => {
        // Check if the instancePath is valid and live
        if (this.instancePath && is3dSketchInstanceValid(this.instancePath)) {
          const hasLevels =
            this.instancePath.ids.length > 0
              ? WSM.APIGetObjectLevelsReadOnly(this.instancePath.ids[0].History, this.instancePath.ids[0].Object)
                  .length > 0
              : false

          if (hasLevels) {
            this.sketchScene.setDefaultFaceColor(new THREE.Color(I3DS_DEFAULT_FACE_COLOR))
          }
        }
      },
    )

    this.pauseUpdatesHandle = messageHandler.addMessageHandler("WSR.PauseUpdates", (val) => {
      this.sketchScene.pauseUpdates = val
    })

    /**
     * This message handler listens for inference objects changing,
     * and if one of those objects is a mesh, it creates a line mesh
     * for it.
     *
     * This should only apply to objects that can't be edited with
     * 3d sketch (ie, background buildings synced for inference purposes)
     */
    this.inferenceChangedHandler = messageHandler.addMessageHandler(
      "FormIt.Message.kInferenceEventInferencedObjectChanged",
      (highlightObject: WSM.GroupInstancePathInterface) => {
        if (!highlightObject || highlightObject.ids.length == 0) {
          return
        }

        // For being "in-context", we're only considering the root of what we're editing
        // (an instance on history 0)
        const inContextPath = FormIt.GroupEdit.GetInContextEditingPath()
        if (!inContextPath || inContextPath.ids.length == 0) {
          return
        }

        const rootPath = {
          ids: [inContextPath.ids[0]],
          objectName: inContextPath.objectName,
        } as WSM.GroupInstancePathInterface

        // We don't want to create line meshes for things that are
        // in-context, only for out of context data!
        if (pathStartsWith(highlightObject, rootPath)) {
          return
        }

        const id = highlightObject.ids[highlightObject.ids.length - 1]
        const t = FastDataUtils.getObjectTypes(undefined, id.History, [id.Object]).types[0]
        if (t == WSM.nMeshType) {
          messageHandler.broadcastJSMessage("WSR.PauseUpdates", true)
          lineMeshCache.getOrCreateLineMeshFromMesh(highlightObject.ids[highlightObject.ids.length - 1])
          messageHandler.broadcastJSMessage("WSR.PauseUpdates", false)
        }
      },
    )

    if (!visualizationOnly) {
      this.toolManager.pushTool(
        new FormItTools({
          ...this,
          onRequestSceneUpdate: () => {
            this.onRequestSceneUpdate()
          },
        }),
      )
    }
  }

  lastTime = performance.now()
  frameNumber = 0

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  animate(_ts: DOMHighResTimeStamp) {
    this.frameNumber += 1

    try {
      window.FormItModule._Emscripten_Tick_Headless(
        performance.now(),
        this.canvas.clientWidth,
        this.canvas.clientHeight,
        1.0,
      )
    } catch (err) {
      captureException(err, {
        tags: { owner: "conceptual", errorPoint: "WSR animate", "integration-type": "integrated" },
      })
      //not 100% sure we want to cancel the animation, but we also don't want to send thousands of events to Sentry if _Emscripten_Tick_Headless is failing
      cancelAnimationFrame(this.animationId)
      return
    }

    this.lastTime = performance.now()

    // update camera if needed
    if (this.cameraManager.shouldSwitchToOrthographic(sceneManager.camera)) {
      this.cameraManager.mode = CameraMode.Orthographic
      this.onWindowResize()
    } else if (this.cameraManager.shouldSwitchToPerspective(sceneManager.camera)) {
      this.cameraManager.mode = CameraMode.Perspective
      this.onWindowResize()
    }

    if (this.needsRedraw) {
      sceneManager.render()
      this.sketchScene2D.redraw()
      this.needsRedraw = false
    }

    this.animationId = requestAnimationFrame((ts) => this.animate(ts))
  }

  onShutdown(): void {
    if (this.animationId >= 0) {
      cancelAnimationFrame(this.animationId)
    }

    this.orbitControls.removeEventListener("start", this.startCameraOperation)
    this.orbitControls.removeEventListener("end", this.stopCameraOperation)

    this.cameraManager.dispose()
    this.toolManager.dispose()
    this.formItIntegration.dispose()
    this.sketchScene.dispose()
    this.sketchScene2D.dispose()

    window.removeEventListener("resize", this.resizeHandler)
    window.removeEventListener("formItDblClickConvertMeshToObject", this.dblClickHandler)

    this.formItIntegration.messageHandler.removeMessageHandler(this.cameraChangedHandle)
    this.formItIntegration.messageHandler.removeMessageHandler(this.levelGeometryRenderRequestHandle)
    this.formItIntegration.messageHandler.removeMessageHandler(this.pauseUpdatesHandle)
    this.formItIntegration.messageHandler.removeMessageHandler(this.inferenceChangedHandler)
    const undisposed = this.resourceManager.alive()
    for (const resource of undisposed) {
      console.error(`Undisposed resource ${resource.name} ${resource.constructorStackTrace}`, resource)
    }
  }

  onWindowResize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    FormIt.Cameras.SetViewportSize(w, h)

    this.canvas2d.width = w
    this.canvas2d.height = h
    this.resourceManager.onViewportResize(w, h, this.cameraManager.currentCamera())
  }

  onDoubleClickMesh() {
    Analytics.trackSelectTool("3dSketch", getNameFromFormItCommand("Meshes to Objects"), "double_click", "design-tool")
  }
}
