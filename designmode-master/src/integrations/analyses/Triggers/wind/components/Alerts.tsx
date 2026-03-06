import { useSignal } from "@preact/signals"
import type { ComponentChildren } from "preact"
import { useId } from "preact/hooks"

export function Alert({ label, children }: { label?: ComponentChildren; children?: ComponentChildren }) {
  return (
    <li style={{ listStyle: "none", padding: "8px 0" }}>
      <p style={{ font: "var(--11-medium)", margin: "0 0 4px 0" }}>{label}</p>
      <p style={{ font: "var(--11-regular)", margin: "0", color: "#808080" }}>{children}</p>
    </li>
  )
}

export function Alerts({
  label,
  count,
  children,
}: {
  label?: ComponentChildren
  count: number
  children?: ComponentChildren
}) {
  const expandedSignal = useSignal(true)
  const triggerId = useId()
  const panelId = useId()

  return (
    <div style={{ marginTop: "8px", border: "1px solid rgba(60, 60, 60, 0.1)", borderRadius: "4px" }}>
      <button
        id={triggerId}
        type="button"
        aria-expanded={expandedSignal.value}
        aria-controls={panelId}
        onClick={() => (expandedSignal.value = !expandedSignal.value)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          font: "var(--11-medium)",
        }}
      >
        <span>{label}</span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
          aria-hidden
        >
          <span>{count}</span>
          <forma-icon-arrow-right
            style={{
              transform: expandedSignal.value ? "rotate(90deg)" : "none",
              transition: "transform 0.2s",
            }}
          />
        </span>
      </button>
      <ul
        id={panelId}
        aria-labelledby={triggerId}
        hidden={!expandedSignal.value}
        style={{
          margin: "0",
          padding: "0 12px 12px 12px",
          listStyle: "none",
        }}
      >
        {children}
      </ul>
    </div>
  )
}
