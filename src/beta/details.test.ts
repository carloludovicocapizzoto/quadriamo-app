import { expect, it } from 'vitest'
import { cloudFeature } from '../features'
import { technicalDetails } from './details'

const device = { platform: 'android', os: 'Android 15', installed: true, lang: 'it', screen: '412x919@2.6', online: true, env: 'alpha', release: '0.20.1+213', commit: '0123456789abcdef' }

it('the technical details of an Alpha report carry no amounts, descriptions, emails or ids', () => {
  const cloud = { status: 'conflict', base: { revision: '7', mode: 'protected', document: { transactions: [{ description: 'Veterinario Fido', amount: 123.45 }], profile: { email: 'tester-a@example.test' } } },
    pending: { id: 'op-secret-id', document: { settings: { events: [{ title: 'Netflix', amount: 12.99 }] } } }, conflict: { paths: ['/settings/events/s1/amount'] }, recovery: [{}, {}] }
  const text = technicalDetails(device as never, { status: 'conflict' }, cloud as never, null, true, new Date('2026-10-26T10:00:00Z'))
  expect(text).toContain('revisione 7'); expect(text).toContain('conflitti 1'); expect(text).toContain('copie di recupero 2')
  for (const secret of ['Veterinario', '123.45', 'Netflix', '12.99', 'events/s1', 'example.test', 'op-secret-id']) expect(text).not.toContain(secret)
})
it('in the Alpha the functions without a gateway route are switched off; elsewhere nothing changes', () => {
  for (const f of ['shared', 'news', 'feedback', 'telemetry', 'research', 'errorReports', 'econEvents', 'invite'] as const) {
    expect(cloudFeature(f, 'alpha')).toBe(false); expect(cloudFeature(f, 'production')).toBe(true); expect(cloudFeature(f, 'development')).toBe(true)
  }
})
it('an Alpha build can switch a function back on with a cloud:<name> flag, only that one', () => {
  expect(cloudFeature('news', 'alpha', new Set(['news']))).toBe(true)
  expect(cloudFeature('shared', 'alpha', new Set(['news']))).toBe(false)
  expect(cloudFeature('news', 'alpha', new Set())).toBe(false)
})
