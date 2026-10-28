import { expect, it } from 'vitest'
import { createInitial, planImport, reducer, mergeData, type State } from './state'

it.each(['EUR', 'USD', 'GBP', 'JPY', 'KWD'])('legacy-only %s matches require review; either decision survives reload and merge', currency => {
  for (const decision of ['ignoreInbox', 'confirmInbox'] as const) {
    let state: State = { loaded: true, data: createInitial(currency, '2026-10-01') }
    const amount = currency === 'KWD' ? -1.234 : -5
    const row = { date: '2026-10-28', description: 'QA Bonifico', amount, currency: null }
    state.data!.importDone = { [`${row.date}|${amount.toFixed(2)}|qa bonifico`]: '2026-10-20T00:00:00Z' }
    const plan = planImport(state.data!, [row, row])
    expect(plan.items[0]?.maybeImported).toBe(true)
    expect(plan.items).toHaveLength(2)
    expect(new Set(plan.items.map(i => i.fingerprint)).size).toBe(2)
    state = reducer(state, { type: 'addInbox', items: plan.items })
    const before = JSON.parse(JSON.stringify(state.data!))
    for (const item of plan.items) state = reducer(state, decision === 'ignoreInbox'
      ? { type: decision, ids: [item.id] }
      : { type: decision, ids: [item.id], txs: [{ id: item.id, date: item.date, amount: Math.abs(item.amount), category: 'other', currency: item.currency, description: item.description }] })
    const restored = JSON.parse(JSON.stringify(state.data!))
    const merged = mergeData(before, restored)
    expect(planImport(merged, [row, row])).toMatchObject({ items: [], duplicates: 2 })
    expect(merged.inbox).toEqual([])
  }
})
