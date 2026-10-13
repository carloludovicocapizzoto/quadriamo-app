import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { Icon, type IconName } from '../Icon'
import { tap } from '../kit/motion'

import type { Tab as MainTab } from '../../app/router'
const ITEMS: { id: MainTab; icon: IconName }[] = [
  { id: 'home', icon: 'home' }, { id: 'news', icon: 'news' }, { id: 'analysis', icon: 'year' }, { id: 'profile', icon: 'user' },
]

/** Barra in basso: Home, Notizie, + (nuovo movimento), Analisi (con i Movimenti), Profilo. */
export function BottomNav({ tab, onTab, onAdd, badge }: { tab: string; onTab: (t: MainTab) => void; onAdd: () => void; badge?: Partial<Record<MainTab, number>> }) {
  const { t } = useI18n()
  const btn = (it: typeof ITEMS[number]) => (
    <button key={it.id} className={tab === it.id ? 'on' : ''} aria-current={tab === it.id ? 'page' : undefined} onClick={() => { tap(); onTab(it.id) }}>
      <span className="nav-ico"><Icon name={it.icon} size={23} />{!!badge?.[it.id] && <em className="nav-badge">{badge[it.id]}</em>}</span>
      <span className="nav-label">{t(`nav.${it.id}` as keyof Dict)}</span>
    </button>
  )
  return (
    <nav className="tabbar" aria-label="Quadriamo">
      {ITEMS.slice(0, 2).map(btn)}
      {/* stessa struttura delle altre voci (forma + nome): così il + sta sulla loro riga, centrato su ogni dispositivo */}
      <button className="tab-add" onClick={() => { tap(); onAdd() }} aria-label={t('action.add')}>
        <span className="nav-ico"><Icon name="plus" size={22} /></span><span className="nav-label" aria-hidden="true">{t('nav.add')}</span>
      </button>
      {ITEMS.slice(2).map(btn)}
    </nav>
  )
}
