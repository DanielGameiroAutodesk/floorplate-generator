export default function Sketch3DIcon({
  width = 24,
  height = 24,
  showRedFace,
  showFloorLine,
  showEditArrow,
}: {
  width?: number
  height?: number
  showRedFace?: boolean
  showFloorLine?: boolean
  showEditArrow?: boolean
}) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      {showEditArrow && (
        <defs>
          <mask id="editMask">
            <rect fill="white" width="20.623665" height="22.680031" x="1.5716889" y="0.55609214" />
            <rect fill="#111111" width="10.256785" height="8.132637" x="14.29699" y="14.714404" />
          </mask>
        </defs>
      )}
      <g mask={showEditArrow ? "url(#editMask)" : undefined}>
        <path d="M20.4693 16.3736C20.525 16.587 20.4344 16.8116 20.2462 16.9266L11.2462 22.4266C11.0827 22.5266 10.8764 22.5242 10.7151 22.4206L3.71512 17.9206C3.55064 17.8148 3.46289 17.6229 3.49051 17.4293L5.09142 6.21069C5.11498 6.04556 5.21933 5.90307 5.36964 5.83075L14.2687 1.5494C14.4647 1.45511 14.6992 1.49834 14.8487 1.65633L17.2141 4.15636C17.2719 4.21748 17.3134 4.29221 17.3346 4.37363L20.4693 16.3736ZM19.4079 16.267L16.5905 5.4816L11.4855 10.7038L11.4855 21.1085L19.4079 16.267ZM10.4855 21.0842L10.4855 10.7438L5.95934 7.20726L4.52582 17.2529L10.4855 21.0842ZM6.52852 6.38293L10.9407 9.8305L16.1572 4.49434L14.3732 2.60883L6.52852 6.38293Z" />
        <path
          opacity="0.4"
          d="M12.5257 11.6951L3.72477 17.0733L4.24622 17.9266L12.9788 12.5901L19.7151 16.9206L20.2559 16.0794L13.528 11.7543L14.9799 2.07417L13.991 1.92583L12.5257 11.6951Z"
        />
        {showFloorLine && (
          <>
            <line x1="10.7393" y1="16.2733" x2="18.4197" y2="11.5815" stroke="currentColor" />
            <line x1="4.57084" y1="12.1797" x2="10.8751" y2="16.2425" stroke="currentColor" />
          </>
        )}
        {showRedFace && (
          <>
            <path
              fill="#F9B4B4"
              opacity="0.5"
              d="M11.6,21.8s-.3.2-.5,0l-.2-.2v-10.7l.4-.9,4.9-5h1.1c0-.1,2.9,10.9,2.9,11.1s0,.4-.2.5-8.3,5.1-8.3,5.1Z"
            />
            <path
              d="M16.6,5.5c1.1,4.1,2.5,9.5,2.8,10.8-1.3.8-6.1,3.7-7.9,4.8h0v-10.1l.3-.6,4.8-4.9M17.3,4.4h-1.2c0,.1-5.2,5.5-5.2,5.5l-.5.9v11.5l.3.2c0,0,.2,0,.2,0,.2,0,.3,0,.3,0,0,0,8.6-5.3,9-5.5.3-.2.3-.3.2-.6,0-.2-3.1-12-3.1-12h0Z"
              fill="#EB5555"
            />
          </>
        )}
      </g>
      {showEditArrow && (
        <>
          <path d="m 16,18.625 h 7.375" stroke="#808080" id="path3" style="display:inline" />
          <path
            style="display:inline;fill:#808080;fill-opacity:1;stroke:none;stroke-width:1.209;stroke-dasharray:none;stroke-opacity:1"
            d="m 21.50333,15.675547 2.533301,2.949572 -2.531261,2.953478 -0.759313,-0.653964 1.982297,-2.293568 -1.980257,-2.301379 z"
          />
        </>
      )}
    </svg>
  )
}
