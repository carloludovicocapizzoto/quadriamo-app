import { splitTotal, type Bucket } from '../engine'
import { useI18n } from '../i18n/core'
import { parseAmount } from './kit/amount'
import { decimalText } from './kit/decimal'
import { BUCKET_COLORS, bucketName } from './names'

// la quota in percentuale, con i decimali della lingua
const pct = (x: number, lang: string) => decimalText(Math.round(x * 1000) / 10, lang)

/** Quanto di un'entrata va in ogni parte, in percentuale: una riga per parte, il totale deve fare 100%. */
export function SplitEditor({ buckets, value, onChange }: {
  buckets: Bucket[]; value: Record<string, number> | null | undefined; onChange: (v: Record<string, number>) => void
}) {
  const { t, lang } = useI18n()
  const v = value ?? {}
  const total = splitTotal(v)
  return (
    <div className="split-edit">
      {buckets.map((b, i) => (
        <label key={b.id} className="split-row">
          <span><i style={{ background: BUCKET_COLORS[i] }} />{bucketName(b, t)}</span>
          <span className="unit"><input inputMode="decimal" placeholder="0" defaultValue={v[b.id] ? pct(v[b.id], lang) : ''} aria-label={bucketName(b, t)}
            onChange={e => onChange({ ...v, [b.id]: (parseAmount(e.target.value) ?? 0) / 100 })} /><span aria-hidden>%</span></span>
        </label>
      ))}
      <p className={`split-total${total === 1 ? '' : ' bad'}`}>{total === 1 ? t('split.total', { n: 100 }) : t('split.err', { n: pct(total, lang) })}</p>
    </div>
  )
}
