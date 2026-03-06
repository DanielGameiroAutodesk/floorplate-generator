export const colors = {
  black: "#000000",
  white: "#FFFFFF",
  blue10: "#092339",
  blue20: "#062B4C",
  blue30: "#03599B",
  blue40: "#0676C6",
  blue50: "#0E8FE5",
  blue60: "#39B3F9",
  blue70: "#87D4FD",
  blue80: "#D9F0FC",
  blue90: "#EDF8FD",
  gray10: "#141B22",
  gray20: "#2A333D",
  gray30: "#424D58",
  gray40: "#5B6671",
  gray50: "#737F8C",
  gray60: "#9DAAB8",
  gray70: "#CFD7E0",
  gray80: "#E7ECF2",
  gray90: "#F3F4F6",
  red10: "#660015",
  red20: "#890117",
  red30: "#AE041B",
  red40: "#D2091D",
  red50: "#EC2734",
  red60: "#F64C51",
  red70: "#FB7070",
  red80: "#FFA3A3",
  red90: "#FFCDCC",
  green50: "#22A028",
  Vegetation: "#4B8B67",
  EDGE_INDICATOR: "#f5c13d",
  DEBUG: "#ff00aa",
  scenarioPurple: "#7b49e5",
  borderAccent: "#0696D7",
}

export const opacityPercentage = {
  5: "0C",
  10: "19",
  15: "26",
  20: "33",
  25: "3F",
  30: "4C",
  35: "59",
  40: "66",
  45: "72",
  50: "7F",
  55: "8C",
  60: "99",
  65: "A5",
  70: "B2",
  75: "BF",
  80: "CC",
  85: "D8",
  90: "E5",
  95: "F2",
  100: "FF",
}

/* Returns black or white hex color based on contrast on background.
   Primarily intended to be used for text color on background color.
   Source: https://24ways.org/2010/calculating-color-contrast/
 */
export function calculateBlackOrWhiteContrast(bgColorHex?: string): string {
  if (!bgColorHex || !bgColorHex.length) return "#000000"

  const onlyNumber = bgColorHex.replace("#", "")
  if (onlyNumber.length !== 6) return "#000000"

  const r = parseInt(onlyNumber.substring(0, 2), 16)
  const g = parseInt(onlyNumber.substring(2, 4), 16)
  const b = parseInt(onlyNumber.substring(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000

  return yiq >= 128 ? "#000000" : "#ffffff"
}
