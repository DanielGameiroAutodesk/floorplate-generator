export const icons = {
  angle: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2 10.5V11H2.5H11V10H7.97758C7.7398 7.36143 5.63857 5.2602 3 5.02242L3 2H2V10.5ZM3 6.02746L3 10H6.97254C6.74196 7.91419 5.08581 6.25804 3 6.02746Z"
        fill="currentColor"
      />
    </svg>
  ),

  stories: (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 1H1V3H9V1ZM1 0C0.447715 0 0 0.447715 0 1V3C0 3.55228 0.447715 4 1 4H9C9.55229 4 10 3.55228 10 3V1C10 0.447715 9.55228 0 9 0H1ZM9 6H1V8H9V6ZM1 5C0.447715 5 0 5.44772 0 6V8C0 8.55228 0.447715 9 1 9H9C9.55229 9 10 8.55228 10 8V6C10 5.44772 9.55228 5 9 5H1ZM1 11H9V13H1V11ZM0 11C0 10.4477 0.447715 10 1 10H9C9.55228 10 10 10.4477 10 11V13C10 13.5523 9.55229 14 9 14H1C0.447715 14 0 13.5523 0 13V11Z"
        fill="#808080"
      />
    </svg>
  ),
  gableRoof: (enabled: boolean) => {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          opacity="0.8"
          d="M13.5015 10.0039L13.5015 13.5039L2.50146 13.5039L2.50146 10.0039"
          stroke={enabled ? "#0696D7" : "#808080"}
        />
        <path d="M2 7.00403L8 2L14 7.00403V9.00403L8 4L2 9.00403V7.00403Z" fill={enabled ? "#0696D7" : "#808080"} />
      </svg>
    )
  },
  flatRoof: (enabled: boolean) => {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          opacity="0.8"
          d="M13.4985 7L13.4985 13.504L2.49854 13.504L2.49854 7"
          stroke={enabled ? "#0696D7" : "#808080"}
        />
        <rect x="14" y="6" width="12" height="2" transform="rotate(-180 14 6)" fill={enabled ? "#0696D7" : "#808080"} />
      </svg>
    )
  },
  shedRoof: (enabled: boolean) => {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          opacity="0.8"
          d="M13.5015 5.00391L13.5015 13.5039L2.50146 13.5039L2.50146 9.99988"
          stroke={enabled ? "#0696D7" : "#808080"}
        />
        <path d="M2 7.49988L14 2.00391V4.00391L2 9.49988V7.49988Z" fill={enabled ? "#0696D7" : "#808080"} />
      </svg>
    )
  },

  bufferX: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 2H7V14H8V2ZM4 13H3V11H4L4 13ZM4 9H3V7H4L4 9ZM3 5H4L4 3L3 3V5ZM12 13H11V11H12V13ZM12 9H11V7H12L12 9ZM11 5H12V3L11 3V5Z"
        fill="#808080"
      />
    </svg>
  ),

  bufferY: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2 8L2 9L14 9L14 8L2 8ZM13 12L13 13L11 13L11 12L13 12ZM9 12L9 13L7 13L7 12L9 12ZM5 13L5 12L3 12L3 13L5 13ZM13 4L13 5L11 5L11 4L13 4ZM9 4L9 5L7 5L7 4L9 4ZM5 5L5 4L3 4L3 5L5 5Z"
        fill="#808080"
      />
    </svg>
  ),
}
