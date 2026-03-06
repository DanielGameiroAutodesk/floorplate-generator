import { Layouts } from "./Layouts"
import { ClampToTerrain, Decorations, ExploreParameters, Trees } from "./BuildingParameters"
import { useIsInSiteStudyTool } from "src/integrations/building-systems-site-study/SiteStudyToolState"
import Divider from "./Divider"
import { useTranslator } from "src/i18n"

const SiteStudyHeaderStyle = `
  height: 48px;
  display: flex;
  align-items: center;
  font-family: 'Artifakt Element';
  font-style: normal;
  font-weight: 700;
  font-size: 12px;
  line-height: 16px;

  color: var(--text-color-medium-default);
`

const SiteStudyHeader = () => {
  const t = useTranslator()
  return <div style={SiteStudyHeaderStyle}>{t(($) => $.automation.explore.headerTitle)}</div>
}

const SiteStudyMenu = () => {
  return (
    <>
      <SiteStudyHeader />
      <Decorations />
      <Divider />
      <ExploreParameters />
      <ClampToTerrain />
      <Divider />
      <Layouts />
      <Trees />
      <Divider />
    </>
  )
}

export const ExploreMenu = () => {
  const isInSiteStudyTool = useIsInSiteStudyTool()
  //const isInSiteStudyLibraryTool = useIsInSiteStudyLibraryTool()
  if (isInSiteStudyTool) return <SiteStudyMenu />
  //if (isInSiteStudyLibraryTool) return <SiteStudyLibraryMenu />
  return null
}
