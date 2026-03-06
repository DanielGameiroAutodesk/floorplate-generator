export const copyPastePermissionErrorToast = (action: "paste" | "copy", e: any) => {
  console.error(e)

  if (navigator.userAgent.indexOf("Chrome") !== -1) {
    window.forma_toasts.push({
      content: {
        text: `Read more about`,
        linkText: "changing site settings permissions in chrome",
        url: "https://support.google.com/chrome/answer/114662",
      },
      status: "warning",
      autoDismiss: false,
    })
    window.forma_toasts.push({
      content: {
        text: `Could not ${action} clipboard contents. Please check and allow permissions by pasting the URL below in the address bar`,
        linkText: "chrome://settings/content/clipboard",
        url: "chrome://settings/content/clipboard",
      },
      status: "warning",
      autoDismiss: false,
    })
  } else {
    window.forma_toasts.push({
      content: `Could not ${action} clipboard contents. Please check clipboard permissions`,
      status: "warning",
      autoDismiss: false,
    })
  }
}

export const pasteMalformedContentToast = (clipboardText: string) => {
  window.forma_toasts.push({
    content: `Could not paste clipboard content '${clipboardText.substring(0, 10)}...' into scene`,
    status: "warning",
  })
}
