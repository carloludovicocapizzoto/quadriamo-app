// Galleria dei widget (come quella di Apple): anteprime vere, − per togliere, + per aggiungere, S/M/L per la dimensione,
// riordino trascinando (mouse, oppure dito tenendo premuto). Ogni modifica si salva subito e si vede sulla Home dietro.
// Il riordino è fisico: gli altri widget scivolano al loro posto con la molla (FLIP), interrompibile in ogni momento.
import { useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { useStore } from '../../store/context'
import { reducedMotion } from '../../app/prefs'
import { Icon } from '../Icon'
import { tap } from '../kit/motion'
import { DEFAULT_WIDGETS, WIDGETS, isFav, sizeOf, type WidgetId, type WidgetSize } from './catalog'
import { Widget, type WidgetCtx } from './widgets'

const k = (s: string) => s as keyof Dict

/** Le posizioni prima di un cambio d'ordine: dopo il disegno, ogni anteprima parte da dov'era e scivola al suo posto. */
function useFlip(keys: string[]) {
  const key = keys.join()
  const nodes = useRef(new Map<string, HTMLElement>())
  const before = useRef(new Map<string, DOMRect>())
  const remember = () => { before.current = new Map([...nodes.current].map(([id, el]) => [id, el.getBoundingClientRect()])) }
  useLayoutEffect(() => {
    if (reducedMotion()) return
    for (const [id, el] of nodes.current) {
      const a = before.current.get(id), b = el.getBoundingClientRect()
      if (!a || el.classList.contains('lifted')) continue
      const dx = a.left - b.left, dy = a.top - b.top
      if (!dx && !dy) continue
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration: 420, easing: getComputedStyle(document.documentElement).getPropertyValue('--spring-snappy').trim() || 'ease-out' })
    }
    before.current.clear()
  }, [key])
  const ref = (id: string) => (el: HTMLElement | null) => { if (el) nodes.current.set(id, el); else nodes.current.delete(id) }
  return { ref, remember }
}

export function WidgetGallery({ ids, ctx }: { ids: WidgetId[]; ctx: WidgetCtx }) {
  const { t } = useI18n()
  const { state, dispatch } = useStore()
  const settings = state.data!.settings
  const save = (patch: Partial<typeof settings>) => dispatch({ type: 'setSettings', settings: { ...settings, ...patch } })
  const [order, setOrder] = useState(ids)
  const flip = useFlip(order)
  const [lifted, setLifted] = useState<WidgetId | null>(null)
  const drag = useRef<{ id: WidgetId; x: number; y: number; el: HTMLElement; timer?: number; on: boolean } | null>(null)

  const commit = (next: WidgetId[]) => { flip.remember(); setOrder(next); save({ homeWidgets: next }) }
  const remove = (id: WidgetId) => { tap(); commit(order.filter(x => x !== id)) }
  const add = (id: WidgetId) => { tap(); commit([...order, id]) }
  const fav = (id: WidgetId) => { tap(); const list = settings.homeFavs ?? []; save({ homeFavs: list.includes(id) ? list.filter(x => x !== id) : [...list, id] }) }
  const resize = (id: WidgetId, z: WidgetSize) => { tap(); save({ homeWidgetSizes: { ...settings.homeWidgetSizes, [id]: z } }) }
  const available = WIDGETS.filter(w => !order.includes(w))

  // trascinare: col mouse subito, col dito dopo una breve pressione (così lo scorrimento della pagina resta libero)
  const down = (id: WidgetId) => (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    const el = e.currentTarget
    drag.current = { id, x: e.clientX, y: e.clientY, el, on: false }
    const start = () => { if (!drag.current) return; drag.current.on = true; setLifted(id); el.setPointerCapture(e.pointerId); tap() }
    if (e.pointerType === 'mouse') start(); else drag.current.timer = window.setTimeout(start, 280)
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (!d.on) { if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) { clearTimeout(d.timer); drag.current = null } return }
    e.preventDefault()
    d.el.style.transform = `translate(${e.clientX - d.x}px, ${e.clientY - d.y}px) scale(1.03)`
    // sopra quale anteprima siamo: il widget trascinato prende il suo posto
    d.el.style.pointerEvents = 'none'
    const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-tile]')
    d.el.style.pointerEvents = ''
    const target = over?.dataset.tile as WidgetId | undefined
    if (target && target !== d.id) {
      const from = order.indexOf(d.id), to = order.indexOf(target)
      const next = [...order]; next.splice(from, 1); next.splice(to, 0, d.id)
      const r0 = d.el.getBoundingClientRect()
      flip.remember(); setOrder(next)
      // il punto di partenza segue il nuovo posto, così il widget resta sotto il dito
      requestAnimationFrame(() => { const r1 = d.el.getBoundingClientRect(); d.x += r1.left - r0.left; d.y += r1.top - r0.top })
    }
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    clearTimeout(d.timer)
    if (!d.on) return
    d.el.style.transform = ''
    setLifted(null)
    save({ homeWidgets: order })
  }

  return (
    <div className="wg">
      <p className="wg-hint">{t('wg.hint')}</p>
      <h3 className="group-title">{t('wg.inHome')}</h3>
      <ul className="wg-grid" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {order.map(id => (
          <li key={id} ref={flip.ref(id)} data-tile={id} className={`wg-tile size-${sizeOf(settings, id)}${lifted === id ? ' lifted' : ''}`} onPointerDown={down(id)}>
            <div className="wg-preview" aria-hidden="true"><div className="wg-scale"><Widget id={id} c={ctx} /></div>
              <p className="wg-empty">{t(k(`hw.${id}D`))}</p></div>
            <div className="wg-foot">
              <button className={`wg-fav${isFav(settings, id) ? ' on' : ''}`} aria-pressed={isFav(settings, id)} aria-label={t('wg.fav')} title={t('wg.fav')}
                onClick={() => fav(id)}><Icon name="star" size={16} /></button>
              <span className="wg-name">{t(k(`hw.${id}`))}</span>
              <span className="chips wg-sizes" role="radiogroup" aria-label={t('hw.size')}>{(['s', 'm', 'l'] as WidgetSize[]).map(z => (
                <button key={z} role="radio" aria-checked={sizeOf(settings, id) === z} className={sizeOf(settings, id) === z ? 'on' : ''} onClick={() => resize(id, z)}>{t(k(`hw.size.${z}`))}</button>))}</span>
            </div>
            <button className="wg-btn remove" onClick={() => remove(id)} aria-label={t('wg.remove', { name: t(k(`hw.${id}`)) })}><Icon name="minus" size={14} /></button>
          </li>
        ))}
      </ul>

      {available.length > 0 && <>
        <h3 className="group-title">{t('wg.add')}</h3>
        <ul className="wg-grid">
          {available.map(id => (
            <li key={id} ref={flip.ref(id)} className="wg-tile size-s off">
              <div className="wg-preview" aria-hidden="true"><div className="wg-scale"><Widget id={id} c={ctx} /></div>
                <p className="wg-empty">{t(k(`hw.${id}D`))}</p></div>
              <div className="wg-foot"><span className="wg-name">{t(k(`hw.${id}`))}</span></div>
              <button className="wg-btn add" onClick={() => add(id)} aria-label={t('wg.addOne', { name: t(k(`hw.${id}`)) })}><Icon name="plus" size={14} /></button>
            </li>
          ))}
        </ul>
      </>}
      <button className="link-btn top-gap" onClick={() => { tap(); commit(DEFAULT_WIDGETS) }}>{t('hw.reset')}</button>
    </div>
  )
}
