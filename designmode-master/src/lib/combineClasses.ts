import { objectKeys } from "./record"

interface ConditionalStyles {
  [key: string]: boolean
}

/**
 * This function is used to conditionally apply styles.
 * It takes in base styles and optional conditionals,
 * and applies the conditional styles if they are true.
 * It returns a string of the classnames combined.
 *
 * @param baseStyles
 * @param conditional
 * @returns string
 */

export default function combineClasses(baseStyles: string[], conditionalStyles?: ConditionalStyles): string {
  if (!conditionalStyles) return baseStyles.join(" ")

  const filteredConditionals = objectKeys(conditionalStyles).filter((key: string) => conditionalStyles[key])
  const classname = baseStyles.concat(filteredConditionals).join(" ")
  return classname
}
