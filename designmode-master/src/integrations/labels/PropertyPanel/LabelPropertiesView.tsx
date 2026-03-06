import { useEffect, useState } from "preact/hooks"
import type { AnnotationLabelStyles, TextAlign } from "src/integrations/labels/constants"
import styles from "./LabelPropertiesView.module.pcss"
import { TextAlignmentIcon } from "src/integrations/labels/Icons/TextAlignmentIcon"
import { useDebounce } from "src/lib/debounce"
import UnitInput from "src/integrations/inputs/UnitInput"
import LabelColorPopout from "./LabelColorPopout/LabelColorPopout"
import { useTranslator } from "src/i18n"

import { RightMenuPanel } from "src/lib/components/RightMenu/RightMenuPanel"

type Props = {
  value: AnnotationLabelStyles
  mixed?: { [K in keyof AnnotationLabelStyles]: boolean }
  onChangeStyle: (changedProperties: Partial<AnnotationLabelStyles>) => void
  disabled?: boolean
}

const MIXED_PLACEHOLDER_COLOR = "#FFFFFF"
export default function LabelPropertiesView({ value, mixed, onChangeStyle, disabled }: Props) {
  const t = useTranslator()
  const debouncedOnChangeStyle = useDebounce(onChangeStyle, 500, { leading: true, trailing: true })
  const [current, setCurrent] = useState<AnnotationLabelStyles>(value)
  const [colorMenuOpen, setColorMenuOpen] = useState(false)

  useEffect(() => {
    setCurrent(value)
  }, [value])

  return (
    <div style={{ opacity: disabled ? 0.5 : 1 }}>
      <RightMenuPanel>
        <label className={styles.Row}>
          <span className={styles.HeaderWithAddDeleteButton}>{t(($) => $.properties.color)}</span>
          <LabelColorPopout
            isOpen={colorMenuOpen}
            closeMenu={() => setColorMenuOpen(false)}
            initialColor={value.color}
            setColor={(color: string) => {
              setCurrent({ ...current, color })
              debouncedOnChangeStyle({ color })
            }}
          />
          <div className={styles.ColorValue}>
            <span className={styles.ColorCode}>{mixed?.color ? "Mixed" : current.color.toUpperCase()}</span>
            <button
              disabled={disabled}
              className={styles.Picker}
              style={{ background: mixed?.color ? MIXED_PLACEHOLDER_COLOR : current.color }}
              onClick={(e) => {
                e.stopPropagation()
                setColorMenuOpen(!colorMenuOpen)
              }}
            />
            <UnitInput
              onChange={(newOpacity) => {
                setCurrent({ ...current, opacity: newOpacity })
                debouncedOnChangeStyle({ opacity: newOpacity / 100 })
              }}
              min={0}
              max={100}
              step={10}
              unit={"%"}
              id={"opacity"}
              isMixed={mixed?.opacity}
              value={current.opacity}
              accessAware={true}
              style={{ width: "50px" }}
            />
          </div>
        </label>
      </RightMenuPanel>
      <RightMenuPanel>
        <label className={styles.Row}>
          <span className={styles.HeaderWithAddDeleteButton}>{t(($) => $.ui.textAlignment)}</span>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            {["start", "center", "end"].map((textAlign) => (
              <weave-button
                key={textAlign}
                variant={textAlign === current.textAlign ? "outlined" : "flat"}
                onClick={() => {
                  setCurrent({ ...current, textAlign: textAlign as TextAlign })
                  debouncedOnChangeStyle({ textAlign: textAlign as TextAlign })
                }}
              >
                <TextAlignmentIcon textAlign={textAlign as TextAlign} />
              </weave-button>
            ))}
          </div>
        </label>
      </RightMenuPanel>
    </div>
  )
}
