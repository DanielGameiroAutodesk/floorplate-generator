import { FormaI18n } from "@spacemakerai/globalization/browser"
import { createTranslatorHooks } from "@spacemakerai/globalization/react"
import type TranslationData from "./translations/en-US/texts.json"

type TranslationData = typeof TranslationData

const translations = Object.fromEntries(
  Object.entries(
    import.meta.glob<TranslationData>("./translations/*/texts.json", {
      eager: true,
      import: "default",
    }),
  ).map(([key, value]) => {
    const locale = /translations\/([^/]+)\//.exec(key)?.[1]
    if (!locale) {
      throw new Error(`Couldn't extract locale code from ${key}`)
    }
    return [locale, value]
  }),
)

export const formaI18n = new FormaI18n({
  type: "forma-component",
  translations,
})

export const { useIsLocaleLoaded, useLocale, useTranslator, getTranslator } = createTranslatorHooks(formaI18n)

export type Translator = ReturnType<typeof useTranslator>
