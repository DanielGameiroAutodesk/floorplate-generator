import { selectionOnlyContainsPolygonsSignalFamily } from "src/integrations/tools-common/shapeTransformTools/shapeTransformTools.state"
import { AffineToolbar } from "src/integrations/Toolbars/CoreToolbar/domain/affine/AffineToolbar"
import ShapeTransformTool from "src/integrations/Toolbars/CoreToolbar/domain/shapeTransform/ShapeTransformTool"
import useMovableElementsSelected from "src/integrations/Toolbars/CoreToolbar/domain/affine/useMovableElementsSelected"
import { useMemo } from "preact/hooks"

export function ContextualToolbar() {
  const onlyPolygonsSelected = selectionOnlyContainsPolygonsSignalFamily(1).value
  return (
    <>
      <AffineToolbar />
      {onlyPolygonsSelected && <ShapeTransformTool />}
    </>
  )
}

export function useShouldShowContextualToolbar() {
  const movableElementsSelected = useMovableElementsSelected()
  const onlyPolygonsSelected = selectionOnlyContainsPolygonsSignalFamily(1).value
  return useMemo(() => {
    return movableElementsSelected || onlyPolygonsSelected
  }, [movableElementsSelected, onlyPolygonsSelected])
}
