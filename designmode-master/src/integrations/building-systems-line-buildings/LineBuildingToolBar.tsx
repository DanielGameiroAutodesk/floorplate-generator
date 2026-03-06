import { useRecoilState, useResetRecoilState } from "recoil"
import { lineBuildingActiveToolAtom } from "./quickDrawState"
import { useEffect } from "preact/compat"
import { useErrorBoundary } from "preact/hooks"
import { captureException } from "@sentry/browser"
import ToolbarButton, { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { exitCurrentTool } from "src/core/toolsState"
import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"
import { getTranslator } from "src/i18n"

const AddSectionIcon = () => {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.6907 1H14.8636H15.5H16.0833H16.2683L16.4087 1.12037L22.8254 6.62037L23 6.77003V7V12V12.243L22.8089 12.3932L17.5589 16.5182C17.3418 16.6888 17.0274 16.651 16.8568 16.4339C16.6862 16.2168 16.724 15.9024 16.9411 15.7318L22 11.757V8.02873L17.4495 11.6041L17.3385 11.6914C17.1213 11.862 16.807 11.8243 16.6364 11.6071C16.4658 11.39 16.5035 11.0757 16.7206 10.9051L16.8317 10.8178L21.7121 6.98319L15.8984 2H15.5H15.0366L10.3998 5.64316C10.1827 5.81377 9.86836 5.77605 9.69775 5.55891C9.52714 5.34177 9.56486 5.02745 9.782 4.85684L14.5547 1.10684L14.6907 1ZM7.35197 7.40203C7.52257 7.61916 7.48485 7.93349 7.26772 8.1041L2.2879 12.0168L8.5138 17.3533L10.8161 15.5443L12.1286 14.5131L12.7848 13.9975L13.113 13.7397L13.277 13.6107C13.4942 13.4401 13.8085 13.4779 13.9791 13.695C14.1497 13.9121 14.112 14.2265 13.8948 14.3971L13.7308 14.526L13.4027 14.7838L12.7464 15.2994L11.4339 16.3307L9 18.243V21.9713L13.6002 18.3568C13.8173 18.1862 14.1316 18.224 14.3022 18.4411C14.4729 18.6582 14.4351 18.9726 14.218 19.1432L9.44527 22.8932L9.3093 23H9.13636H8.5H7.91667H7.7317L7.59127 22.8796L1.1746 17.3796L1 17.23V17V12V11.757L1.19109 11.6068L6.6499 7.31778C6.86703 7.14717 7.18136 7.18489 7.35197 7.40203ZM8 21.9129V18.23L2 13.0871V16.77L8 21.9129Z"
        fill={"currentColor"}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.33913 6.36211C8.51884 6.15245 8.83449 6.12817 9.04415 6.30788L10.3567 7.43288C10.5663 7.61259 10.5906 7.92824 10.4109 8.1379C10.2312 8.34757 9.91553 8.37185 9.70586 8.19214L8.39336 7.06714C8.1837 6.88743 8.15942 6.57178 8.33913 6.36211ZM11.1829 8.79961C11.3626 8.58995 11.6782 8.56567 11.8879 8.74538L13.2004 9.87038C13.4101 10.0501 13.4343 10.3657 13.2546 10.5754C13.0749 10.7851 12.7593 10.8093 12.5496 10.6296L11.2371 9.50464C11.0275 9.32493 11.0032 9.00928 11.1829 8.79961ZM14.0266 11.2371C14.2063 11.0275 14.522 11.0032 14.7317 11.1829L15.7381 12.0456C15.9043 12.188 16 12.396 16 12.615V13.75C16 14.0262 15.7762 14.25 15.5 14.25C15.2239 14.25 15 14.0262 15 13.75V12.73L14.0809 11.9421C13.8712 11.7624 13.8469 11.4468 14.0266 11.2371ZM15.5 15.125C15.7762 15.125 16 15.3489 16 15.625V17.5C16 17.7762 15.7762 18 15.5 18C15.2239 18 15 17.7762 15 17.5V15.625C15 15.3489 15.2239 15.125 15.5 15.125Z"
        fill={"currentColor"}
      />
    </svg>
  )
}
const SectionedLineBuildingToolBar = () => {
  const [activeToolLineBuildingTool, setActiveLineBuildingTool] = useRecoilState(lineBuildingActiveToolAtom)
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "s")
        setActiveLineBuildingTool((currVal) => (currVal === "addSectionCut" ? undefined : "addSectionCut"))
    }
    document.addEventListener("keydown", keydown)
    return () => {
      document.removeEventListener("keydown", keydown)
      setActiveLineBuildingTool(undefined)
    }
  }, [setActiveLineBuildingTool])

  return (
    <ToolbarButton
      icon={<AddSectionIcon />}
      active={activeToolLineBuildingTool === "addSectionCut"}
      label={(t) => t(($) => $.building.lineBuilding.addSectionCutButton)}
      shortCut={"s"}
      onClick={() => {
        setActiveLineBuildingTool((currVal) => (currVal === "addSectionCut" ? undefined : "addSectionCut"))
      }}
    />
  )
}

export const LineBuildingToolBar = () => {
  const resetLineBuildingTool = useResetRecoilState(lineBuildingActiveToolAtom)
  useErrorBoundary((error, errorInfo) => {
    console.error("Line Building toolbar error: ", error)
    console.warn(errorInfo)
    const t = getTranslator()
    window.forma_toasts.push({
      content: t(($) => $.errors.lineBuilding.failedToolbarAction),
      status: "warning",
    })
    captureException(error, { tags: { owner: "squad-composition" }, extra: { errorInfo } })
    resetLineBuildingTool()
    exitCurrentTool()
  })
  return (
    <>
      <SectionedLineBuildingToolBar />
      <FormaToolbarDivider direction="vertical" />
      <ToolbarCloseButton />
    </>
  )
}
