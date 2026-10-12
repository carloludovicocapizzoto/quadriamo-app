import { nextMonth, prevMonth, type ClassifiedTx, type MonthResult, type YearMonth } from '../../engine'
import { Swipe } from '../kit/Swipe'
import { useI18n } from '../../i18n/core'
import type { AppData } from '../../store/state'
import { tap } from '../kit/motion'
import { MonthNav } from '../MonthNav'
import { MonthView } from '../MonthView'
import { InvestmentsView } from '../InvestmentsView'
import { ProGate } from '../Pro'
import { CategoryChangesReport, ForecastReport, TrendReport } from '../Reports'
import { YearNav, YearView } from '../YearView'

export type AnalysisView = 'month' | 'year' | 'investments'

/** Analisi: mese, anno e investimenti in una pagina, con le schede in alto (come le sezioni di un'app). */
export function AnalysisScreen({ view, onView, data, result, current, homeResult, today, year, onYear, onMonth, onOpen }: {
  view: AnalysisView; onView: (v: AnalysisView) => void; data: AppData; result: MonthResult; current: YearMonth; homeResult: MonthResult
  today: string; year: number; onYear: (y: number) => void; onMonth: (ym: YearMonth) => void; onOpen: (tx: ClassifiedTx) => void
}) {
  const { t } = useI18n()
  const isNow = current.year === homeResult.ym.year && current.month === homeResult.ym.month
  return (
    <div className="screen">
      <h1 className="screen-title">{t('nav.analysis')}</h1>
      <div className="segmented" role="tablist">
        {(['month', 'year', 'investments'] as const).map(v => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => { tap(); onView(v) }}>
            {t(v === 'month' ? 'ana.month' : v === 'year' ? 'ana.year' : 'ana.invest')}</button>))}
        <span className="seg-pill" style={{ transform: `translateX(${['month', 'year', 'investments'].indexOf(view) * 100}%)` }} />
      </div>

      <div key={view} className="view-in">
        {view === 'month' && <>
          <MonthNav ym={current} onChange={onMonth} />
          <Swipe id={`${current.year}-${current.month}`} onPrev={() => onMonth(prevMonth(current))} onNext={() => onMonth(nextMonth(current))} hint>
          {isNow && <section className="card widget"><div className="w-head"><h3 className="h-plain">{t('w.forecast')}</h3></div>
            <ProGate feature="reports" compact><ForecastReport r={result} settings={data.settings} today={today} /></ProGate></section>}
          <MonthView r={result} settings={data.settings} onOpen={onOpen} today={today} />
          </Swipe>
        </>}
        {view === 'year' && <>
          <YearNav year={year} onChange={onYear} />
          <Swipe id={String(year)} onPrev={() => onYear(year - 1)} onNext={() => onYear(year + 1)}>
          {year === homeResult.ym.year && <ProGate feature="reports"><div className="widgets report-grid">
            <section className="card widget"><div className="w-head"><h3 className="h-plain">{t('w.trend')}</h3></div>
              <TrendReport r={homeResult} txs={data.transactions} settings={data.settings} today={today} /></section>
            <section className="card widget"><div className="w-head"><h3 className="h-plain">{t('w.growing')}</h3></div>
              <CategoryChangesReport r={homeResult} txs={data.transactions} settings={data.settings} today={today} /></section>
          </div></ProGate>}
          <YearView year={year} transactions={data.transactions} settings={data.settings} today={today} onYear={onYear}
                    onOpenMonth={m => { onMonth(m); onView('month'); window.scrollTo(0, 0) }} />
          </Swipe>
        </>}
        {view === 'investments' && <ProGate feature="investments">
          <InvestmentsView settings={data.settings} transactions={data.transactions} today={today} year={year} onYear={onYear} /></ProGate>}
      </div>
    </div>
  )
}
