import Floors3dSketch from "src/integrations/wsm-tools/wsr/integrated/components/Floors3dSketch/Floors3dSketch"
import styled from "./Properties3dSketch.module.pcss"
import { formitInitializedSignal } from "src/integrations/wsm-tools/wsr/api/useInitialize"
import AddFloors3dSketch from "src/integrations/wsm-tools/building/AddFloors"
import type { InternalPath } from "src/lib/element/path"

const Properties3dSketch = ({ editPath }: { editPath?: InternalPath }) => {
  const isFormItCoreReady = formitInitializedSignal.value

  if (!isFormItCoreReady) return null

  return (
    <div className={styled.Container}>
      <AddFloors3dSketch />
      <Floors3dSketch editPath={editPath} />
    </div>
  )
}

export default Properties3dSketch
