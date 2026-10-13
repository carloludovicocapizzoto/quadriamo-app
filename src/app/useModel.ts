// Il "modello" della pagina: oggi, il mese guardato, il mese in corso, lo slancio. Calcolato una volta qui.
import { useMemo } from 'react'
import { computeMonth, monthOf, streakOf, todayIso, type YearMonth } from '../engine'
import type { AppData } from '../store/state'
import type { Route } from './router'

export function useModel(data: AppData | null, route: Route) {
  const today = todayIso()
  const viewed: YearMonth | null = useMemo(() => {
    if (!data) return null
    if (route.tab === 'analysis' && route.month) return { year: Number(route.month.slice(0, 4)), month: Number(route.month.slice(5, 7)) }
    return monthOf(today, data.settings.monthStartDay)
  }, [data, route, today])
  const month = useMemo(() => data && viewed ? computeMonth(viewed, data.transactions, data.settings, today) : null, [data, viewed, today])
  const thisMonth = useMemo(() => data ? computeMonth(monthOf(today, data.settings.monthStartDay), data.transactions, data.settings, today) : null, [data, today])
  const streak = useMemo(() => data ? streakOf(data.activity ?? [], today) : null, [data, today])
  return { today, viewed, month, thisMonth, streak }
}

export const ymKey = (ym: YearMonth) => `${ym.year}-${String(ym.month).padStart(2, '0')}`
