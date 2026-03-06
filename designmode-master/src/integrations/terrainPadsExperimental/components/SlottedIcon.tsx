type SlottedIconProps = {
  style?: React.CSSProperties
  icon: JSX.Element
}

export function SlottedIcon({ icon, style }: SlottedIconProps) {
  return (
    <span slot="icon" style={style}>
      {icon}
    </span>
  )
}
