import { useCallback, useMemo } from "preact/compat"
import { Box3, Line3, PerspectiveCamera, Vector3 } from "three"
import sceneManager from "src/core/three/sceneManager"
import { selectionSetSignal } from "src/core/selection/selectionState"
import { useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { EasingFunctions } from "src/lib/easing"
import { HotkeyCategory } from "src/core/hotkeys"
import { feetToMeter, isOnMac } from "src/lib/measurementSystem"
import { useIntegrated3DSketchAPI } from "src/integrations/wsm-tools/wsr/api/Integrated3DSketchAPI"
import { elementState } from "src/core/elements/ElementState"
import type { Proposal } from "src/core/elements/Proposal"
import { terrainSignal, type NewTerrainState } from "src/core/terrain/new-terrain-state"

function calculateBboxAtPath(
  path: string,
  proposal: Proposal,
  terrain: NewTerrainState,
  cache: Map<string, Box3>,
): Box3 {
  let bbox = cache.get(path)
  if (bbox) return bbox

  const node = proposal.snapshot.getNode(path)
  if (!node) {
    bbox = new Box3()
  } else {
    bbox = node.bbox(terrain.terrainSamplerData).getOrCompute()?.clone() ?? new Box3()

    for (const childNode of proposal.snapshot.getChildrenOfNode(node)) {
      const childBox = calculateBboxAtPath(childNode.path, proposal, terrain, cache)
      bbox.union(childBox)
    }
  }

  cache.set(path, bbox)
  return bbox
}

// Execute the zoom to fit action
export function useZoomToFit(): () => Promise<void> {
  const i3dsAPI = useIntegrated3DSketchAPI()
  const inI3DSMode = i3dsAPI.inI3DSMode

  const getZoomFitBBox = useCallback(() => {
    function getTerrainBoundingBox() {
      const terrain = terrainSignal.peek().mesh
      if (!terrain.geometry.boundingBox) {
        terrain.geometry.computeBoundingBox()
      }
      return terrain.geometry.boundingBox!
    }

    const getBoxFromI3DS = (selections: WSM.GroupInstancePathInterface[]) => {
      let totalBBox = WSM.Interval3d.Interval3d()
      const updatedBBoxes = selections.map((selection) => {
        const objectHistoryID = WSM.GroupInstancePath.GetFinalObjectHistoryID(selection)
        const transf = WSM.GroupInstancePath.GetObjectTransform(selection)
        // for instances, get the BBox directly from the instance's reference history
        const objectType = WSM.APIGetObjectTypeReadOnly(objectHistoryID.History, objectHistoryID.Object)
        if (objectType === WSM.nObjectType.nInstanceType) {
          const refHistId = WSM.APIGetGroupReferencedHistoryReadOnly(objectHistoryID.History, objectHistoryID.Object)
          return WSM.APIGetBoxReadOnly(refHistId, WSM.INVALID_ID, transf)
        }
        // otherwise, for non-instances, get the BBox from the object's transform
        else {
          return WSM.APIGetBoxReadOnly(objectHistoryID.History, objectHistoryID.Object, transf)
        }
      })

      updatedBBoxes.forEach((selectionBBox) => {
        totalBBox = WSM.Interval3d.AddInterval3d(totalBBox, selectionBBox)
      })

      return new Box3(
        new Vector3(feetToMeter(totalBBox.lower.x), feetToMeter(totalBBox.lower.y), feetToMeter(totalBBox.lower.z)),
        new Vector3(feetToMeter(totalBBox.upper.x), feetToMeter(totalBBox.upper.y), feetToMeter(totalBBox.upper.z)),
      )
    }

    const getBoxFromDesignMode = (selectedIds: Set<string>) => {
      const box = new Box3()
      const cache = new Map<string, Box3>()
      selectedIds.forEach((path) => {
        box.union(calculateBboxAtPath(path, elementState.currentProposalSignal.peek(), terrainSignal.peek(), cache))
      })
      return box
    }

    if (inI3DSMode) {
      const selections = FormIt.Selection.GetSelections()
      return selections.length > 0 ? getBoxFromI3DS(selections) : getTerrainBoundingBox()
    } else {
      const selectedIds = selectionSetSignal.peek()
      return selectedIds.size > 0 ? getBoxFromDesignMode(selectedIds) : getTerrainBoundingBox()
    }
  }, [inI3DSMode])

  return useCallback(async () => {
    const isPeprsp = sceneManager.camera instanceof PerspectiveCamera

    // Scene camera
    const camera = sceneManager.camera
    const perspCamera = sceneManager.perspectiveCamera
    const orthoCamera = sceneManager.orthographicCamera

    const box = getZoomFitBBox()

    // If there is still no box, get out
    if (!box || box.max.x < box.min.x) {
      return
    }

    // bbox center. This will be the new look at point
    const centerPoint = new Vector3(
      (box.max.x + box.min.x) / 2,
      (box.max.y + box.min.y) / 2,
      (box.max.z + box.min.z) / 2,
    )

    // Project the current camera position on a line parallel to the camera
    // direction and through the bbox ceneter
    const cameraDirection = camera.getWorldDirection(new Vector3(0, 0, 0))
    const cameraPosition = camera.position.clone()
    const endOfLine = new Vector3(
      cameraPosition.x + cameraDirection.x,
      cameraPosition.y + cameraDirection.y,
      cameraPosition.z + cameraDirection.z,
    )

    const line = new Line3(cameraPosition, endOfLine)
    const point1 = line.closestPointToPoint(centerPoint.clone(), false, new Vector3(0, 0, 0))

    // Vector to move the camera to that point
    const movementVector = centerPoint.clone().sub(point1)
    const cameraPosMoved = cameraPosition.clone().add(movementVector.clone())

    // Get 8 vertices for the bbox corners
    const boundingBox = [
      new Vector3(box.max.x, box.max.y, box.max.z),
      new Vector3(box.min.x, box.max.y, box.max.z),
      new Vector3(box.min.x, box.min.y, box.max.z),
      new Vector3(box.max.x, box.min.y, box.max.z),
      new Vector3(box.max.x, box.max.y, box.min.z),
      new Vector3(box.min.x, box.max.y, box.min.z),
      new Vector3(box.min.x, box.min.y, box.min.z),
      new Vector3(box.max.x, box.min.y, box.min.z),
    ]

    // Get the radius of the bounding sphere around the bbox
    const x2 = boundingBox.reduce((prevDistance, corner) => {
      const vec = corner.clone().sub(centerPoint.clone())
      const distance = vec.length()
      return Math.max(prevDistance, distance)
    }, -Number.MAX_VALUE)

    const cameraTranslate = movementVector.clone()
    const zoomOrg = orthoCamera.zoom
    let zoomNew = zoomOrg
    if (isPeprsp) {
      // Get the smaller of the horizontal or vertical view angle
      const halfAngleVert = ((perspCamera.fov * 0.5) / 180) * Math.PI
      const r = Math.sin(halfAngleVert) * (window.innerWidth / window.innerHeight)
      const halfAngleHoriz = Math.atan(r / Math.cos(halfAngleVert))
      const halfAngle = Math.min(halfAngleVert, halfAngleHoriz)

      // Get the vector to move the camera so that the bounding sphere
      // fits tightly inside the view frustum
      const y2 = x2 / Math.tan(halfAngle)
      const d2 = Math.sqrt(x2 * x2 + y2 * y2)
      const d = centerPoint.clone().sub(cameraPosMoved.clone()).dot(cameraDirection)
      const vec2 = camera.getWorldDirection(new Vector3()).multiplyScalar(d - d2)

      cameraTranslate.add(vec2)
    } else {
      // Calculate the new zoom factor so that the bounding sphere fits
      // into the view frustum
      const ratio = window.innerWidth / window.innerHeight
      const ratioHeight = ratio < 1.0 ? ratio : 1.0
      zoomNew = orthoCamera.top / (x2 * ratioHeight)
    }

    const targetOrg = sceneManager.controls.target.clone()

    // Animate the zoom to take 1 second
    let startTime: DOMHighResTimeStamp
    let previousTimeStamp: DOMHighResTimeStamp
    const duration = isPeprsp ? 500 : 750
    let done = false

    const animateZoom = (resolve: (value: PromiseLike<void> | void) => void) => (timeStamp: DOMHighResTimeStamp) => {
      if (startTime === undefined) {
        startTime = timeStamp
      }
      const elapsed = timeStamp - startTime

      if (previousTimeStamp !== timeStamp) {
        const factor = EasingFunctions.easeOutQuart(elapsed / duration)

        // Set the new orbit target to the box center
        sceneManager.controls.target.subVectors(centerPoint, targetOrg).multiplyScalar(factor).add(targetOrg)
        if (!isPeprsp) {
          // First move ...
          if (factor < 0.5) {
            const newPos = cameraPosition.clone().add(cameraTranslate.clone().multiplyScalar(factor * 2))
            camera.position.set(newPos.x, newPos.y, newPos.z)
          }
          // then zoom
          else {
            orthoCamera.zoom = zoomOrg + (zoomNew - zoomOrg) * ((factor - 0.5) * 2.0)
            orthoCamera.updateProjectionMatrix()
          }
        } else {
          const newPos = cameraPosition.clone().add(cameraTranslate.clone().multiplyScalar(factor))
          camera.position.set(newPos.x, newPos.y, newPos.z)
        }

        if (factor === 1) done = true

        // Update rendering
        sceneManager.controls.dispatchEvent({ type: done ? "end" : "change", target: undefined })
      }

      if (elapsed < duration) {
        // Stop the animation after 1 second
        previousTimeStamp = timeStamp
        if (!done) {
          window.requestAnimationFrame(animateZoom(resolve))
        } else {
          resolve()
        }
      } else {
        resolve()
      }
    }

    return new Promise<void>((resolve) => {
      window.requestAnimationFrame(animateZoom(resolve))
    })
  }, [getZoomFitBBox])
}

export default function useZoomFitTool() {
  const selectedIds = selectionSetSignal.value
  const zoomToFit = useZoomToFit()
  const size = selectedIds.size
  const registration = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => (size ? t(($) => $.camera.zoom.toFitSelection) : t(($) => $.camera.zoom.toFitProposal)),
      keyCode: "f",
      ctrl: !isOnMac,
      meta: isOnMac,
      alt: false,
      shift: false,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      callback: zoomToFit,
      editAccessRequired: false,
      category: HotkeyCategory.Camera,
    }
  }, [size, zoomToFit])
  useHotkey(registration)

  return zoomToFit
}
