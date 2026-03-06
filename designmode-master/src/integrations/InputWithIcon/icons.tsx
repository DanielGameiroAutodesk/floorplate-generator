const icons: Record<string, JSX.Element> = {
  minus: (
    <svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M14 8.42822H2V7.42822H14V8.42822Z" fill="currentColor" />
    </svg>
  ),
  story_height: (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14 0L14 1L-4.37114e-08 1L0 -6.11959e-07L14 0ZM6.5 4.18208L5.34824 5.29997L4.65176 4.58239L6.65176 2.64121L7 2.30321L7.34824 2.64121L9.34824 4.58239L8.65176 5.29997L7.5 4.18208L7.5 11.7591L8.65176 10.6412L9.34824 11.3588L7.34824 13.3L7 13.638L6.65176 13.3L4.65176 11.3588L5.34824 10.6412L6.5 11.7591L6.5 4.18208ZM14 16L14 15L-6.55671e-07 15L-6.99382e-07 16L14 16Z"
        fill="#808080"
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
  align_center: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none">
      <path fill="#fff" d="M0 0h24v24H0z" />
      <path
        stroke="currentColor"
        d="M15.856 7h-1.481a1 1 0 0 0-1 1v7.625a1 1 0 0 0 1 1h3.79a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-2.309ZM7.39 7H5.907a1 1 0 0 0-1 1v7.625a1 1 0 0 0 1 1h3.79a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H7.389ZM1 11.813h22"
      />
    </svg>
  ),
  align_left: (
    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="24" fill="none">
      <path fill="#fff" d="M.5 0h24v24H.5z" />
      <path
        stroke="currentColor"
        d="M16.356 7h-1.481a1 1 0 0 0-1 1v7.625a1 1 0 0 0 1 1h3.79a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-2.309ZM7.89 7H6.407a1 1 0 0 0-1 1v7.625a1 1 0 0 0 1 1h3.79a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H7.889ZM1.5 5.813h22"
      />
    </svg>
  ),
  align_right: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none">
      <path fill="#fff" d="M0 0h24v24H0z" />
      <path
        stroke="currentColor"
        d="M15.856 7h-1.481a1 1 0 0 0-1 1v7.625a1 1 0 0 0 1 1h3.79a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-2.309ZM7.39 7H5.907a1 1 0 0 0-1 1v7.625a1 1 0 0 0 1 1h3.79a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H7.389ZM1 17.813h22"
      />
    </svg>
  ),
  param_spot_width: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 11H2L2 5L3 5V4H0V5L1 5L1 11H0V12H3V11ZM6 5H15V11H6V5ZM5 4H6H15H16V5V11V12H15H6H5V11V5V4Z"
        fill="#2A333D"
      />
    </svg>
  ),
  param_spot_length: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 2H2V5H3V4H13V5H14V2H13V3H3V2ZM3 8H13V13H3V8ZM2 7H3H13H14V8V13V14H13H3H2V13V8V7Z"
        fill="#2A333D"
      />
    </svg>
  ),
  param_spot_angle: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 3H4V6.5C7.58985 6.5 10.5 9.41015 10.5 13H14V14H4H3V13V3ZM9.5 13C9.5 9.96243 7.03757 7.5 4 7.5V13L9.5 13Z"
        fill="#2A333D"
      />
    </svg>
  ),
  param_lane_width: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 0H3H4V16H3H0V15H3V11.0623H0V10.0623H3V6.03125H0V5.03125H3V1H0V0ZM7 15H8V13H7V15ZM7 11H8V9H7V11ZM8 7H7L7 5H8L8 7ZM7 3H8L8 1L7 1V3ZM12 0H15.0938V1H12V5.03125H15.0938V6.03125H12V10.0623H15.0938V11.0623H12V15H15.0938V16H12H11V0H12Z"
        fill="#2A333D"
      />
    </svg>
  ),
  param_column_width: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 0H3V3V4H13V3V0H12V3H4V0ZM1 7V8H3V7H1ZM5 7V8H7V7H5ZM9 8V7L11 7V8H9ZM13 7V8H15V7H13ZM13 11H3V12V15H4V12H12V15H13V12V11Z"
        fill="#2A333D"
      />
    </svg>
  ),
  param_spots_between_columns: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1 1V0H3V1H1ZM5 1V0H7V1L5 1ZM9 0V1H11V0H9ZM13 1V0H15V1H13ZM4 4H11V7H4V4ZM12 4V7V8V11V12H11H4H3V11V8V7V4V3H4H11H12V4ZM4 11V8H11V11H4ZM1 15V14H3V15H1ZM5 15V14L7 14V15H5ZM9 14V15H11V14H9ZM13 15V14H15V15H13Z"
        fill="#2A333D"
      />
    </svg>
  ),
  param_buffer_from_wall: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1 1V1.99999H1.00015L1.00015 3.00005H2.00015L2.00015 1.99999H2.99999V1H1ZM5.00008 1.00002V2.00001L7.00006 2.00001V1.00002L5.00008 1.00002ZM8.99962 2.00001V1.00002L10.9996 1.00002V2.00001L8.99962 2.00001ZM12.9997 1.00002V2.00001L14 2.00001L14 3.00005H15V1.00006L14.9997 1.00006V1.00002L12.9997 1.00002ZM1.00014 13.9999H2.00014L2.00014 12.9999H1.00014L1.00014 13.9999ZM1.00015 11.0001H2.00015L2.00015 9.00008H1.00015L1.00015 11.0001ZM2.00015 6.99986H1.00015L1.00015 4.99988H2.00015L2.00015 6.99986ZM15 14.9999H14V14.9999H12.9997V13.9999L14 13.9999V12.9999H15V14.9999ZM15 11.0001H14L14 9.00008H15L15 11.0001ZM15 6.99986H14V4.99988H15V6.99986ZM1 13.9999V14.9999H2.99999V13.9999H1ZM5.00008 13.9999V14.9999H7.00006V13.9999L5.00008 13.9999ZM8.99989 14.9999V13.9999L10.9999 13.9999V14.9999H8.99989ZM6 6.00024H10V10.0002H6V6.00024ZM5 5.00024H6H10H11V6.00024V10.0002V11.0002H10H6H5V10.0002V6.00024V5.00024Z"
        fill="#2A333D"
      />
    </svg>
  ),
}

export default icons
