import { describe, expect, it } from 'vitest'
import pkg from '../../package.json'
import { LICENSES, PACKAGES } from './licenses'

describe('licenze open source', () => {
  it('ogni dipendenza che arriva sul telefono è dichiarata nel Profilo', () => {
    for (const dep of Object.keys(pkg.dependencies)) {
      expect(PACKAGES[dep], `manca ${dep} in profile/licenses.ts`).toBeDefined()
      expect(LICENSES.some(l => l.name === PACKAGES[dep])).toBe(true)
    }
  })
})
