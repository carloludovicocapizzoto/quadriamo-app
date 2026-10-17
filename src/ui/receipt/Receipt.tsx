// La ricevuta del mese: uno scontrino in carattere monospaziato, su una superficie in vetro (Costituzione, 17/10), con
// le righe di model.ts. Sotto: condividi (immagine, menu del telefono), salva l'immagine, PDF (stampa del sistema,
// "Salva come PDF"). L'immagine si crea sul telefono e non passa da nessun server.
import { useMemo, useState, type CSSProperties } from 'react'
import { makeDate, monthReceipt, prevMonth, todayIso, type YearMonth } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { useStore } from '../../store/context'
import { Icon } from '../Icon'
import { tap } from '../kit/motion'
import { bucketName, categoryName } from '../names'
import { receiptImage } from './draw'
import { barcode, receiptLines, W } from './model'

export function Receipt({ ym }: { ym: YearMonth }) {
  const { t, date, lang } = useI18n()
  const data = useStore().state.data!
  const s = data.settings
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const today = todayIso()
  const r = useMemo(() => monthReceipt(ym, data.transactions, s, today), [ym, data.transactions, s, today])
  const lines = useMemo(() => {
    const num = (n: number) => new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
    const money = (n: number) => new Intl.NumberFormat(lang, { style: 'currency', currency: s.currency }).format(n)
    const monthName = (m: YearMonth) => date(makeDate(m.year, m.month, 1), { month: 'long', year: 'numeric' })
    return receiptLines(r, {
      t: (k, v) => t(k as keyof Dict, v), money, num, monthName: monthName(ym), prevName: r.prev ? date(makeDate(prevMonth(ym).year, prevMonth(ym).month, 1), { month: 'long' }) : null,
      day: iso => date(iso, { day: 'numeric', month: 'short' }),
      catName: id => { const c = s.categories.find(c => c.id === id); return c ? categoryName(c, t) : id },
      bucketName: id => { const b = s.buckets.find(b => b.id === id); return b ? bucketName(b, t) : id },
    })
  }, [r, t, date, lang, s, ym])
  const fileName = `quadriamo-${t('rc.file')}-${ym.year}-${String(ym.month).padStart(2, '0')}.png`

  async function image(): Promise<File> { return new File([await receiptImage(lines)], fileName, { type: 'image/png' }) }
  async function share() {
    tap(); setBusy(true); setMsg('')
    try {
      const file = await image()
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Quadriamo' })
      else save(file)
    } catch { /* condivisione annullata */ } finally { setBusy(false) }
  }
  function save(file: File) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file); a.download = file.name; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    setMsg(t('rc.imageSaved'))
  }
  function pdf() {
    tap()
    document.body.classList.add('printing-receipt')
    const done = () => { document.body.classList.remove('printing-receipt'); window.removeEventListener('afterprint', done) }
    window.addEventListener('afterprint', done)
    window.print()
    setTimeout(done, 1500)
  }

  return (
    <div className="rc">
      <div className="glass-card rc-paper" style={{ '--w': W } as CSSProperties} aria-label={t('rc.title')}>
        {lines.map((l, i) => {
          const style = { animationDelay: `${Math.min(i, 30) * 22}ms` }
          switch (l.t) {
            case 'center': return <p key={i} style={style} className={`rc-center${l.big ? ' big' : ''}${l.dim ? ' dim' : ''}`}>
              {l.big ? <>{l.text.replace(/\.$/, '')}<span className="rc-dot">.</span></> : l.text}</p>
            case 'row': return <p key={i} style={style} className={`rc-row${l.bold ? ' bold' : ''}${l.dim ? ' dim' : ''}`}><span>{l.left}</span><span>{l.right}</span></p>
            case 'text': return <p key={i} style={style} className={`rc-text${l.dim ? ' dim' : ''}`}>{l.text}</p>
            case 'rule': return <hr key={i} className={l.dash ? 'dash' : ''} />
            case 'bar': return <div key={i} style={style} className="rc-bar"><p className="rc-row"><span>{l.left}</span><span>{l.right}</span></p>
              <i><b style={{ '--s': l.share } as CSSProperties} /></i></div>
            case 'barcode': return <p key={i} className="rc-barcode" aria-hidden="true">{barcode(l.seed).map((b, j) => <i key={j} style={{ width: b * 2 }} />)}</p>
            case 'gap': return <p key={i} className="rc-gap" />
          }
        })}
      </div>
      <div className="rc-actions">
        <button className="btn primary" disabled={busy} onClick={share}><Icon name="share" size={16} />{t('rc.share')}</button>
        <button className="btn" disabled={busy} onClick={async () => { tap(); setBusy(true); try { save(await image()) } finally { setBusy(false) } }}>
          <Icon name="upload" size={16} />{t('rc.image')}</button>
        <button className="btn" onClick={pdf}><Icon name="list" size={16} />PDF</button>
      </div>
      {msg && <p className="small muted rc-msg" role="status">{msg}</p>}
    </div>
  )
}
