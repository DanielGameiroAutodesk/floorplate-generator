import "@spacemakerai/adsk-formit-core-standalone"

import {
  moveCursor,
  moveHorizontalCursor,
  drawCursor,
  textEditCursor,
  invalidCursor,
  defaultCursor,
} from "src/integrations/cursors/setCursor"

// Implemented as a function because the namespace might not be loaded
// when the module loads (ie, FormIt.ToolType.WHATEVER might be 'undefined')
export const createToolCursorMap = () => ({
  [FormIt.ToolType.POLYLINE]: drawCursor,
  [FormIt.ToolType.RECTANGLE]: drawCursor,
  [FormIt.ToolType.CIRCLE]: drawCursor,
  [FormIt.ToolType.ARC]: drawCursor,
  [FormIt.ToolType.ARCCENTERRADIUS]: drawCursor,
  [FormIt.ToolType.SPLINE]: drawCursor,

  [FormIt.ToolType.TRANSLATION_IMPLICIT]: moveCursor,
  [FormIt.ToolType.TRANSLATION]: moveCursor,
  [FormIt.ToolType.SCALE_FACE]: moveCursor,
  [FormIt.ToolType.ROTATE_FACE]: moveCursor,
  [FormIt.ToolType.DRAG_FACE]: moveHorizontalCursor,
})

export const createCursorMap = () => ({
  [FormIt.UI.CursorType.kPickArrow]: defaultCursor,
  [FormIt.UI.CursorType.kForbidden]: invalidCursor,
  [FormIt.UI.CursorType.kTextEdit]: () => textEditCursor,
})
