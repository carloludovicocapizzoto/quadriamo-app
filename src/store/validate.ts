// Controllo delle impostazioni prima di salvarle.
import { CUSTOM, splitOk, type Settings } from '../engine'

export type SettingsError = 'sharesNot100' | 'bucketName' | 'startDay' | 'categoryName' | 'categorySplit' | 'event'

export function validateSettings(s: Settings): SettingsError[] {
  const out: SettingsError[] = []
  const total = s.buckets.reduce((a, b) => a + b.share, 0)
  if (Math.abs(total - 1) > 0.0001) out.push('sharesNot100')
  if (s.buckets.some(b => !b.name.trim())) out.push('bucketName')
  if (!Number.isInteger(s.monthStartDay) || s.monthStartDay < 1 || s.monthStartDay > 28) out.push('startDay')
  if (s.categories.some(c => !c.name.trim())) out.push('categoryName')
  if (s.categories.some(c => c.type === 'income' && c.defaultBucket === CUSTOM && !splitOk(c.split))) out.push('categorySplit')
  // un evento ha un titolo; se entra nel budget (ha una categoria) ha anche un importo e la categoria esiste
  if (s.events.some(e => !e.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || (e.repeat && !(e.repeat.every >= 1)) ||
                         (e.category != null && (!(Number(e.amount) > 0) || !s.categories.some(c => c.id === e.category))))) out.push('event')
  return out
}
