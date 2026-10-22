// Le azioni che cambiano i dati: funzioni pure, testate in state.test.ts. Le azioni dell'utente alimentano lo slancio.
import { seedRules, withDay } from '../engine'
import { migrate } from './migrate'
import { newId, widenFirstMonth } from './model'
import type { Action, State } from './types'

/** Giorno locale (YYYY-MM-DD) di un istante. */
function localDay(at: string): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Le azioni con cui l'utente aggiorna la sua situazione contano per lo slancio. */
const ACTIVE: Action['type'][] = ['addTx', 'updateTx', 'deleteTx', 'confirmInbox', 'goalMoney']

export function reducer(state: State, a: Action): State {
  const next = reduce(state, a)
  if (!ACTIVE.includes(a.type) || !next.data || next.data === state.data || next.data.demo) return next
  const day = localDay(('at' in a && a.at) || new Date().toISOString())
  return { ...next, data: { ...next.data, activity: withDay(next.data.activity, day) } }
}

function reduce(state: State, a: Action): State {
  if (a.type === 'load') return { loaded: true, data: migrate(a.data) }
  if (a.type === 'replace') return { ...state, data: migrate(a.data) }
  const d = state.data
  if (!d) return state
  const at = ('at' in a && a.at) || new Date().toISOString()
  switch (a.type) {
    case 'addTx': {
      const tx = { ...a.tx, updatedAt: at }
      return { ...state, data: { ...d, settings: widenFirstMonth(d.settings, tx), transactions: [...d.transactions, tx] } }
    }
    case 'updateTx': {
      const tx = { ...a.tx, updatedAt: at }
      return { ...state, data: { ...d, settings: widenFirstMonth(d.settings, tx),
                                 transactions: d.transactions.map(t => t.id === tx.id ? tx : t) } }
    }
    case 'deleteTx':
      return { ...state, data: { ...d, transactions: d.transactions.filter(t => t.id !== a.id),
                                 deleted: { ...d.deleted, [a.id]: at } } }
    case 'setSettings':
      return { ...state, data: { ...d, settings: a.settings, settingsUpdatedAt: at } }
    case 'setFx':
      // sulle impostazioni attuali e senza toccare settingsUpdatedAt: un download di dati pubblici non deve far
      // sembrare "più nuova" una copia vecchia (era la causa degli abbonamenti persi tra due dispositivi)
      if (d.settings.currency !== a.currency) return state
      return { ...state, data: { ...d, settings: { ...d.settings, fxRates: { ...d.settings.fxRates, ...a.rates }, fxDate: a.date } } }
    case 'saveGoal': {
      const g = { ...a.goal, updatedAt: at }
      const goals = (d.goals ?? []).some(x => x.id === g.id) ? (d.goals ?? []).map(x => x.id === g.id ? g : x) : [...(d.goals ?? []), g]
      return { ...state, data: { ...d, goals } }
    }
    case 'deleteGoal':
      return { ...state, data: { ...d, goals: (d.goals ?? []).map(x => x.id === a.id ? { ...x, removed: true, contributions: [], updatedAt: at } : x) } }
    case 'goalMoney':
      return { ...state, data: { ...d, goals: (d.goals ?? []).map(x => x.id === a.id
        ? { ...x, contributions: [...x.contributions, { id: newId(), date: a.date, amount: Math.round(a.amount * 100) / 100 }], updatedAt: at } : x) } }
    case 'setProfile':
      return { ...state, data: { ...d, profile: a.profile ?? undefined, profileUpdatedAt: at } }
    case 'setInvestments':
      return { ...state, data: { ...d, investments: a.investments, investmentsUpdatedAt: at } }
    case 'addInbox':
      return { ...state, data: { ...d, inbox: [...(d.inbox ?? []), ...a.items] } }
    case 'updateInbox':
      return { ...state, data: { ...d, inbox: (d.inbox ?? []).map(i => i.id === a.item.id ? a.item : i) } }
    case 'confirmInbox':
    case 'ignoreInbox': {
      const done = { ...d.importDone }
      for (const i of d.inbox ?? []) if (a.ids.includes(i.id)) done[i.fingerprint] = at
      let settings = d.settings, settingsUpdatedAt = d.settingsUpdatedAt
      let transactions = d.transactions
      if (a.type === 'confirmInbox') {
        const txs = a.txs.map(tx => ({ ...tx, updatedAt: at }))
        transactions = [...transactions, ...txs]
        for (const tx of txs) settings = widenFirstMonth(settings, tx)
        if (a.rule) { settings = { ...settings, rules: [...(settings.rules ?? seedRules()), a.rule] }; settingsUpdatedAt = at }
      }
      return { ...state, data: { ...d, settings, settingsUpdatedAt, transactions, importDone: done,
                                 inbox: (d.inbox ?? []).filter(i => !a.ids.includes(i.id)) } }
    }
    case 'togglePayday': {
      const cur = d.payday?.[a.month] ?? []
      const next = cur.includes(a.bucketId) ? cur.filter(b => b !== a.bucketId) : [...cur, a.bucketId]
      return { ...state, data: { ...d, payday: { ...d.payday, [a.month]: next } } }
    }
  }
}
