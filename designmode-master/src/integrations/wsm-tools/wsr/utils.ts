import type { MessageHandler } from "@spacemakerai/web-sketch-renderer"
import type { Object3D } from "three"

export function getMessageHandler(): MessageHandler {
  // TODO: don't put this on window
  return (window as any).messageHandler as MessageHandler
}

export function getRoot(obj: Object3D): Object3D {
  if (obj.parent) {
    return getRoot(obj)
  }
  return obj
}

export type ScreenPoint = { pixelX: number; pixelY: number }
export type NormalizedScreenPoint = { x: number; y: number }

export const getScreenPointFromMouseEvent = (mouseEvent: MouseEvent): ScreenPoint => {
  return { pixelX: mouseEvent.clientX, pixelY: mouseEvent.clientY }
}

/** Normalizes mouse coordinates to [0-1] range */
export const getNormalizedScreenPoint = (screenPoint: ScreenPoint, domElement: HTMLElement): NormalizedScreenPoint => {
  const rect = domElement.getBoundingClientRect()
  return { x: screenPoint.pixelX / rect.width, y: screenPoint.pixelY / rect.height }
}

/** Checks if an object can be used in a for..of statement */
export function isIterable(obj: any): boolean {
  // checks for null and undefined
  if (obj == null) {
    return false
  }
  return typeof obj[Symbol.iterator] === "function"
}

/** Function that starts debugging in FormIt by outputing an axm string of the
 * given objects or when the array is empty all objects in the specified
 * history). Note the axm string is output to the console where it can be copied
 * to a script to use in FormIt. Then turns on journaling. */
export function startDebugOutput(nHistId: number, objectIds: number[]): void {
  const stringFile = WSM.APISaveToStringReadOnly(
    nHistId,
    objectIds.length > 0 ? objectIds : WSM.APIGetAllNonOwnedReadOnly(nHistId),
  )
  // Note the console.log output can be copied to a script to be used in FormIt
  console.log('    var fileStr = "' + stringFile + '"\n    WSM.APILoadFromString(mainHistID, fileStr)')

  const journalTypes = ["WSM"] //, "WSMReadOnly"]
  WSM.APIEnableJournalingTypes(journalTypes)
  WSM.APIEnableJournalingToString(WSM.INVALID_ID)
}

/** Function that ends debugging by putting journal output on the console.
 * This output can be copied into a script to be used in FormIt. */
export function endDebugOutput(): void {
  const journalString = WSM.APIDisableJournaling()
  console.log(journalString)
}
