import { useEffect, useRef } from "preact/hooks"
import { useRecoilState } from "recoil"
import type { I18nStringProvider } from "src/i18n"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"

export default function useGuideText(text: I18nStringProvider, overridePrevious = false) {
  const [guideText, setGuideText] = useRecoilState(guideTextAtom)
  useEffect(() => {
    if (!overridePrevious && guideText) return
    setGuideText(() => text)
  }, [setGuideText, guideText, text, overridePrevious])

  const unmountRef = useRef<() => void>()
  unmountRef.current = () => setGuideText(() => () => "")
  useEffect(() => () => unmountRef.current?.(), [])
}
