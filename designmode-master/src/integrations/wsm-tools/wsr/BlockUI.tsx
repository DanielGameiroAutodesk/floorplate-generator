import { isBlockingUISignal } from "./api/EditWSMElementTool"

// This component is used to block the UI when the user is saving a 3D sketch.
export function BlockUI() {
  return isBlockingUISignal.value ? (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "all",
        zIndex: 9999999,
        backgroundColor: `rgba(0, 0, 0, 0)`,
      }}
    ></div>
  ) : null
}
