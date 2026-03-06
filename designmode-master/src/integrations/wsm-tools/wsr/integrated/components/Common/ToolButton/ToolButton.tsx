type Props = {
  icon: JSX.Element
  onClick: () => void
  disabled?: boolean
  dataId?: string
}

const ToolButton = ({ icon, disabled, onClick }: Props) => {
  const handleRightClick = (event: MouseEvent) => {
    event.preventDefault()
    onClick()
  }

  const buildToolButton = () => {
    return (
      <forma-toolbar-button active={false} onClick={onClick} onContextMenu={handleRightClick} disabled={disabled}>
        {icon}
      </forma-toolbar-button>
    )
  }

  return <div>{buildToolButton()}</div>
}

export default ToolButton
