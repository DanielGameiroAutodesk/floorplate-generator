import { icons } from "src/integrations/building-systems-line-buildings/LineBuildingMenu/icons"

////
// Header
///

const HeaderBoxStyle = `
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const HeaderTitle = `
  font-family: Artifakt Element, sans-serif;
  font-style: normal;
  font-weight: 600;
  font-size: 12px;
  line-height: 16px;
  color: #3C3C3C;
`

const HeaderRemoveIconStyle = `
  cursor: pointer;
  height: 16px;
  width: 16px;
`

export const TilePopupHeader = ({ close, title }: { close: () => void; title: string }) => {
  return (
    <div style={HeaderBoxStyle}>
      <div style={HeaderTitle}>{title}</div>
      <div style={HeaderRemoveIconStyle} onClick={close}>
        {icons.removeFeature}
      </div>
    </div>
  )
}
