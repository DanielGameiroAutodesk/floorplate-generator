function getLocale() {
  const locale = localStorage.getItem("locale")

  switch (locale) {
    case "en":
    case "nb":
    case "fr":
    case "sv":
      return locale
    default:
      return "en"
  }
}

export default getLocale()
