type Props = {
  message: string
}

export default function ErrorMessage({ message }: Props) {
  return (
    <div
      style={{
        font: "var(--10-regular)",
        color: "var(--text-color-light)",
      }}
    >
      {message}
    </div>
  )
}
