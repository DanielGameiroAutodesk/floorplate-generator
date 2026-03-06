import {
  type Translator as _Translator,
  createIcuFormatter,
  createIcuStringFormatter,
  type Key,
} from "@spacemakerai/globalization"
import { FormaI18n } from "@spacemakerai/globalization/browser"
import {
  createIcuReactFormatter,
  createReactComponentFormatter,
  createTranslatorHooks,
} from "@spacemakerai/globalization/react"
import { createTranslatorSignals } from "@spacemakerai/globalization/signals"
import type _TranslationData from "./translations/en-US/texts.json"
import type { ComponentChildren } from "preact"

export type TranslationData = typeof _TranslationData

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
  type: "forma-standalone",
  translations,
  transformTranslator: (translator) => {
    const icuFormatter = createIcuFormatter(translator)
    return Object.assign(translator, {
      component: createReactComponentFormatter(translator),
      icu: createIcuReactFormatter(icuFormatter),
      icuString: createIcuStringFormatter(icuFormatter),
      getText: (text: I18nStringProvider) => text(translator),
    })
  },
})

export const {
  getIsLocaleLoaded,
  getLocale,
  // TODO: We currently use getTranslator in many places where it should be using useTranslator. Review these later.
  getTranslator,
  useIsLocaleLoaded,
  useLocale,
  useTranslator,
} = createTranslatorHooks<TranslationData, Translator>(formaI18n)

export const { isLocaleLoadedSignal, localeSignal, tSignal } = createTranslatorSignals(formaI18n)

type BaseTranslator = _Translator<TranslationData>

// TODO(l10n): I thought we solved the Preact React compat problem, but apparently not. Can we fix this? Below is a compatibility layer to avoid "any" types.

// Define types for ICU formatting parameters
// These mirror the types from intl-messageformat used in the globalization package
type PrimitiveType = string | number | boolean | null | undefined | Date
type FormatXMLElementFn<T> = (parts: T[]) => T

// Override the Translator type to use Preact's ComponentChildren instead of React's ReactNode
// We use an intersection type to preserve the call signature and other methods
export type Translator = _Translator<TranslationData> & {
  icu: (
    key: Key<TranslationData>,
    parameters?: Record<string, PrimitiveType | ComponentChildren | FormatXMLElementFn<ComponentChildren>>,
  ) => ComponentChildren
  component: (key: Key<TranslationData>, parameters?: Record<string, ComponentChildren>) => ComponentChildren
  icuString: (key: Key<TranslationData>, parameters?: Record<string, PrimitiveType>) => string
  getText: (text: I18nStringProvider) => string
}

export type I18nStringProvider = (t: BaseTranslator) => string
