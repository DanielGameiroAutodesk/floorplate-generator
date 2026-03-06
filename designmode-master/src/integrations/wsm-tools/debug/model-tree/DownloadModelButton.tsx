export function DownloadModelButton() {
  function handleOnClick() {
    const tempFilePath = `/temporary.axm`

    const module = window.FormItModule

    // Make sure we do not reset the FormIt is modified flag. Set the fourth
    // argument to false.
    FormIt.SaveFile(tempFilePath, 0, [], false)

    const binaryData = module.FormIt_ReadFile(tempFilePath)
    const blob = new Blob([binaryData], {
      type: "application/octet-stream",
    })

    const objectUrl = window.URL.createObjectURL(blob)

    const link = document.createElement("a")
    document.body.appendChild(link)

    link.href = objectUrl
    link.download = `FormaDebug.axm`
    link.click()

    document.body.removeChild(link)
  }

  return (
    <button style={{ float: "right" }} onClick={handleOnClick}>
      Download Model
    </button>
  )
}
