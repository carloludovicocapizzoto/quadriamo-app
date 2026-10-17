// Il "modello" della pagina: oggi, il mese guardato, il mese in corso, lo slancio. Calcolato una volta qui.
import { useMemo } from 'react'
import { computeMonth, monthOf, streakOf, todayIso, type YearMonth } from '../engine'
import type { AppData } from '../store/state'
import type { Route } from './router'

export function useModel(data: AppData | null, route: Route) {
  const today = todayIso()
  // il mese mostrato dipende solo dal suo valore ("2026-10"), non dall'oggetto route: cambiare sezione non lo ricalcola
  const routeMonth = route.tab === 'analysis' ? route.month ?? null : null
  const startDay = data?.settings.monthStartDay
  const viewed: YearMonth | null = useMemo(() => {
    if (startDay == null) return null
    if (routeMonth) return { year: Number(routeMonth.slice(0, 4)), month: Number(routeMonth.slice(5, 7)) }
    return monthOf(today, startDay)
  }, [routeMonth, startDay, today])
  const month = useMemo(() => data && viewed ? computeMonth(viewed, data.transactions, data.settings, today) : null, [data, viewed, today])
  const thisMonth = useMemo(() => data ? computeMonth(monthOf(today, data.settings.monthStartDay), data.transactions, data.settings, today) : null, [data, today])
  const streak = useMemo(() => data ? streakOf(data.activity ?? [], today) : null, [data, today])
  return { today, viewed, month, thisMonth, streak }
}

export const ymKey = (ym: YearMonth) => `${ym.year}-${String(ym.month).padStart(2, '0')}`
