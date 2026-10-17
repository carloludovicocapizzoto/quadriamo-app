// Nuovo abbonamento, primo passo: scegli il servizio. Ricerca istantanea mentre scrivi, categorie, i più usati in griglia;
// se non c'è, lo aggiungi col nome che hai scritto. Poi si apre il modulo dell'evento già compilato (un solo modulo in tutta l'app).
import { useState } from 'react'
import { SERVICE_CATEGORIES, searchServices, type Service, type ServiceCategory } from '../../content/services'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { Icon } from '../Icon'
import { Monogram } from '../kit/Monogram'
import { tap } from '../kit/motion'

const k = (s: string) => s as keyof Dict

export function ServicePicker({ onPick }: { onPick: (s: Service | null, name: string) => void }) {
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<ServiceCategory | null>(null)
  const list = searchServices(q, cat, q ? 12 : 40)
  const browsing = !q
  return (
    <div className="sp">
      <label className="news-search"><Icon name="search" size={18} />
        <input type="search" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t('sub.search')} aria-label={t('sub.search')} enterKeyHint="search" />
      </label>
      <div className="chips sp-cats" role="tablist" aria-label={t('sub.categories')}>
        <button type="button" role="tab" aria-selected={!cat} className={`chip${!cat ? ' on' : ''}`} onClick={() => { tap(); setCat(null) }}>{q ? t('sub.all') : t('sub.popular')}</button>
        {SERVICE_CATEGORIES.map(c => <button key={c} type="button" role="tab" aria-selected={cat === c} className={`chip${cat === c ? ' on' : ''}`}
          onClick={() => { tap(); setCat(c) }}>{t(k(`sub.cat.${c}`))}</button>)}
      </div>

      {browsing ? <ul className="sp-grid" key={cat ?? 'popular'}>
        {list.map((s, i) => <li key={s.id} style={{ animationDelay: `${i * 18}ms` }}>
          <button onClick={() => { tap(); onPick(s, s.name) }}><Monogram service={s.id} name={s.name} size={52} /><span>{s.name}</span></button>
        </li>)}
      </ul> : <ul className="group-list sp-list">
        {list.map(s => <li key={s.id}><button className="row" onClick={() => { tap(); onPick(s, s.name) }}>
          <Monogram service={s.id} name={s.name} size={34} />
          <span className="row-main"><span>{s.name}</span><small>{t(k(`sub.cat.${s.category}`))}</small></span>
        </button></li>)}
        <li><button className="row" onClick={() => { tap(); onPick(null, q.trim()) }}>
          <Monogram name={q} size={34} />
          <span className="row-main"><span>{t('sub.custom', { name: q.trim() })}</span><small>{t('sub.customHint')}</small></span>
        </button></li>
      </ul>}
    </div>
  )
}
