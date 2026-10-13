import type { Category } from '../engine'
import { useI18n } from '../i18n/core'
import { Money } from './kit/Money'
import { categoryName } from './names'

/** Dove sono andati i soldi: categorie dalla più grande, con una barra sottile in proporzione alla prima. Mese e Anno. */
export function ByCategory({ rows, currency }: { rows: { category: Category; amount: number }[]; currency: string }) {
  const { t } = useI18n()
  const list = rows.filter(c => c.amount !== 0).sort((a, b) => b.amount - a.amount)
  const top = list[0]?.amount || 1
  if (!list.length) return null
  return (
    <ul className="by-cat">
      {list.map(c => (
        <li key={c.category.id}>
          <span className="by-cat-name">{categoryName(c.category, t)}</span>
          <Money className="by-cat-amount" value={c.amount} currency={currency} />
          <span className="by-cat-bar" aria-hidden="true"><span style={{ transform: `scaleX(${c.amount / top})` }} /></span>
        </li>
      ))}
    </ul>
  )
}
