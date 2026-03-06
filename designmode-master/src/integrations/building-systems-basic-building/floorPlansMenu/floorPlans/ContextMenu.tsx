const TransparentWallStyle = `
  position: fixed;
  background: transparent;
  width: 100vw;
  height: 100vh;
  top: 0;
  left: 0;
  cursor: auto;
`

const ContextMenuStyle = (top: number, right: number) => `
  position: fixed;
  z-index: 100000;
  width: 0;
  height: 0;
  top: ${top}px;
  right: ${right}px;
`
export const ContextMenuWrapper = (props: { top: number; right: number; close: () => void; children: any }) => {
  const { close, top, right } = props
  return (
    <div
      style={ContextMenuStyle(top, right)}
      onClick={(e) => {
        e.stopPropagation()
        close()
      }}
      onContextMenu={(e) => {
        e.stopPropagation()
        e.preventDefault()
        close()
      }}
    >
      <div
        style={TransparentWallStyle}
        onClick={(e) => {
          e.stopPropagation()
          close()
        }}
        onContextMenu={(e) => {
          e.stopPropagation()
          e.preventDefault()
          close()
        }}
      />
      <div style={"position: relative;"}> {props.children}</div>
    </div>
  )
}
