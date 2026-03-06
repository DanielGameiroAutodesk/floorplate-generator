import { isDefined } from "src/lib/array"
import { useState } from "react"
import { useEffect, useMemo, useRef } from "preact/hooks"
import styles from "./QuickAccess.module.pcss"
import { ClickOutside } from "src/lib/components/ClickOutside"
import { useTranslator } from "src/i18n"
import { KeyboardIcon } from "./KeyboardIcon"
import { useCallback, useLayoutEffect } from "preact/compat"
import { AnalyticsLegacy } from "src/core/analytics"
import type { HotkeyKeyRegistration } from "src/core/hotkeys"
import { hotkeyAPI, HotkeyCategory, useHotkey } from "src/core/hotkeys"
import { signal } from "@preact/signals"

const mod = (n: number, m: number) => ((n % m) + m) % m

const keyCodeMappings: Record<string, string> = {
  " ": "˽",
  ENTER: "⏎",
  BACKSPACE: "⌫",
  META: "⌘",
  SHIFT: "⇧",
  OPTION: "⌥",
  ALT: "⎇",
  CONTROL: "⌃",
  ESCAPE: "Esc",
}

function formatHotkeyString(hotkey: HotkeyKeyRegistration): string {
  const mapKey = (key: string) => keyCodeMappings[key.toUpperCase()] || key
  const tokens = [
    hotkey.ctrl ? mapKey("Ctrl") : undefined,
    hotkey.shift ? mapKey("Shift") : undefined,
    hotkey.meta ? mapKey("Meta") : undefined,
    mapKey(hotkey.keyCode.toUpperCase()),
  ]
  return tokens.filter(isDefined).join("+")
}

const quickAccessOpenSignal = signal<boolean>(false)

const currentFilterSignal = signal<string>("")

export const QuickAccessConditionalRender = () => {
  const open = quickAccessOpenSignal.value
  return open ? <QuickAccess /> : null
}

const QuickAccess = () => {
  const filter = currentFilterSignal.value
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)

  const hotkeys = hotkeyAPI.hotkeysSignal.value

  useEffect(() => {
    setSelectedSuggestion(0)
  }, [filter])

  const t = useTranslator()

  const filtered = useMemo(() => {
    return hotkeys.filter((hotkey) => t.getText(hotkey.description).toLowerCase().includes(filter.toLowerCase()))
  }, [hotkeys, filter, t])

  const filteredAndGroupedByCategory = useMemo(() => {
    return filtered.reduce(
      (previousValue, currentValue) => {
        const cat = currentValue.category ?? HotkeyCategory.General
        const existing = previousValue[cat] || []

        return {
          ...previousValue,
          [cat]: existing
            .concat(currentValue)
            .sort((a, b) => t.getText(a.description).localeCompare(t.getText(b.description))),
        }
      },
      {} as Record<string, HotkeyKeyRegistration[]>,
    )
  }, [filtered, t])

  const suggestion = useMemo(() => {
    const regs = Object.entries(filteredAndGroupedByCategory).reduce(
      (previousValue, currentValue) => previousValue.concat(currentValue[1]),
      [] as HotkeyKeyRegistration[],
    )
    if (!regs.length) return

    return regs[Math.min(selectedSuggestion, regs.length)]
  }, [filteredAndGroupedByCategory, selectedSuggestion])

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        quickAccessOpenSignal.value = false
      }
      if (e.key === "Enter" && suggestion) {
        e.preventDefault()
        e.stopPropagation()
        // don't track this with new tracking schema. 11 events last 3 months
        AnalyticsLegacy.track(t.getText(suggestion.description), { method: "Quick Access" })
        suggestion?.callback()
        quickAccessOpenSignal.value = false
      }

      if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault()
        e.stopPropagation()
        setSelectedSuggestion((v) => mod(v + 1, filtered.length))
      }
      if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
        e.preventDefault()
        e.stopPropagation()
        setSelectedSuggestion((v) => mod(v - 1, filtered.length))
      }
    },
    [suggestion, t, filtered.length],
  )

  // Focus the input field on mount
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [input])

  /*
   * Workaround to prevent input from loosing focus.
   * Setting focus directly on blur doesn't work for some reason...
   */
  const [blurred, setBlurred] = useState(false)
  useEffect(() => {
    if (blurred) {
      input.current?.focus()
      setBlurred(false)
    }
  }, [blurred, input])

  // Scroll to selected suggestion
  useLayoutEffect(() => {
    const elm = document.querySelector("[data-current-suggestion=true]")
    elm?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [selectedSuggestion, filtered.length])

  if (!open) return null

  return (
    <div className={styles.Wrapper}>
      <ClickOutside
        onClickOutside={() => {
          quickAccessOpenSignal.value = false
        }}
        style={{ display: "block" }}
      >
        <div className={styles.QuickAccessListPanel} onKeyDown={keydown}>
          <div className={styles.SearchBar}>
            <input
              placeholder={t(($) => $.quickAccess.search)}
              className={styles.FilterField}
              ref={input}
              onInput={(e) => {
                currentFilterSignal.value = e.currentTarget.value
              }}
              value={filter}
              onBlur={() => setBlurred(true)}
            />
          </div>
          <div className={styles.Listing}>
            {Object.entries(filteredAndGroupedByCategory).map(([category, registrations]) => {
              return (
                <div key={category} className={styles.GroupHeader}>
                  <div className={styles.Header}>
                    <h1>{HotkeyCategory[Number(category)]}</h1>
                  </div>
                  {registrations.map((reg, registrationIdx) => (
                    <div
                      onClick={() => {
                        reg.callback()
                        quickAccessOpenSignal.value = false
                      }}
                      key={registrationIdx}
                      className={[
                        styles.ShortcutListing,
                        reg === suggestion ? styles.CurrentSuggestion : undefined,
                      ].join(" ")}
                      data-current-suggestion={reg === suggestion}
                    >
                      <span>{t.getText(reg.description)}</span>
                      <span className={styles.Shortcut} onClick={() => reg.callback()}>
                        {formatHotkeyString(reg)}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className={styles.NoSuggestions}>
                <span>{t(($) => $.quickAccess.noSuggestions)}</span>
              </div>
            )}
          </div>
        </div>
      </ClickOutside>
    </div>
  )
}

export const QuickAccessButton = () => {
  const t = useTranslator()
  const open = quickAccessOpenSignal.value

  const hotkey = useMemo<HotkeyKeyRegistration>(
    () => ({
      description: (t) => t(($) => $.quickAccess.openHotkeyList),
      keyCode: "Q",
      editAccessRequired: false,
      callback: () => {
        quickAccessOpenSignal.value = true
      },
      alt: false,
      shift: false,
      meta: false,
      ctrl: false,
      disabled: open,
      category: HotkeyCategory.General,
    }),
    [open],
  )

  useHotkey(hotkey)

  return (
    <div className={styles.ButtonWrapper}>
      <weave-tooltip
        text={t(($) => $.quickAccess.title)}
        nub={"left-center"}
        splitshortcutonspace={true}
        shortcutmac={"Q"}
        shortcutwindows={"Q"}
      >
        <weave-icon-button
          className={styles.Button}
          onClick={(e) => {
            e.stopPropagation() // Prevents the ClickOutside logic from interfering
            quickAccessOpenSignal.value = !quickAccessOpenSignal.peek()
          }}
        >
          <KeyboardIcon />
        </weave-icon-button>
      </weave-tooltip>
    </div>
  )
}
