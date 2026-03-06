/**
 * A divider component for the toolbar that can be either horizontal or vertical.
 *
 * @remarks
 * This component is not using the Weave component defined in teh design-system repo, because it does not support the `direction` attribute.
 * In the future, we need to change this to use the Weave component once it supports the `direction` attribute.
 *
 * @param props - The properties for the divider component.
 * @param props.direction - The direction of the divider, either "horizontal" or "vertical".
 *
 * @returns A `div` element styled as a horizontal or vertical divider.
 */
import type { JSX } from "preact/jsx-runtime"

interface DividerProps extends JSX.HTMLAttributes<HTMLDivElement> {
  direction: "horizontal" | "vertical"
}

const FormaToolbarDivider = ({ direction, ...props }: DividerProps) => {
  return (
    <div
      {...props}
      style={{
        display: "inline-block",
        borderTop:
          direction === "horizontal"
            ? "1px solid var(--colorScheme-divider-heavyweight, rgba(60, 60, 60, 0.25))"
            : "none",
        borderLeft:
          direction === "vertical"
            ? "1px solid var(--colorScheme-divider-heavyweight, rgba(60, 60, 60, 0.25))"
            : "none",
        margin: direction === "vertical" ? "10px" : "0 0 0 10px",
        height: direction === "vertical" ? "20px" : "",
        width: direction === "vertical" ? "" : "20px",
        ...(typeof props.style === "object" ? props.style : {}),
      }}
    />
  )
}

export default FormaToolbarDivider
