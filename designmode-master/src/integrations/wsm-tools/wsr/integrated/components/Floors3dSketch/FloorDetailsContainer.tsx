import { useState } from "preact/hooks"

import ArrowAngle from "src/integrations/wsm-tools/wsr/integrated/components/Common/ArrowAngle/ArrowAngle"

import styled from "./FloorDetailsContainer.module.pcss"
import { PlusIcon } from "src/integrations/wsm-tools/wsr/svg-icons"
import { useTranslator } from "src/i18n"

type Props = {
  title: string
  children: JSX.Element
  handleAddFloor?: () => void
}

const FloorDetailsContainer = ({ title, handleAddFloor, children }: Props) => {
  const t = useTranslator()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      <div className={styled.HeaderContainer} onClick={() => setCollapsed(!collapsed)}>
        <div className={styled.ActionContainer}>
          {!collapsed && handleAddFloor && (
            <weave-tooltip text={t(($) => $.wsm.floors.addFloor)} nub="down-center">
              <button
                className={styled.ActionButton}
                onClick={(e) => {
                  e.stopPropagation()
                  handleAddFloor()
                }}
              >
                <PlusIcon />
              </button>
            </weave-tooltip>
          )}
          <ArrowAngle rotation={collapsed ? -90 : 0} />
        </div>
        <span className={styled.HeaderTitle}>{title}</span>
      </div>
      {!collapsed && children}
    </>
  )
}

export default FloorDetailsContainer
