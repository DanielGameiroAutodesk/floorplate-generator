import { useMemo } from "preact/compat"

export default function FlatRoof_16(props: { selected?: boolean } & JSX.HTMLAttributes<SVGSVGElement>) {
  const color = useMemo(() => (props.selected ? "#0696D7" : "#808080"), [props.selected])

  return (
    <svg {...props} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.6" d="M13.5 4L13.5 13.5L2.5 13.5L2.5 4" stroke={color} fillOpacity={0} />
      <rect x="2" y="3" width="12" height="1" fill={color} strokeOpacity={0} />
    </svg>
  )
}
