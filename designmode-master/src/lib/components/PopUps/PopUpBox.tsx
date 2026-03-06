import { useMemo, useRef } from "preact/hooks"
import { useState } from "preact/compat"
import { exitDragState, initDragging, updateBoxPositionOnDrag } from "./draggingAndResizeHelpers"
import { DragSurfaceStyle } from "./DragComponents"
import type { ComponentChildren, Ref } from "preact"
import styles from "./PopUpBox.module.pcss"
import { useTranslator } from "src/i18n"

////
//  Header
////

const HeaderTitle = ({ children }: { children: ComponentChildren }) => (
  <div className={styles.HeaderTitleStyle}>{children}</div>
)

const HeaderCloseIcon = ({ onClose }: { onClose: () => void }) => {
  const t = useTranslator()
  return (
    <div
      className={styles.HeaderIconStyle}
      onMouseDown={(e) => {
        e.stopPropagation()
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <weave-tooltip text={t(($) => $.ui.close)}>
        <weave-icon-button>
          <weave-close slot="icon"></weave-close>
        </weave-icon-button>
      </weave-tooltip>
    </div>
  )
}

const DefaultHeader = ({ title, onClose }: { title: string; onClose: () => void }) => {
  return (
    <>
      <HeaderTitle>{title}</HeaderTitle>
      <HeaderCloseIcon onClose={onClose} />
    </>
  )
}

const DragSurface = ({
  dragging,
  setDragging,
  dragSurface,
  container,
  popupId,
}: {
  dragging: any
  setDragging: any
  dragSurface: Ref<HTMLDivElement>
  container: Ref<HTMLDivElement>
  popupId: string
}) => {
  return (
    <div
      style={DragSurfaceStyle}
      ref={dragSurface}
      onMouseUp={() => {
        if (dragging) exitDragState(setDragging, dragSurface)
      }}
      onMouseLeave={() => {
        if (dragging) exitDragState(setDragging, dragSurface)
      }}
      onMouseMove={(e) => {
        lastPosition[popupId] = updateBoxPositionOnDrag(e, dragging, container)
      }}
    />
  )
}

const DraggableHeader = ({
  popupId,
  container,
  children,
  onDblClick,
}: {
  popupId: string
  container: Ref<HTMLDivElement>
  children: ComponentChildren
  onDblClick?: () => void
}) => {
  const dragSurface = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(undefined)

  return (
    <>
      <div
        className={styles.HeaderStyle}
        // eslint-disable-next-line react/no-unknown-property
        onDblClick={onDblClick}
        onMouseDown={(e: any) => {
          initDragging(e, setDragging, container, dragSurface)
        }}
      >
        {children}
        <DragSurface
          dragging={dragging}
          setDragging={setDragging}
          dragSurface={dragSurface}
          container={container}
          popupId={popupId}
        />
      </div>
    </>
  )
}

const getPopUpBoxStyle = (top: number, right: number = 290, minDistanceToScreenBottom: number = 200) => `
  position: fixed;
  z-index: 100000;
  right: ${Math.min(window.innerWidth - 200, Math.max(right, 0))}px;
  top: calc(${Math.max(0, Math.min(top, window.innerHeight - minDistanceToScreenBottom))}px);
  box-sizing: border-box;
  border-radius: 4px;
  background: var(--background-color-surface-100);
  box-shadow: 0px 0px 16px rgba(0, 0, 0, 0.2);
`

const lastPosition: Record<string, { top: number; right: number }> = {}

type Props = {
  children: string | JSX.Element | JSX.Element[] | (() => JSX.Element)
  top: number
  right?: number
  minDistanceToScreenBottom?: number
  id: string
  header: ComponentChildren
  primaryHeader?: boolean
  onHeaderDblClick?: () => void
}

function Container({
  children,
  top,
  right,
  minDistanceToScreenBottom,
  id,
  header,
  primaryHeader,
  onHeaderDblClick,
  ...props
}: Props & JSX.HTMLAttributes<HTMLDivElement>) {
  const container = useRef<HTMLDivElement>(null)

  const initialRight = right || 288
  const styleString = useMemo(() => {
    // This style string is used for the initial popup positioning only (or if minDistanceToScreenBottom has
    // changed). During dragging, box position is continuously updated by updateBoxPositionOnDrag on mousemove
    // within DraggableHeader -> DragSurface
    const position = lastPosition[id]
    if (position) return getPopUpBoxStyle(position.top, position.right, minDistanceToScreenBottom)
    return getPopUpBoxStyle(top, initialRight, minDistanceToScreenBottom)
  }, [top, minDistanceToScreenBottom, initialRight, id])

  const className = primaryHeader ? `${styles.PopUpBox} ${styles.PrimaryHeader}` : `${styles.PopUpBox}`

  return (
    <div {...props} className={className} style={styleString} ref={container}>
      <DraggableHeader popupId={id} container={container} onDblClick={onHeaderDblClick}>
        {header}
      </DraggableHeader>
      <div>{children}</div>
    </div>
  )
}

export default {
  Container,
  DefaultHeader,
  HeaderTitle,
  HeaderCloseIcon,
}
