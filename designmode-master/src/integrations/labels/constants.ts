/**
 * The category value of annotation labels.
 */
export const ANNOTATION_LABEL_CATEGORY = "annotation_label"

/**
 * The property name on the element to hold label data.
 */
export const ANNOTATION_LABEL_PROPERTY_NAME = "annotation_label"

export const PREVIEW_LABEL_PATH = "PREVIEW_LABEL_PATH"

export type TextAlign = "start" | "center" | "end"
export type AnnotationLabelStyles = Pick<AnnotationLabelProperties, "color" | "opacity" | "textAlign">

export type AnnotationLabelProperties = {
  color: string
  textAlign: TextAlign
  text: string
  opacity: number
  /* Offset position of the text box from the 'anchor' position of the label
   * -x, -y is top left
   * +x, +y is bottom right
   *  */
  labelOffset: {
    x: number
    y: number
  }
}

export const ANNOTATION_LABEL_DEFAULTS: AnnotationLabelProperties = {
  color: "#222933",
  textAlign: "start",
  text: "",
  opacity: 1,
  labelOffset: {
    x: 0,
    y: -40,
  },
}

export const MAX_LINES = 5
