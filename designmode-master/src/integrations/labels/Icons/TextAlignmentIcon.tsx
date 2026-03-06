import type { TextAlign } from "src/integrations/labels/constants"

export const TextAlignmentIcon = ({ textAlign }: { textAlign: TextAlign }) => {
  switch (textAlign) {
    case "start":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M2 3.02002H13V4.02002H2V3.02002ZM2 7.02002H9V8.02002H2V7.02002ZM11 11.02H2V12.02H11V11.02Z"
            fill="#808080"
          />
        </svg>
      )
    case "center":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M2 3.02002H13V4.02002H2V3.02002ZM4 7.02002H11V8.02002H4V7.02002ZM12 11.02H3V12.02H12V11.02Z"
            fill="#808080"
          />
        </svg>
      )
    case "end":
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M2 3.02002H13V4.02002H2V3.02002ZM6 7.02002H13V8.02002H6V7.02002ZM13 11.02H4V12.02H13V11.02Z"
            fill="#808080"
          />
        </svg>
      )
  }
}
