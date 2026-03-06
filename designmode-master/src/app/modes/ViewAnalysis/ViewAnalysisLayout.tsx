import { SIDEBAR_DEFAULT_STATE, sidebarsCollapsedState } from "src/integrations/sidebar/sidebarsState"
import { useRecoilState } from "recoil"
import type { ComponentChildren } from "preact"
import { isDefined } from "src/lib/array"
import { useRef } from "preact/hooks"
import { useEffect } from "preact/compat"
import { useSignal } from "@preact/signals"

export const ViewAnalysisLayout = {
  Main: function ({ children }: { children: ComponentChildren }) {
    return <main className={"forma-grid-main main"}>{children}</main>
  },
  RightMenu: function ({ children }: { children: ComponentChildren }) {
    const [collapsed, setCollapsed] = useRecoilState(sidebarsCollapsedState)
    return (
      <aside
        className={`forma-grid-right ${collapsedClass(collapsed.right)}`}
        style={{
          display: "flex",
          flexDirection: "column",
          maxHeight: "fit-content",
        }}
      >
        <div className="forma-grid-right-edge">
          <button
            className="collapse-button"
            style={{ zIndex: "calc(var(--z-primary-navigation) + 40)" }}
            onClick={() =>
              setCollapsed((prev) => (isDefined(prev) ? { ...prev, right: !prev?.right } : SIDEBAR_DEFAULT_STATE))
            }
          >
            <svg width="12" height="12" viewBox="0 0 12 12" stroke="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M4.22708 1.5009L8.17136 5.65575L8.49816 6L8.17136 6.34424L4.22708 10.4991L3.50183 9.8106L7.11932 6L3.50183 2.18939L4.22708 1.5009Z"
              ></path>
            </svg>
          </button>
        </div>
        <div style={{ overflow: "hidden auto" }}>
          <div style={{ margin: "0 16px" }}>{children}</div>
        </div>
      </aside>
    )
  },
  BottomContainer: function ({
    children,
    minWidthThreshold,
  }: {
    children: ComponentChildren
    minWidthThreshold?: number
  }) {
    const containerRef = useRef(null)

    const belowMinWidthThresholdSignal = useSignal(false)
    const threshold = minWidthThreshold ?? 0

    useEffect(() => {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          requestAnimationFrame(() => {
            const width = entry.contentRect.width
            belowMinWidthThresholdSignal.value = width < threshold
          })
        }
      })
      if (containerRef.current) {
        observer.observe(containerRef.current)
      }
      return () => observer.disconnect()
    }, [belowMinWidthThresholdSignal, threshold])

    return (
      <div ref={containerRef} className="bottom-main" style={{ flexDirection: "column", pointerEvents: "none" }}>
        <div
          style={{
            pointerEvents: "none",
            zIndex: "calc(var(--z-primary-navigation) + 30)",
            display: "flex",
            flexDirection: "row-reverse",
            justifyContent: "space-between",
            ...(belowMinWidthThresholdSignal.value && { display: "none" }),
          }}
        >
          {children}
        </div>
      </div>
    )
  },
}

function collapsedClass(collapsed?: boolean) {
  return collapsed ? " collapsed" : ""
}
