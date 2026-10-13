import { seedRules } from './rules'
import type { Category, Recurring, Settings } from './types'

/** Regola consigliata 55-20-15-10. Gli id non cambiano mai; i nomi si traducono o si rinominano. */
export const DEFAULT_BUCKETS = [
  { id: 'essentials', share: 0.55 },
  { id: 'qualityOfLife', share: 0.20 },
  { id: 'safetyFund', share: 0.15 },
  { id: 'investments', share: 0.10 },
] as const

export const DEFAULT_CATEGORIES: Omit<Category, 'name'>[] = [
  { id: 'salary', type: 'income', defaultBucket: null },
  { id: 'extraIncome', type: 'income', defaultBucket: null },
  { id: 'fixedCosts', type: 'expense', defaultBucket: 'essentials' },
  { id: 'loans', type: 'expense', defaultBucket: 'essentials' },
  { id: 'groceries', type: 'expense', defaultBucket: 'essentials' },
  { id: 'transport', type: 'expense', defaultBucket: 'essentials' },
  { id: 'health', type: 'expense', defaultBucket: 'essentials' },
  { id: 'eatingOut', type: 'expense', defaultBucket: 'qualityOfLife' },
  { id: 'funShopping', type: 'expense', defaultBucket: 'qualityOfLife' },
  { id: 'gifts', type: 'expense', defaultBucket: 'qualityOfLife' },
  { id: 'other', type: 'expense', defaultBucket: 'essentials' },
  { id: 'safetyFundSaving', type: 'saving', defaultBucket: 'safetyFund' },
  { id: 'investmentsSaving', type: 'saving', defaultBucket: 'investments' },
]

export const DEFAULT_RECURRING: Recurring[] = [
  { name: 'Phone plan', amount: 10.99, category: 'fixedCosts', day: 5, active: true },
  { name: 'Streaming', amount: 6.99, category: 'fixedCosts', day: 18, active: true },
  { name: 'Gym', amount: 29.9, category: 'health', day: 1, active: true },
]

/** Impostazioni iniziali. `names` dà i nomi visibili (tradotti) per id; senza, si usa l'id. */
export function defaultSettings(opts: {
  currency?: string
  firstMonth: { year: number; month: number }
  names?: Record<string, string>
  recurring?: Recurring[]
}): Settings {
  const name = (id: string) => opts.names?.[id] ?? id
  return {
    currency: opts.currency ?? 'EUR',
    monthStartDay: 1,
    firstMonth: opts.firstMonth,
    buckets: DEFAULT_BUCKETS.map(b => ({ id: b.id, name: name(b.id), share: b.share, startingBalance: 0 })),
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c, name: name(c.id) })),
    recurring: opts.recurring ?? [],
    fxRates: {},
    rules: seedRules(),
    schema: 2,
  }
}
