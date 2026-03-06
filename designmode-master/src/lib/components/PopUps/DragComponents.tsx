export const DragSurfaceStyle = `
  position: fixed;
  display: none;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100vw;
  z-index: 10000;
`

export const DragSurface = (props: any) => {
  return <div style={DragSurfaceStyle} {...props} />
}
