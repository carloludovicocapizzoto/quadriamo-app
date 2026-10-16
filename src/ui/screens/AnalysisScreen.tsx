import { nextMonth, prevMonth, type ClassifiedTx, type MonthResult, type YearMonth } from '../../engine'
import { Segmented } from '../kit/Segmented'
import { Swipe } from '../kit/Swipe'
import { useI18n } from '../../i18n/core'
import type { AppData } from '../../store/state'
import { MonthNav } from '../MonthNav'
import { MonthView } from '../MonthView'
import { InvestmentsView } from '../InvestmentsView'
import { ProGate } from '../Pro'
import { YearNav, YearView } from '../YearView'
import { TransactionsScreen } from './TransactionsScreen'

import { ANALYSIS_LABEL, ANALYSIS_VIEWS, type AnalysisView } from '../../app/router'

/** Analisi: mese, anno e investimenti in una pagina, con le schede in alto (come le sezioni di un'app). */
export function AnalysisScreen({ view, onView, data, result, current, homeResult, today, year, onYear, onMonth, onOpen }: {
  view: AnalysisView; onView: (v: AnalysisView) => void; data: AppData; result: MonthResult; current: YearMonth; homeResult: MonthResult
  today: string; year: number; onYear: (y: number) => void; onMonth: (ym: YearMonth) => void; onOpen: (tx: ClassifiedTx) => void
}) {
  const { t } = useI18n()
  const inbox = data.inbox?.length ?? 0
  return (
    <div className="screen screen-wide">
      <h1 className="screen-title">{t('nav.analysis')}</h1>
      <Segmented value={view} onChange={onView} options={ANALYSIS_VIEWS.map(v => ({ id: v, badge: v === 'transactions' ? inbox : 0,
        label: t(ANALYSIS_LABEL[v]) }))} />

      <div key={view} className="view-in">
        {view === 'transactions' && <TransactionsScreen embedded data={data} current={current} result={result} today={today} onMonth={onMonth} onOpen={onOpen} />}
        {view === 'month' && <>
          <MonthNav ym={current} onChange={onMonth} />
          <Swipe id={`${current.year}-${current.month}`} onPrev={() => onMonth(prevMonth(current))} onNext={() => onMonth(nextMonth(current))} hint>
          <MonthView r={result} settings={data.settings} onOpen={onOpen} today={today} />
          </Swipe>
        </>}
        {view === 'year' && <>
          <YearNav year={year} onChange={onYear} />
          <Swipe id={String(year)} onPrev={() => onYear(year - 1)} onNext={() => onYear(year + 1)}>
          <YearView year={year} transactions={data.transactions} settings={data.settings} today={today} current={homeResult} onYear={onYear}
                    onOpenMonth={m => { onMonth(m); onView('month'); window.scrollTo(0, 0) }} />
          </Swipe>
        </>}
        {view === 'investments' && <ProGate feature="investments">
          <InvestmentsView settings={data.settings} transactions={data.transactions} today={today} year={year} onYear={onYear} /></ProGate>}
      </div>
    </div>
  )
}
