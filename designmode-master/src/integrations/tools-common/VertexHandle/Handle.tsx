import { Vector3 } from "three"
import { useEffect, useMemo } from "preact/compat"
import VertexHandle from "./VertexHandle"
import sceneManager from "src/core/three/sceneManager"

type Props = {
  position: Vector3
  hovered?: boolean
  snapActive?: boolean
  snapPassive?: boolean
}

export const Handle = ({ position, hovered = false, snapActive = false, snapPassive = false }: Props) => {
  const vertexHandle = useMemo(() => {
    let handle = new VertexHandle(new Vector3())
    handle.name = "Draw Handle"
    return handle
  }, [])

  useEffect(() => {
    vertexHandle.moveTo(position)
    sceneManager.render()
  }, [position, vertexHandle])

  useEffect(() => {
    if (snapActive) {
      vertexHandle.snapActive()
    } else if (snapPassive) {
      vertexHandle.snapPassive()
    } else if (hovered) {
      vertexHandle.hover()
    } else {
      vertexHandle.unHover()
    }
  }, [hovered, vertexHandle, snapActive, snapPassive])

  useEffect(() => {
    sceneManager.scene.add(vertexHandle)
    sceneManager.render()

    return () => {
      vertexHandle.dispose()
      sceneManager.scene.remove(vertexHandle)
      sceneManager.render()
    }
  }, [vertexHandle])

  return null
}
