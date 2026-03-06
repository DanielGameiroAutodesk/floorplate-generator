import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import styles from "./Label.module.pcss"
import type { InternalPath } from "src/lib/element/path"
import { newRevision, replaceRevision } from "src/lib/element/urn"
import { getCurrentUserId } from "src/lib/userInfo"
import { colors, calculateBlackOrWhiteContrast } from "src/lib/colors"
import { ANNOTATION_LABEL_PROPERTY_NAME, type AnnotationLabelProperties } from "src/integrations/labels/constants"
import { ANNOTATION_LABEL_DEFAULTS, MAX_LINES, PREVIEW_LABEL_PATH } from "src/integrations/labels/constants"
import combineClasses from "src/lib/combineClasses"
import LeadingLine from "./LeadingLine/LeadingLine"
import { MOUSE } from "three"
import { elementState } from "src/core/elements/ElementState"
import { scenarioModeSignal } from "src/core/selection/selectionState"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { enterEditBase } from "src/core/useEnterEditBase"
import { useTranslator } from "src/i18n"

const TEXTAREA_MAX_WIDTH = 150

function floatToPaddedHex(float: number) {
  return Math.round(float * 255)
    .toString(16)
    .padStart(2, "0")
}

export default function LabelContent({
  highlighted,
  selected,
  path,
  isInBase,
  styleOverrides,
  scale,
  onComplete,
  onCancel,
}: {
  highlighted: boolean
  selected: boolean
  path: InternalPath
  isInBase?: boolean
  styleOverrides?: Partial<AnnotationLabelProperties>
  scale?: number
  onComplete?: (text: string, labelOffset: { x: number; y: number }) => void
  onCancel?: () => void
}) {
  const t = useTranslator()
  const ActionAPI = useActionAPI()
  const isEditingBase = scenarioModeSignal.value
  const canEditProposal = canEditProposalSignal.value

  const element = elementState.currentSnapshot.value.getNode(path)?.element

  const disableEditing = useMemo(() => {
    const disableBaseEditing = isInBase && !isEditingBase
    const disableProposalEditing = !isInBase && isEditingBase

    const userCanEditProposal = canEditProposal

    return disableBaseEditing || disableProposalEditing || !userCanEditProposal
  }, [canEditProposal, isEditingBase, isInBase])

  const {
    text: initialText,
    color,
    textAlign,
    opacity,
  } = element?.properties?.[ANNOTATION_LABEL_PROPERTY_NAME] || ANNOTATION_LABEL_DEFAULTS
  const persistedOffset =
    element?.properties?.[ANNOTATION_LABEL_PROPERTY_NAME]?.labelOffset ?? ANNOTATION_LABEL_DEFAULTS.labelOffset

  const [offset, setOffset] = useState<{ x: number; y: number }>(persistedOffset)
  const [currentText, setCurrentText] = useState<string>(initialText)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const cloneRef = useRef<HTMLTextAreaElement>(null)

  const updateText = useCallback(
    (text: string) => {
      if (!element) return
      if (text !== initialText && text.trim().length === 0) {
        const deleteAction = ActionAPI.delete.one(path)
        ActionAPI.apply("Label: delete, empty text", deleteAction)
      } else if (text !== initialText) {
        const updateAction = ActionAPI.update.one(
          path,
          {
            ...element,
            urn: replaceRevision(element.urn, newRevision()),
            properties: {
              ...element?.properties,
              [ANNOTATION_LABEL_PROPERTY_NAME]: {
                ...element?.properties?.[ANNOTATION_LABEL_PROPERTY_NAME],
                text,
                editedAt: Date.now(),
                author: getCurrentUserId(),
              },
            },
          },
          false,
        )
        ActionAPI.apply("Label: update text", updateAction)
      }
    },
    [element, initialText, ActionAPI, path],
  )

  const updateOffset = useCallback(
    (offset: { x: number; y: number }) => {
      if (!element) return
      const updateAction = ActionAPI.update.one(
        path,
        {
          ...element,
          urn: replaceRevision(element.urn, newRevision()),
          properties: {
            ...element?.properties,
            [ANNOTATION_LABEL_PROPERTY_NAME]: {
              ...element?.properties?.[ANNOTATION_LABEL_PROPERTY_NAME],
              labelOffset: offset,
            },
          },
        },
        false,
      )
      ActionAPI.apply("Label: update offset", updateAction)
    },
    [element, ActionAPI, path],
  )

  const onSubmit = useCallback(() => {
    if (onComplete) onComplete(currentText, offset)
    else updateText(currentText)
    setIsEditing(false)
  }, [onComplete, currentText, offset, updateText])

  const [isEditing, setIsEditing] = useState(onComplete !== undefined)
  useEffect(() => {
    if (!isEditing) return
    const textAreaElement = inputRef.current
    if (!textAreaElement) return
    textAreaElement.select()
    textAreaElement.selectionStart = textAreaElement.selectionEnd
  }, [isEditing])

  const backgroundColor = styleOverrides?.color ?? color
  const backgroundColorWithOpacity = `${backgroundColor}${floatToPaddedHex(opacity)}`

  const borderStyles = getBorderStyles({
    isEditing,
    selected,
    highlighted,
    isInBase,
    backgroundColor: backgroundColorWithOpacity,
  })

  useLayoutEffect(() => {
    if (!inputRef.current || !cloneRef.current) return
    inputRef.current.style.height = `${cloneRef.current.scrollHeight}px`
  }, [currentText, isEditing])

  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!dragStartPos) return
    const onMouseMove = (e: MouseEvent) => {
      setOffset({ x: e.clientX - dragStartPos.x, y: e.clientY - dragStartPos.y })
    }
    const onMouseUp = () => {
      setDragStartPos(null)
      const offsetDistance = Math.sqrt(
        Math.pow(offset.x - persistedOffset.x, 2) + Math.pow(offset.y - persistedOffset.y, 2),
      )
      if (offsetDistance > 1) {
        updateOffset(offset)
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDragStartPos(null)
        setOffset(persistedOffset)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [dragStartPos, offset, persistedOffset, updateOffset])

  /* Adjust label position slightly up when having two lines and creating a new label. */
  const adjustDefaultOffset = useCallback((e: JSX.TargetedEvent<HTMLTextAreaElement>) => {
    const { labelOffset } = ANNOTATION_LABEL_DEFAULTS
    if (e.currentTarget.scrollHeight > e.currentTarget.offsetHeight) {
      setOffset({ ...labelOffset, y: labelOffset.y - 15 })
    } else if (e.currentTarget.scrollHeight < e.currentTarget.offsetHeight) {
      setOffset(labelOffset)
    }
  }, [])

  const textColor = useMemo(() => calculateBlackOrWhiteContrast(backgroundColor), [backgroundColor])

  return (
    <div
      onMouseDown={(e) => {
        if (disableEditing) return
        if (e.button === MOUSE.RIGHT) return
        if (!selected) return
        setDragStartPos({
          x: e.clientX - persistedOffset.x,
          y: e.clientY - persistedOffset.y,
        })
      }}
      /* eslint-disable-next-line react/no-unknown-property */
      onDblClick={() => {
        if (isInBase && !scenarioModeSignal.value) {
          enterEditBase()
          return
        }
        if (disableEditing) return
        // unselect everything in textarea
        setIsEditing(true)
        setDragStartPos(null)
      }}
      className={styles.ContentWrapper}
      style={{
        transform: `translate(calc(-50% + ${offset.x}px), calc(${offset.y}px))`,
        cursor: dragStartPos ? "move" : "auto",
      }}
    >
      <LeadingLine labelOffset={offset} />
      <div
        className={combineClasses([styles.Content, ...(isEditing ? [styles.Editing] : [])])}
        style={{
          ...borderStyles,
          backgroundColor: backgroundColorWithOpacity,
          minWidth: `${path === PREVIEW_LABEL_PATH ? "50" : "0"}px`,
          ...(scale ? { transform: `scale(${scale})` } : {}),
        }}
      >
        {isEditing ? (
          <>
            <textarea
              className={combineClasses([styles.LabelTextArea, styles.Text, styles.AutoResizeClone])}
              ref={cloneRef}
              disabled
              tabIndex={-1}
              style={{
                width: `${TEXTAREA_MAX_WIDTH}px`,
                textAlign,
              }}
              rows={1}
              value={currentText}
            ></textarea>
            <textarea
              disabled={!selected}
              className={combineClasses([styles.LabelTextArea, styles.Text])}
              ref={inputRef}
              placeholder={t(($) => $.labels.placeholder)}
              onMouseDown={(e) => e.stopPropagation()}
              onBlur={() => {
                if (onCancel && !currentText.length) {
                  onCancel()
                  return
                }
                if (onComplete && currentText.length) {
                  onComplete(currentText, offset)
                  return
                } else {
                  onSubmit()
                }
              }}
              onKeyDownCapture={(e) => {
                if (e.key === "Escape") {
                  e.currentTarget.blur()
                }
              }}
              onKeyDown={(e) => {
                // Submit on enter
                // Shift + enter adds new line
                if (e.code === "Enter" && !e.shiftKey) {
                  onSubmit()
                }
                e.stopPropagation()
              }}
              onChange={(e) => {
                if (inputRef.current && cloneRef.current) {
                  cloneRef.current.value = e.currentTarget.value
                  const nextHeight = cloneRef.current.scrollHeight
                  const maxHeight = MAX_LINES * (cloneRef.current.offsetHeight + 1)

                  if (onComplete) adjustDefaultOffset(e)

                  if (nextHeight > maxHeight) {
                    e.currentTarget.value = currentText
                    return
                  }
                  inputRef.current.style.height = `${nextHeight}px`
                }
                setCurrentText(e.currentTarget.value)
              }}
              value={currentText}
              style={{
                width: `${TEXTAREA_MAX_WIDTH}px`,
                textAlign,
              }}
            >
              {currentText}
            </textarea>
          </>
        ) : (
          <div className={styles.Text} style={{ textAlign, color: textColor }}>
            {currentText}
          </div>
        )}
      </div>
    </div>
  )
}

function getBorderStyles({
  isEditing,
  selected,
  highlighted,
  isInBase,
  backgroundColor,
}: {
  isEditing: boolean
  selected: boolean
  highlighted: boolean
  isInBase?: boolean
  backgroundColor?: string
}) {
  let color = backgroundColor ?? ANNOTATION_LABEL_DEFAULTS.color
  let size = 1

  if (!isEditing && (selected || highlighted)) color = isInBase ? colors.scenarioPurple : colors.borderAccent
  if (!isEditing && highlighted) size = 2

  return { margin: `${1 - size}px 0`, border: `${size}px solid ${color}` }
}
