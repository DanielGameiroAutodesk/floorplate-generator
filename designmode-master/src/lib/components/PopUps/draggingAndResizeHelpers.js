const MIN_TOP = 0
const MIN_HEIGHT = 400

export const initDragging = (e, setDragging, container, dragSurface) => {
  const mouseX = e.clientX
  const mouseY = e.clientY
  const { top, right, height } = container.current.getBoundingClientRect()

  setDragging({ mouseX, mouseY, top, right: window.innerWidth - right, height })
  dragSurface.current.style.display = "block"
  dragSurface.current.style.cursor = "grabbing"
}

export const updateBoxPositionOnDrag = (e, dragging, container) => {
  const { clientX, clientY } = e
  const { mouseX, mouseY, top, right } = dragging
  const newTop = Math.max(top + clientY - mouseY, MIN_TOP)
  const newRight = right - (clientX - mouseX)
  container.current.style.top = "calc(" + newTop + "px)"
  container.current.style.right = "calc(" + newRight + "px)"
  return { top: newTop, right: newRight }
}

export const exitDragState = (setDragging, dragSurface) => {
  setDragging(undefined)
  dragSurface.current.style.display = "none"
}

export const initResize = (e, setResize, container, resizeSurface, onTop) => {
  const mouseX = e.clientX
  const mouseY = e.clientY
  const { top, left, height } = container.current.getBoundingClientRect()
  setResize({ mouseX, mouseY, top, left, height, onTop })
  resizeSurface.current.style.display = "block"
  resizeSurface.current.style.cursor = "ns-resize"
}

export const updateBoxPositionOnResize = (e, resizing, container, minHeight = MIN_HEIGHT) => {
  const { clientY } = e
  const { mouseY, height, top, onTop } = resizing
  if (!onTop) {
    const newHeight = Math.max(height + clientY - mouseY, minHeight)
    container.current.style.height = "calc(" + newHeight + "px)"
  }
  if (onTop) {
    const newTop = Math.min(Math.max(top + clientY - mouseY, MIN_TOP), top + (height - minHeight))
    const newHeight = height + top - newTop
    container.current.style.top = "calc(" + newTop + "px)"
    container.current.style.height = "calc(" + newHeight + "px)"
  }
}

export const exitResizeState = (setResizing, dragSurface) => {
  setResizing(undefined)
  dragSurface.current.style.display = "none"
}
