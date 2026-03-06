// A component that sets up a div that a seperate web component will use React Portal to render inside.
// For explanation of the Portal pattern: https://gist.github.com/nich-adsk/ea571104768e8b55eea3d2b2287c6d36

export interface PortalTargetProps {
  portalId: string
  style?: string
}

export function PortalTarget(props: PortalTargetProps) {
  return <div id={props.portalId} style={props.style} />
}
