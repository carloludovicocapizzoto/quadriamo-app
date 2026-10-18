import { equal } from './protocol'
export interface Difference { path: string[]; value: unknown }
/** Tutte le differenze scalari, comprese quelle di campi non conosciuti dal client. Solo presentazione. */
export function differences(current: unknown, other: unknown, path: string[] = []): Difference[] {
  if (equal(current, other)) return []
  if (current && typeof current === 'object') {
    const entries = [...new Set([...Object.keys(current), ...Object.keys(other && typeof other === 'object' ? other : {})])]
      .map(key => [key, (current as Record<string, unknown>)[key]] as const)
    if (!entries.length) return [{ path, value: Array.isArray(current) ? '[]' : '{}' }]
    return entries.flatMap(([key, value]) => differences(value, other && typeof other === 'object' ? (other as Record<string, unknown>)[key] : undefined, [...path, key]))
  }
  return [{ path, value: current }]
}
