import { useMemo } from "preact/compat"

export default function GableRoof_16(props: { selected?: boolean } & JSX.HTMLAttributes<SVGSVGElement>) {
  const color = useMemo(() => (props.selected ? "#0696D7" : "#808080"), [props.selected])

  return (
    <svg {...props} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.6" d="M13.5015 6L13.5015 13.5L2.50146 13.5L2.50146 6" stroke={color} fillOpacity={0} />
      <path d="M1 7L8 2L15 7" stroke={color} fillOpacity={0} />
    </svg>
  )
}
