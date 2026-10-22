import { expect, it } from 'vitest'
import { differences } from './differences'
it('shows changed, removed and previously unknown configuration values without hiding false or zero', () => {
  expect(differences({ currency: 'GBP', zero: 0, research: false, future: { fee: 1.23456 } }, { currency: 'USD', zero: 1, research: true, removed: 2 })).toEqual([
    { path: ['currency'], value: 'GBP' }, { path: ['zero'], value: 0 }, { path: ['research'], value: false }, { path: ['future', 'fee'], value: 1.23456 }, { path: ['removed'], value: undefined },
  ])
})
