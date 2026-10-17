import { describe, expect, it } from 'vitest'
import { barcode, wrap } from './model'

describe('ricevuta: righe', () => {
  it('va a capo a parole, senza superare la larghezza', () => {
    expect(wrap('Hai segnato spese in 10 giorni su 17', 20)).toEqual(['Hai segnato spese in', '10 giorni su 17'])
    expect(wrap('parolalunghissimasenzaspazi', 10)).toEqual(['parolalung'])
  })
  it('il codice a barre è sempre lo stesso per lo stesso mese', () => {
    expect(barcode('202610')).toEqual(barcode('202610'))
    expect(barcode('202610')).not.toEqual(barcode('202609'))
    expect(barcode('202610').every(b => b >= 1 && b <= 3)).toBe(true)
  })
})
