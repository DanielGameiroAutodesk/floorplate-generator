import { SIDEBAR_DEFAULT_STATE, sidebarsCollapsedState } from "src/integrations/sidebar/sidebarsState"
import { useRecoilState } from "recoil"
import type { ComponentChildren } from "preact"
import { isDefined } from "src/lib/array"

export const Layout = {
  Main: function ({ children }: { children: ComponentChildren }) {
    return <main className={`forma-grid-main main`}>{children}</main>
  },
  LeftMenu: function ({ children }: { children: ComponentChildren }) {
    const [collapsed, setCollapsed] = useRecoilState(sidebarsCollapsedState)
    return (
      <nav className={`forma-grid-left ${collapsedClass(collapsed.left)}`}>
        <div id="forma-grid-left-edge" className="forma-grid-left-edge">
          <button
            className="collapse-button"
            onClick={() => {
              setCollapsed((prev) => (isDefined(prev) ? { ...prev, left: !prev.left } : SIDEBAR_DEFAULT_STATE))
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" stroke="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3.50193 5.65573L7.44622 1.50088L8.17147 2.18937L4.55398 5.99997L8.17146 9.81058L7.44622 10.4991L3.50193 6.34422L3.17513 5.99997L3.50193 5.65573Z"
              ></path>
            </svg>
          </button>
        </div>
        {children}
      </nav>
    )
  },
  RightMenu: function ({ children }: { children: ComponentChildren }) {
    const [collapsed, setCollapsed] = useRecoilState(sidebarsCollapsedState)

    return (
      <aside
        className={`forma-grid-right ${collapsedClass(collapsed.right)}`}
        style={{ display: "flex", flexDirection: "column" }}
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
        {children}
      </aside>
    )
  },
}
function collapsedClass(collapsed?: boolean) {
  return collapsed ? " collapsed" : ""
}
