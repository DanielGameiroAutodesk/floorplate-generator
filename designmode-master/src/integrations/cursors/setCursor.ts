import DRAW_NODE from "./draw.svg"
import ADD_POINT_CURSOR from "./addNode.svg"
import MOVE from "./Move.svg"
import VERTICAL_MOVE from "./MoveVerticalCursor.svg"
import HORIZONTAL_MOVE from "./moveHorizontal.svg"
import POINTER_CURSOR from "./PointerCursor.svg"
import DELETE_NODE from "./deleteNode.svg"
import CONNECT_NODE from "./connectNode.svg"
import ROTATE from "./Rotate.svg"
import DISTANCE_TOOL from "./distance_tool_cursor.svg"
import INVALID from "./invalid.svg"

import ADD from "./add.svg"
import SUBTRACT from "./subtract.svg"
import ADD_SUBTRACT from "./addSubtract.svg"
import sceneManager from "src/core/three/sceneManager"

const setCursor = (
  cursor: string,
  hotspotX?: number,
  hotspotY?: number,
  element: HTMLElement = sceneManager.renderer.domElement,
): void => {
  const hotspot = hotspotY && hotspotX ? ` ${hotspotX} ${hotspotY}` : ""
  const cursorVal = `${cursor}${hotspot}, auto`
  element.style.cursor = !cursor.startsWith("url") ? cursor : cursorVal
}

export const drawCursor = () => setCursor(`url("${DRAW_NODE}")`, 4, 4)
export const loadingCursor = () => setCursor("wait")
export const addNodeCursor = () => setCursor(`url("${ADD_POINT_CURSOR}")`, 4, 4)
export const deleteNodeCursor = () => setCursor(`url("${DELETE_NODE}")`, 4, 4)
export const connectNodeCursor = () => setCursor(`url("${CONNECT_NODE}")`, 4, 4)
export const rotateCursor = () => setCursor(`url("${ROTATE}")`, 4, 4)

export const addCursor = () => setCursor(`url("${ADD}")`, 4, 4)
export const subtractCursor = () => setCursor(`url("${SUBTRACT}")`, 4, 4)
export const addSubtractCursor = () => setCursor(`url("${ADD_SUBTRACT}")`, 4, 4)

export const moveCursor = () => setCursor(`url("${MOVE}")`, 2, 2)
export const moveVerticalCursor = () => setCursor(`url("${VERTICAL_MOVE}")`, 2, 2)
export const moveHorizontalCursor = () => setCursor(`url("${HORIZONTAL_MOVE}")`, 2, 2)
export const distanceToolCursor = () => setCursor(`url("${DISTANCE_TOOL}")`, 2, 2)

export const setPointerCursor = () => setCursor(`url("${POINTER_CURSOR}")`, 2, 2)
export const setSelectCursor = setPointerCursor
export const setPointerHandCursor = () => setCursor(`pointer`)

export const pushPullCursor = () => setCursor(`col-resize`)
export const pushPullVerticalCursor = () => setCursor(`row-resize`)

export const setCrossHairCursor = () => setCursor(`crosshair`)

export const invalidCursor = () => setCursor(`url("${INVALID}")`, 2, 2)

export const textEditCursor = () => setCursor("text")

export const defaultCursor = setPointerCursor
