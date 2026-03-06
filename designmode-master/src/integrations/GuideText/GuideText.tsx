import { atom, useRecoilState, useRecoilValue } from "recoil"
import { useEffect, useRef } from "preact/compat"
import { useTranslator, type I18nStringProvider } from "src/i18n"

export const guideTextAtom = atom<I18nStringProvider | undefined>({ key: "guideText", default: undefined })
export const tempGuideTextAtom = atom<I18nStringProvider | undefined>({ key: "tempGuideText", default: undefined })

function useLatestDefinedValue<T>(value: T) {
  const ref = useRef<T>()

  useEffect(() => {
    ref.current = value ?? ref.current
  }, [value])

  return value ?? ref.current
}

export default function GuideText() {
  const t = useTranslator()
  const guideText = useRecoilValue(guideTextAtom)
  const [tempGuideText, setTempGuideText] = useRecoilState(tempGuideTextAtom)

  const latest = useLatestDefinedValue(tempGuideText || guideText)

  useEffect(() => {
    if (tempGuideText) {
      setTimeout(() => {
        setTempGuideText((current: I18nStringProvider | undefined) => (current === tempGuideText ? undefined : current))
      }, 3000)
    }
  }, [setTempGuideText, tempGuideText])

  if (!latest) return null
  const text = t.getText(latest)
  if (!text) return null
  return (
    <>
      <div
        style={{
          position: "relative",
          background: "var(--background-color-surface-100)",
          font: "var(--font-body)",
          color: "var(--font-body-color)",
          boxShadow: "0px 3px 8px rgba(0, 0, 0, 0.08), 0px 4px 16px rgba(0, 0, 0, 0.1)",
          display: "flex",
          width: "fit-content",
          alignItems: "center",
          padding: "0 1.6em",
          height: "36px",
          borderRadius: "0.4em",
          pointerEvents: "none",
          transition: "0.2s",
        }}
      >
        {text}
      </div>
    </>
  )
}
