import { useMemo } from 'react'
import { demoData } from './demo'
import { computeMonth, todayIso } from './engine'
import { LANGS, defaultNames, useI18n, type Lang } from './i18n/core'

const BUCKET_COLORS = ['var(--b1)', 'var(--b2)', 'var(--b3)', 'var(--b4)']

export default function App() {
  const { t, lang, setLang, money } = useI18n()
  const today = todayIso()
  const [year, month] = today.split('-').map(Number)

  const m = useMemo(() => {
    const { settings, txs } = demoData(defaultNames(lang), year, month)
    // nell'anteprima i ricorrenti contano tutti, così il mese di esempio è completo
    return { settings, r: computeMonth({ year, month }, txs, settings, '9999-12-31') }
  }, [lang, year, month])
  const cur = m.settings.currency
  const issues = Object.values(m.r.checks).reduce((a, b) => a + b, 0)

  return (
    <div className="app">
      <header className="top">
        <div className="logo">Quadriamo<span>.</span></div>
        <label className="lang">
          <span className="sr-only">{t('lang.label')}</span>
          <select value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label={t('lang.label')}>
            {Object.entries(LANGS).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
      </header>

      <main>
        <h1>{t('app.tagline')}</h1>
        <p className="muted">{t('app.rule')}</p>

        <section className="card" aria-labelledby="month-title">
          <div className="card-head">
            <h2 id="month-title">{t('month.title')} · {t(`m.${month}` as 'm.1')}</h2>
            <span className={issues ? 'pill bad' : 'pill good'}>{issues ? t('checks.fix') : t('checks.allGood')}</span>
          </div>
          <dl className="summary">
            {([['month.income', m.r.income], ['month.spent', m.r.spent], ['month.saved', m.r.saved],
               ['month.leftOver', m.r.leftOver]] as const).map(([k, v]) => (
              <div key={k}><dt>{t(k)}</dt><dd>{money(v, cur)}</dd></div>
            ))}
          </dl>
        </section>

        <section className="buckets">
          {m.r.buckets.map((b, i) => {
            const used = b.available > 0 ? Math.min(1, b.spent / b.available) : 0
            return (
              <article key={b.bucket.id} className="card bucket">
                <div className="card-head">
                  <h3><i style={{ background: BUCKET_COLORS[i] }} />{b.bucket.name}</h3>
                  <span className="muted small">{Math.round(b.bucket.share * 100)}%</span>
                </div>
                <div className={b.remaining < 0 ? 'big bad-text' : 'big'}>{money(b.remaining, cur)}</div>
                <div className="muted small">{t('bucket.remaining')}</div>
                <div className="bar" role="presentation"><div style={{ width: `${used * 100}%`, background: BUCKET_COLORS[i] }} /></div>
                <div className="row small muted">
                  <span>{t('bucket.spent')} {money(b.spent, cur)}</span>
                  <span>{t('bucket.available')} {money(b.available, cur)}</span>
                </div>
              </article>
            )
          })}
        </section>

        <p className="muted small">{t('demo.note')}</p>
        <p className="muted small">{t('install.hint')}</p>
      </main>
    </div>
  )
}
