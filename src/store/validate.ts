// Controllo delle impostazioni prima di salvarle.
import { CUSTOM, splitOk, type Settings } from '../engine'

export type SettingsError = 'sharesNot100' | 'bucketName' | 'startDay' | 'categoryName' | 'categorySplit' | 'recurring'

export function validateSettings(s: Settings): SettingsError[] {
  const out: SettingsError[] = []
  const total = s.buckets.reduce((a, b) => a + b.share, 0)
  if (Math.abs(total - 1) > 0.0001) out.push('sharesNot100')
  if (s.buckets.some(b => !b.name.trim())) out.push('bucketName')
  if (!Number.isInteger(s.monthStartDay) || s.monthStartDay < 1 || s.monthStartDay > 28) out.push('startDay')
  if (s.categories.some(c => !c.name.trim())) out.push('categoryName')
  if (s.categories.some(c => c.type === 'income' && c.defaultBucket === CUSTOM && !splitOk(c.split))) out.push('categorySplit')
  if (s.recurring.some(r => !r.name.trim() || !(r.amount > 0) || !s.categories.some(c => c.id === r.category) ||
                            (r.day != null && (r.day < 1 || r.day > 31)))) out.push('recurring')
  return out
}
