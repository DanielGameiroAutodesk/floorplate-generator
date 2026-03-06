import { useMemo } from "preact/compat"

export default function ShedRoof_16(props: { selected?: boolean } & JSX.HTMLAttributes<SVGSVGElement>) {
  const color = useMemo(() => (props.selected ? "#0696D7" : "#808080"), [props.selected])

  return (
    <svg {...props} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        opacity="0.6"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14 2.53238L14 14L3.00003 14L3 6.51535L4 6.21483L4.00003 13L13 13L13 2.88167L14 2.53238Z"
        fill={color}
        strokeOpacity={0}
      />
      <path d="M1.48376 7L14.9999 2" stroke={color} fillOpacity={0} />
    </svg>
  )
}
