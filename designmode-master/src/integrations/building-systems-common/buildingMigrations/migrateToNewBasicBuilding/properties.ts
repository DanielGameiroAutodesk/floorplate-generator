import type { Properties } from "forma-elements"

export function onlyKeepEditProperties(properties: Properties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key]) => {
      // regex for properties set using edit-properties endpoints defined here:
      // https://github.com/spacemakerai/element-system-alignment/blob/734af1c2175184b0c589325394d31322a649c1a1/api-schema.yaml#L15
      return key.match("^[\\w-]{1,20}:[\\w-]{1,50}$")
    }),
  )
}
