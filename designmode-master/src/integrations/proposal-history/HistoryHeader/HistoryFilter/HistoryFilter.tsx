import { ClickOutside } from "src/lib/components/ClickOutside"
import { CloseIcon } from "src/lib/components/icons/CloseIcon"
import FilterIcon from "./FilterIcon"
import { useCallback, useState } from "preact/hooks"
import { useRecoilState, useRecoilValue } from "recoil"
import type { AnalysisKey } from "src/integrations/proposal-history/proposal-history-state"
import {
  maxRevisionDateState,
  minRevisionDateState,
  proposalHistoryFilterState,
} from "src/integrations/proposal-history/proposal-history-state"
import { useTranslator } from "src/i18n"
import type { DateParams } from "./SelectDate/SelectDate"
import SelectDate, { dateParamToTimeStamp } from "./SelectDate/SelectDate"
import { ANALYSIS_TYPE_LABEL } from "src/integrations/proposal-history/utils/fetchAnalyzedRevisions"
import styles from "./HistoryFilter.module.pcss"
import combineClasses from "src/lib/combineClasses"
import { objectKeys } from "src/lib/record"

export default function HistoryFilter() {
  const t = useTranslator()
  const [filterOpen, setFilterOpen] = useState(false)

  const [analysisSubOpen, setAnalysisSubOpen] = useState(false)
  const [dateSubOpen, setDateSubOpen] = useState(false)

  const [filter, setFilter] = useRecoilState(proposalHistoryFilterState)
  const minRevisionDate = useRecoilValue(minRevisionDateState)
  const maxRevisionDate = useRecoilValue(maxRevisionDateState)

  const hasActiveFilters = filter.pinned || filter.yours || filter.analysis || filter.byDate

  const togglePinned = useCallback(() => setFilter({ ...filter, pinned: !filter.pinned }), [filter, setFilter])
  const toggleYours = useCallback(() => setFilter({ ...filter, yours: !filter.yours }), [filter, setFilter])

  const toggleAnalysis = useCallback(() => {
    setAnalysisSubOpen(!filter.analysis)
    setDateSubOpen(false)

    const newAnalysisState = !filter.analysis
    let newAnalysisTypes = filter.analysisTypes

    if (newAnalysisState && !Object.values(filter.analysisTypes).some(Boolean)) {
      newAnalysisTypes = Object.keys(filter.analysisTypes).reduce(
        (acc, key) => ({
          ...acc,
          [key]: true,
        }),
        {} as typeof filter.analysisTypes,
      )
    }

    setFilter({
      ...filter,
      analysis: newAnalysisState,
      analysisTypes: newAnalysisTypes,
    })
  }, [filter, setFilter])

  const toggleDate = useCallback(() => {
    setDateSubOpen(!filter.byDate)
    setAnalysisSubOpen(false)
    setFilter({
      ...filter,
      byDate: !filter.byDate,
      dateParams: filter.dateParams || {
        from: {
          date: minRevisionDate.getDate(),
          month: minRevisionDate.getMonth(),
          year: minRevisionDate.getFullYear(),
        },
        to: {
          date: maxRevisionDate.getDate(),
          month: maxRevisionDate.getMonth(),
          year: maxRevisionDate.getFullYear(),
        },
      },
    })
  }, [filter, maxRevisionDate, minRevisionDate, setFilter])

  const setDate = useCallback(
    (key: "from" | "to", newDate: DateParams) => {
      if (!filter.dateParams) return
      setFilter({ ...filter, dateParams: { ...filter.dateParams, [key]: newDate } })
    },
    [filter, setFilter],
  )

  const toggleAnalysisType = useCallback(
    (analysisType: AnalysisKey) => {
      const newAnalysisTypes = { ...filter.analysisTypes, [analysisType]: !filter.analysisTypes[analysisType] }

      const hasAnyAnalysisSelected = Object.values(newAnalysisTypes).some(Boolean)

      if (!hasAnyAnalysisSelected) {
        setAnalysisSubOpen(false)
      }

      setFilter({
        ...filter,
        analysisTypes: newAnalysisTypes,
        analysis: hasAnyAnalysisSelected ? filter.analysis : false,
      })
    },
    [filter, setFilter],
  )

  return (
    <div>
      <weave-tooltip text={filterOpen ? "" : t(($) => $.proposalHistory.filter.title)} nub="left-center">
        <weave-icon-button onClick={() => setFilterOpen(!filterOpen)} id="open-filter">
          <FilterIcon isActive={hasActiveFilters} />
        </weave-icon-button>
      </weave-tooltip>
      <ClickOutside
        onClickOutside={(e) => {
          const target = e?.target as Element | undefined
          if (target?.id === "open-filter") return
          setFilterOpen(false)
          setAnalysisSubOpen(false)
          setDateSubOpen(false)
        }}
      >
        <weave-menu
          open={filterOpen}
          nochecks
          noedit
          title={t(($) => $.proposalHistory.filter.title)}
          top={-30}
          left={64}
          maxwidth={300}
          minwidth={236}
        >
          <weave-tooltip slot="headericons" nub="down-center" text={t(($) => $.ui.close)}>
            <weave-icon-button onClick={() => setFilterOpen(false)}>
              <CloseIcon />
            </weave-icon-button>
          </weave-tooltip>
          <weave-menu-item onClick={togglePinned} selected={filter.pinned}>
            <div slot="icon" className={styles.checkbox}>
              <weave-checkbox checked={filter.pinned} />
            </div>
            <span>{t(($) => $.proposalHistory.filter.pinned)}</span>
          </weave-menu-item>
          <weave-menu-item onClick={toggleYours} selected={filter.yours}>
            <div slot="icon" className={styles.checkbox}>
              <weave-checkbox checked={filter.yours} />
            </div>
            <span>{t(($) => $.proposalHistory.filter.onlyYours)}</span>
          </weave-menu-item>
          <weave-menu-item onClick={toggleAnalysis} selected={filter.analysis}>
            <div slot="icon" className={styles.checkbox}>
              <weave-checkbox checked={filter.analysis} />
            </div>
            <div className={styles.RowWithSub}>
              <span>{t(($) => $.proposalHistory.filter.byAnalysis)}</span>
              <div className={combineClasses([styles.MenuButton], { [styles.open]: analysisSubOpen })}>
                <weave-tooltip text={analysisSubOpen ? "" : t(($) => $.proposalHistory.filter.title)} nub="left-center">
                  <weave-icon-button
                    disabled={!filter.analysis}
                    onClick={(e) => {
                      e.stopPropagation()
                      setAnalysisSubOpen(!analysisSubOpen)
                      setDateSubOpen(false)
                    }}
                  >
                    <forma-icon-arrow-right />
                  </weave-icon-button>
                </weave-tooltip>
              </div>
            </div>
          </weave-menu-item>

          <weave-menu-item onClick={toggleDate} selected={filter.byDate} subopen>
            <div slot="icon" className={styles.checkbox}>
              <weave-checkbox checked={filter.byDate} />
            </div>
            <div className={styles.RowWithSub}>
              <span>{t(($) => $.proposalHistory.filter.byDate)}</span>
              <div className={combineClasses([styles.MenuButton], { [styles.open]: dateSubOpen })}>
                <weave-tooltip
                  text={dateSubOpen ? "" : t(($) => $.proposalHistory.filter.selectDates)}
                  nub="left-center"
                >
                  <weave-icon-button
                    disabled={!filter.byDate}
                    onClick={(e) => {
                      e.stopPropagation()
                      setDateSubOpen(!dateSubOpen)
                      setAnalysisSubOpen(false)
                    }}
                  >
                    <forma-icon-arrow-right />
                  </weave-icon-button>
                </weave-tooltip>
              </div>
            </div>
            {filter.byDate && dateSubOpen && filter.dateParams && (
              <weave-menu-sub slot="submenu">
                <div className={styles.DatePanel} onClick={(e) => e.stopPropagation()}>
                  <label>
                    {t(($) => $.proposalHistory.filter.to)}
                    <SelectDate
                      {...filter.dateParams.to}
                      onChange={(newEnd) => setDate("to", newEnd)}
                      min={dateParamToTimeStamp(filter.dateParams.from)}
                    />
                  </label>
                  <label>
                    {t(($) => $.proposalHistory.filter.from)}
                    <SelectDate
                      {...filter.dateParams.from}
                      onChange={(newStart) => setDate("from", newStart)}
                      max={dateParamToTimeStamp(filter.dateParams.to)}
                    />
                  </label>
                </div>
              </weave-menu-sub>
            )}
          </weave-menu-item>
        </weave-menu>
        <weave-menu
          open={filter.analysis && analysisSubOpen}
          noedit
          nochecks
          title={t(($) => $.proposalHistory.filter.byAnalysis)}
          top={76}
          left={304}
          maxwidth={280}
          minwidth={220}
        >
          <weave-tooltip slot="headericons" nub="down-center" text={t(($) => $.ui.close)}>
            <weave-icon-button onClick={() => setAnalysisSubOpen(false)}>
              <CloseIcon />
            </weave-icon-button>
          </weave-tooltip>
          {objectKeys(filter.analysisTypes).map((analysisType) => (
            <weave-menu-item
              key={analysisType}
              selected={filter.analysisTypes[analysisType]}
              onClick={(e) => {
                e.stopPropagation()
                toggleAnalysisType(analysisType)
              }}
            >
              <div slot="icon" className={styles.checkbox}>
                <weave-checkbox checked={filter.analysisTypes[analysisType]} />
              </div>
              <span>{ANALYSIS_TYPE_LABEL[analysisType]}</span>
            </weave-menu-item>
          ))}
        </weave-menu>
      </ClickOutside>
    </div>
  )
}
