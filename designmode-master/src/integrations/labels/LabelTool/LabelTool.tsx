import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { drawApi } from "src/integrations/draw/DrawAPI"
import { useCallback, useEffect, useMemo } from "preact/hooks"
import type { Vec3 } from "src/lib/geometry/geometryTypes"
import { Matrix4, Vector3 } from "three"
import { createUrn, newId, newRevision } from "src/lib/element/urn"
import LabelWrapper from "src/integrations/labels/Label/LabelWrapper"
import { getCurrentUserId } from "src/lib/userInfo"
import {
  ANNOTATION_LABEL_CATEGORY,
  ANNOTATION_LABEL_DEFAULTS,
  ANNOTATION_LABEL_PROPERTY_NAME,
  type AnnotationLabelProperties,
  PREVIEW_LABEL_PATH,
} from "src/integrations/labels/constants"
import { useTranslator } from "src/i18n"
import { atom, useRecoilState } from "recoil"
import { Handle } from "src/integrations/tools-common/VertexHandle/Handle"
import LabelPropertiesView from "src/integrations/labels/PropertyPanel/LabelPropertiesView"
import styles from "./LabelTool.module.pcss"
import { defaultCursor } from "src/integrations/cursors/setCursor"
import { LabelToolbarActive } from "./LabelToolbar"
import { PROJECT_ID } from "src/core/project/project"
import { scenarioModeSignal, setSelectionSignalValue } from "src/core/selection/selectionState"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import { batch } from "@preact/signals"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

/*
 Defining a global variable to store the last position of the note.
 Reason being that using a useState variable is reset to the inital state every time
 the AnnotationButton is rendered (when the tool is active/unactive)
 **/
let previewPosition: Vec3 | null = null

const previewStylesState = atom<AnnotationLabelProperties>({
  key: "preview-label-styles",
  default: ANNOTATION_LABEL_DEFAULTS,
})

function LabelPreviewDummy({ point }: { point: { x: number; y: number; z: number } }) {
  const pointAsVector = useMemo(() => new Vector3(point.x, point.y, point.z), [point])

  return (
    <div style={{ opacity: 0.5 }}>
      <LabelWrapper path={PREVIEW_LABEL_PATH} previewPosition={pointAsVector} />
      <Handle position={pointAsVector} />
    </div>
  )
}

export default function LabelTool() {
  const ActionAPI = useActionAPI()
  const isEditingBase = scenarioModeSignal.value

  const [previewStyles, setPreviewStyles] = useRecoilState(previewStylesState)

  const ToolPropertyPanel = useCallback(
    function ToolPropertyPanel() {
      const t = useTranslator()
      return (
        <>
          <div className={styles.Header}>{t(($) => $.labels.label)}</div>
          <LabelPropertiesView
            value={{ ...previewStyles, opacity: previewStyles.opacity * 100 }}
            onChangeStyle={(changeProperties: Partial<AnnotationLabelProperties>) =>
              setPreviewStyles({ ...previewStyles, ...changeProperties })
            }
          />
        </>
      )
    },
    [previewStyles, setPreviewStyles],
  )

  const toolConfig = useMemo(
    () => ({
      ...labelToolConfigBase,
      propertyPanel: ToolPropertyPanel,
    }),
    [ToolPropertyPanel],
  )

  const cancelPlacing = useCallback(() => {
    exitCurrentTool()
    defaultCursor()
  }, [])

  const setPreviewPoint = useCallback(
    (point?: Vec3) => {
      if (!point) {
        return cancelPlacing()
      }
      previewPosition = point
      batch(() => {
        setSelectionSignalValue([PREVIEW_LABEL_PATH])
        toolAPI.setTool(toolConfig)
      })
      defaultCursor()
    },
    [cancelPlacing, toolConfig],
  )

  const persistNote = useCallback(
    (text: string, labelOffset: { x: number; y: number }) => {
      if (!previewPosition) return
      if (!text.length) return

      const action = ActionAPI.add.one(
        {
          urn: createUrn("integrate", PROJECT_ID, newId(), newRevision()),
          properties: {
            category: ANNOTATION_LABEL_CATEGORY,
            virtual: true,
            [ANNOTATION_LABEL_PROPERTY_NAME]: {
              editedAt: Date.now(),
              author: getCurrentUserId(),
              ...previewStyles,
              text,
              labelOffset,
            },
          },
        },
        false,
        {
          child: {
            transform: new Matrix4().makeTranslation(previewPosition.x, previewPosition.y, previewPosition.z).toArray(),
            key: newId(),
          },
        },
      )
      batch(() => {
        ActionAPI.apply("Label: create", action)
        Analytics.trackAddElement(
          EventName.Add,
          { feature_category: FeatureCategory.DesignTool, feature: "add_label", object_type: "element" },
          { category: "annotation_label", shape_type: "line" },
        )
        setSelectionSignalValue([ActionAPI.utils.getPathOfAction(action.filter((a) => a.type === "add")[0])])
        exitCurrentTool()
      })
      previewPosition = null
    },
    [ActionAPI, previewStyles],
  )

  const startPlacingLabel = useCallback(
    () => drawApi.getPoint(setPreviewPoint, LabelToolbarActive, LabelPreviewDummy),
    [setPreviewPoint],
  )

  useEffect(() => {
    if (!previewPosition) startPlacingLabel()
  }, [startPlacingLabel])

  return previewPosition ? (
    <LabelWrapper
      path={PREVIEW_LABEL_PATH}
      onComplete={persistNote}
      onCancel={() => {
        exitCurrentTool()
        previewPosition = null
      }}
      previewPosition={previewPosition}
      isInBase={isEditingBase}
      styleOverrides={{ color: previewStyles.color, opacity: previewStyles.opacity }}
    />
  ) : null
}

export const labelToolConfigBase = {
  id: "annotation-label",
  tool: LabelTool,
  toolbar: "topLevel" as const,
}
