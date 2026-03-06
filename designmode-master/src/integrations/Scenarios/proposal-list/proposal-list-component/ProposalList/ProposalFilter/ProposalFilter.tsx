import type { FormaElement, Urn } from "forma-elements"
import { type Dispatch, type StateUpdater, useState } from "preact/hooks"
import CloseIcon from "src/integrations/Scenarios/proposal-list/proposal-list-component/icons/CloseIcon"
import FilterIcon from "src/integrations/Scenarios/proposal-list/proposal-list-component/icons/FilterIcon"
import { ClickOutside } from "src/lib/components/ClickOutside"
import styles from "src/integrations/Scenarios/proposal-list/proposal-list-component/styles/index.module.css"
import { SortOption } from "./SortOptions"
import { useTranslator } from "src/integrations/Scenarios/proposal-list/proposal-list-component/i18n"

interface ProposalFilterProps {
  proposalFilter: Set<Urn>
  scenarios: FormaElement[]
  setProposalFilter: (filter: Set<Urn>) => void
  setStoredFilter: Dispatch<StateUpdater<Set<Urn>>>
  sortBy: SortOption
  setSortBy: (sort: SortOption) => void
}

export default function ProposalFilter({
  proposalFilter,
  scenarios,
  setProposalFilter,
  setStoredFilter,
  sortBy,
  setSortBy,
}: ProposalFilterProps) {
  const t = useTranslator()
  const [visible, setVisible] = useState<boolean>(false)

  return (
    <>
      <weave-tooltip nub="down-center" text={t(($) => $.filter.buttonTooltip)}>
        <weave-icon-button onClick={() => setVisible(!visible)}>
          <FilterIcon isActive={proposalFilter.size > 0 || sortBy !== SortOption.EDITED} />
        </weave-icon-button>
      </weave-tooltip>
      {visible && (
        <ContextMenu
          close={() => setVisible(false)}
          proposalFilter={proposalFilter}
          scenarios={scenarios}
          setProposalFilter={setProposalFilter}
          setStoredFilter={setStoredFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />
      )}
    </>
  )
}

interface ContextMenuProps {
  proposalFilter: Set<Urn>
  scenarios: FormaElement[]
  close: () => void
  setProposalFilter: (filter: Set<Urn>) => void
  setStoredFilter: Dispatch<StateUpdater<Set<Urn>>>
  sortBy: SortOption
  setSortBy: (sort: SortOption) => void
}

export function ContextMenu({
  scenarios,
  proposalFilter,
  close,
  setProposalFilter,
  setStoredFilter,
  sortBy,
  setSortBy,
}: ContextMenuProps) {
  const t = useTranslator()
  const sortOptions = [
    { value: SortOption.EDITED, label: t(($) => $.sortOptions.lastEdited) },
    { value: SortOption.A_Z, label: t(($) => $.sortOptions.alphabeticalAscending) },
    { value: SortOption.Z_A, label: t(($) => $.sortOptions.alphabeticalDescending) },
  ]
  return (
    <ClickOutside onClickOutside={close}>
      {!scenarios.length ? (
        <weave-menu-container open top={10} left={60} title={t(($) => $.filter.title)} onClick={close}>
          <div className={styles.emptyItem}>{t(($) => $.filter.emptyBasesMessage)}</div>
        </weave-menu-container>
      ) : (
        <weave-menu
          open
          nochecks
          noedit
          maxwidth={300}
          minwidth={200}
          title={t(($) => $.filter.title)}
          top={10}
          left={60}
        >
          <weave-tooltip slot="headericons" nub="down-center" text={t(($) => $.filter.closeButtonTooltip)}>
            <weave-icon-button style={{ cursor: "pointer" }} onClick={close}>
              <CloseIcon />
            </weave-icon-button>
          </weave-tooltip>
          {scenarios.map((scenario) => (
            <weave-menu-item
              key={scenario.urn}
              id={scenario.urn}
              value={scenario.urn}
              onClick={() => {
                const updateFilter = new Set(proposalFilter)
                if (updateFilter.has(scenario.urn)) {
                  updateFilter.delete(scenario.urn)
                } else {
                  updateFilter.add(scenario.urn)
                }
                setProposalFilter(updateFilter)
                setStoredFilter(updateFilter)
              }}
            >
              <div slot="icon" className={styles.checkbox}>
                <weave-checkbox checked={proposalFilter.has(scenario.urn)} />
              </div>
              <div className={styles.contentWrapper}>
                {scenario.properties?.indicator && (
                  <div className={styles.baseIndicator}>{scenario.properties.indicator}</div>
                )}
                <div
                  className={styles.name}
                  style={{
                    fontWeight: proposalFilter.has(scenario.urn) ? "bold" : "normal",
                  }}
                >
                  {scenario.properties?.name}
                </div>
              </div>
            </weave-menu-item>
          ))}

          <div className={styles.sortSection}>
            <h3 className={styles.sortHeader}>{t(($) => $.filter.sortByHeader)}</h3>
          </div>
          {sortOptions.map((option) => (
            <weave-menu-item
              key={option.value}
              onClick={() => setSortBy(option.value)}
              checked={sortBy === option.value}
            >
              <div slot="icon" className={styles.checkIcon}>
                {sortBy === option.value && <forma-check />}
              </div>
              <span
                className={styles.sortLabel}
                style={{
                  fontWeight: sortBy === option.value ? "bold" : "normal",
                }}
              >
                {option.label}
              </span>
            </weave-menu-item>
          ))}
        </weave-menu>
      )}
    </ClickOutside>
  )
}
