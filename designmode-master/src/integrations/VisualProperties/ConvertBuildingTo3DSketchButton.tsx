import { useTranslator } from "src/i18n"
import styles from "./ConvertBuildingTo3DSketchButton.module.pcss"

import toolTipImageConvertTo3DSketch from "src/integrations/building-systems-site-study/toolbar/tooltips/convert-to-3d-sketch.gif"

import useEditIn3DSketch from "src/integrations/3dsketch/useEditIn3DSketch"
import Sketch3DIcon from "src/integrations/wsm-tools/assets/Sketch3DIcon"

const EditBuildingIn3DSketchButton = () => {
  const t = useTranslator()
  const editIn3dSketch = useEditIn3DSketch("right_panel")

  return (
    <div className={styles.Wrapper}>
      <div id="edit-building-in-3d-sketch" className={styles.Button} onClick={() => editIn3dSketch()}>
        <Sketch3DIcon width={16} height={16} showEditArrow={true} />
      </div>
      <forma-expanded-tooltip
        target-id="edit-building-in-3d-sketch"
        text={t(($) => $.wsm.convert.title)}
        position="left"
        componentPosition="center"
        loadingduration={0}
      >
        <div>
          <img src={toolTipImageConvertTo3DSketch} alt="" height="110" width="196" loading="lazy" />
          <p className={styles.ToolTip_Message}>{t(($) => $.wsm.convert.message)}</p>
        </div>
      </forma-expanded-tooltip>
    </div>
  )
}

export default EditBuildingIn3DSketchButton
