import styles from "./EditIn3DSketch.module.pcss"
import useEditIn3DSketch from "src/integrations/3dsketch/useEditIn3DSketch"
import { useTranslator } from "src/i18n"

import toolTipImage3DSketch from "src/integrations/building-systems-site-study/toolbar/tooltips/edit-in-3d-sketch.gif"
import Sketch3DIcon from "src/integrations/wsm-tools/assets/Sketch3DIcon"

const EditMeshButton = () => {
  const t = useTranslator()
  const handleOnClick = useEditIn3DSketch("right_panel")

  return (
    <div className={`${styles.EditIn3DSketchButtonContainer}`}>
      <weave-button type="button" id="edit-in-3d-sketch" style={{ width: "100%" }} onClick={() => handleOnClick()}>
        <div slot="icon">
          <Sketch3DIcon width={16} height={16} />
        </div>
        <span className={`${styles.EditIn3DSketchButtonText}`}>{t(($) => $.wsm.actions.editIn)}</span>
      </weave-button>
      <forma-expanded-tooltip
        target-id="edit-in-3d-sketch"
        text="3D Sketch"
        position="bottom"
        componentPosition="center"
        loadingduration={300}
      >
        <div>
          <img src={toolTipImage3DSketch} alt="3D Sketch" height="110" width="196" loading="lazy" />
          <p>{t(($) => $.wsm.tooltips.editIn)}</p>
        </div>
      </forma-expanded-tooltip>
    </div>
  )
}

export default EditMeshButton
