type Props = {
  rotation: number
  onClick?: (e: MouseEvent) => void
}

const ArrowAngle = ({ rotation = 0, onClick }: Props) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    style={{ transform: `rotate(${rotation}deg)`, transition: "all 200ms ease 0s" }}
    onClick={onClick}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.15485 8.16953L2 4.22525L2.68849 3.5L6.4991 7.11749L10.3097 3.5L10.9982 4.22525L6.84334 8.16953L6.4991 8.49633L6.15485 8.16953Z"
    />
  </svg>
)

export default ArrowAngle
