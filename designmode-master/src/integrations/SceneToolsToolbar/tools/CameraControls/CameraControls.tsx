import { Suspense } from "react"
import styles from "src/integrations/SceneToolsToolbar/SceneToolsToolbar.module.pcss"
import { useState } from "preact/hooks"
import { ClickOutside } from "src/lib/components/ClickOutside2"
import cameraControlsStyle from "./CameraControlsMenu.module.pcss"
import { CornerChevron } from "src/integrations/SceneToolsToolbar/tools/VisibilityMenu/VisibilityMenuAssets"
import { SectionBoxTool } from "src/integrations/section-box/SectionBoxTool"
import { useLookFromTool } from "./LookFromTool"
import useZoomFitTool from "./ZoomToFit"
import { useLookAtTool } from "./LookAtTool"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import { useTranslator } from "src/i18n"

const CameraOptionsIcon = () => {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 7V5V4H5H7V5H5V7H4ZM20 19V17H19V19H17V20H19H20V19ZM5 20H7V19H5V17H4V19V20H5ZM19 4H17V5H19V7H20V5V4H19ZM14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12ZM15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z"
        fill="currentColor"
      />
    </svg>
  )
}

const LookAtIcon = () => {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.4981 9.73294V4.04549C11.4981 3.87356 11.5936 3.71584 11.7459 3.63609C11.9025 3.55411 12.0921 3.56862 12.2344 3.67345L20.0931 9.46396C20.3489 9.65245 20.4999 9.95128 20.4999 10.269V15.9592C20.4999 16.1296 20.4056 16.2861 20.2548 16.3656C20.099 16.4478 19.9099 16.4336 19.768 16.3291L11.9051 10.5381C11.6492 10.3497 11.4981 10.0508 11.4981 9.73294Z"
        stroke="#808080"
      />
      <path
        d="M3.89001 20.27L11.5 4M3.89001 20.27L20 10M3.89001 20.27L20 16.43M3.89001 20.27L11.5 10"
        stroke="#808080"
      />
      <g opacity="0.2">
        <mask
          id="mask0_842_41288"
          style="mask-type:alpha"
          maskUnits="userSpaceOnUse"
          x="11"
          y="3"
          width="10"
          height="14"
        >
          <path
            d="M11.5 9.5V4.68256C11.5 4.5625 11.528 4.4441 11.5816 4.33671C11.7987 3.90253 12.3575 3.77338 12.7431 4.06825L20.1075 9.69981C20.3549 9.88902 20.5 10.1827 20.5 10.4942V15.441C20.5 15.9275 19.988 16.244 19.5528 16.0264C19.5177 16.0088 19.4842 15.9881 19.4528 15.9646L11.9 10.3C11.6482 10.1111 11.5 9.81476 11.5 9.5Z"
            fill="#D9D9D9"
            stroke="black"
          />
        </mask>
        <g mask="url(#mask0_842_41288)">
          <line x1="4.93935" y1="11.7071" x2="16.9602" y2="-0.313707" stroke="#808080" />
          <line x1="6.3536" y1="13.1213" x2="18.3744" y2="1.10051" stroke="#808080" />
          <line x1="7.76778" y1="14.5355" x2="19.7886" y2="2.51472" stroke="#808080" />
          <line x1="9.18197" y1="15.9497" x2="21.2028" y2="3.92893" stroke="#808080" />
          <line x1="10.5962" y1="17.364" x2="22.617" y2="5.34315" stroke="#808080" />
          <line x1="12.0104" y1="18.7782" x2="24.0312" y2="6.75736" stroke="#808080" />
          <line x1="13.4246" y1="20.1924" x2="25.4455" y2="8.17158" stroke="#808080" />
          <line x1="14.8388" y1="21.6066" x2="26.8596" y2="9.58579" stroke="#808080" />
        </g>
      </g>
    </svg>
  )
}

const LookFromIcon = () => {
  return (
    <svg width="16" height="17" viewBox="-1 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.6546 0.517212L10.2508 2.41989L10.7387 3.29277L14.1425 1.39009L13.6546 0.517212ZM8.0807 3.54042L0.286204 8.11681L-0.453247 8.55096L0.288797 8.98067L8.08329 13.4944L8.58442 12.629L8.00714 12.2947C8.95287 11.3497 9.53549 9.96199 9.53549 8.43756C9.53549 6.96696 8.99373 5.62516 8.10773 4.68417L8.58701 4.40277L8.0807 3.54042ZM7.21682 5.20725L6.95288 5.36222C6.28995 6.14713 5.87502 7.23162 5.87502 8.43756C5.87502 9.75919 6.37316 10.9341 7.14949 11.7294C7.58687 11.339 7.9482 10.8246 8.19215 10.2257C7.97811 10.0235 7.80035 9.77093 7.67208 9.48346C7.52753 9.1595 7.44582 8.79122 7.44582 8.40064C7.44582 8.0573 7.50896 7.73119 7.62243 7.43727C7.74864 7.11033 7.93711 6.82323 8.1702 6.59658C7.9398 6.05104 7.61138 5.57763 7.21682 5.20725ZM1.53197 8.545L5.97128 5.93855C5.59172 6.67077 5.37502 7.52659 5.37502 8.43756C5.37502 9.4603 5.64827 10.4139 6.11867 11.2011L1.53197 8.545ZM14.1425 15.6156L10.7387 13.7129L10.2507 14.5858L13.6545 16.4884L14.1425 15.6156Z"
        fill="currentColor"
      />
    </svg>
  )
}

const ZoomToFitIcon = () => {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1 4V2V1H2H4V2H2V4H1ZM15 14V12H14V14H12V15H14H15V14ZM2 15H4V14H2V12H1V14V15H2ZM14 1H12V2H14V4H15V2V1H14ZM10 8C10 9.10457 9.10457 10 8 10C6.89543 10 6 9.10457 6 8C6 6.89543 6.89543 6 8 6C9.10457 6 10 6.89543 10 8ZM11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8Z"
        fill="currentColor"
      />
    </svg>
  )
}

export const CameraControls = () => {
  const t = useTranslator()
  const [open, setOpen] = useState(false)
  const lookAtExecute = useLookAtTool()
  const lookFromExecute = useLookFromTool()
  const zoomToFit = useZoomFitTool()

  const isPerspective = cameraApi.getCameraSettings().type === "perspective"

  return (
    <Suspense fallback={null}>
      <weave-tooltip text={!open ? t(($) => $.camera.optionsLabel) : ""}>
        <button
          onClick={() => setOpen((isOpen) => !isOpen)}
          className={styles.SceneToolsButton}
          id={"camera-controls-button"}
        >
          <CameraOptionsIcon />
          <CornerChevron />
        </button>
      </weave-tooltip>

      <ClickOutside onClickOutside={() => open && setOpen(false)}>
        <weave-floating
          target="camera-controls-button"
          placement="top"
          className={cameraControlsStyle.Menu}
          data-open={open}
        >
          <div className={cameraControlsStyle.ControlsHeader}>
            <p className={cameraControlsStyle.MenuTitle}>{t(($) => $.camera.optionsTitle)}</p>

            {isPerspective && (
              <weave-tooltip
                text={t(($) => $.tooltips.camera.lookAt)}
                nub="down-right"
                shortcutmac="⌘E"
                shortcutwindows="Ctrl+E"
              >
                <button className={cameraControlsStyle.Button} onClick={lookAtExecute}>
                  <LookAtIcon />
                </button>
              </weave-tooltip>
            )}

            {isPerspective && (
              <weave-tooltip
                text={t(($) => $.camera.lookFrom.title)}
                nub="down-right"
                shortcutmac="⌘L"
                shortcutwindows="Ctrl+L"
              >
                <button className={cameraControlsStyle.Button} onClick={lookFromExecute}>
                  <LookFromIcon />
                </button>
              </weave-tooltip>
            )}

            <weave-tooltip
              text={t(($) => $.camera.zoom.toFitSelection)}
              nub="down-right"
              shortcutmac="⌘F"
              shortcutwindows="Ctrl+F"
            >
              <button className={cameraControlsStyle.Button} onClick={() => void zoomToFit()}>
                <ZoomToFitIcon />
              </button>
            </weave-tooltip>
          </div>
          <hr className={cameraControlsStyle.Divider} />
          <SectionBoxTool isOpen={open} />
        </weave-floating>
      </ClickOutside>
    </Suspense>
  )
}
