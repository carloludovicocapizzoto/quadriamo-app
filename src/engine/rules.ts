// Regole a parole chiave: riconoscono una transazione dalla descrizione e propongono categoria e bucket.
// L'utente può sempre cambiare la proposta; le correzioni possono diventare nuove regole.
import type { Settings } from './types'

export interface Rule {
  id: string
  keyword: string            // cercata dentro la descrizione, senza maiuscole/accenti
  category: string           // id categoria
  paidFrom?: string | null   // bucket da cui pagare (facoltativo)
  enabled: boolean
}

export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Regole di partenza per negozi e servizi comuni in Europa (si possono modificare o disattivare). */
const SEED: [string, string][] = [
  ['esselunga', 'groceries'], ['coop', 'groceries'], ['conad', 'groceries'], ['lidl', 'groceries'], ['carrefour', 'groceries'],
  ['aldi', 'groceries'], ['eurospin', 'groceries'], ['pam', 'groceries'], ['penny', 'groceries'], ['mercadona', 'groceries'],
  ['auchan', 'groceries'], ['leclerc', 'groceries'], ['supermercato', 'groceries'], ['supermarket', 'groceries'],
  ['netflix', 'fixedCosts'], ['spotify', 'fixedCosts'], ['disney', 'fixedCosts'], ['icloud', 'fixedCosts'],
  ['vodafone', 'fixedCosts'], ['iliad', 'fixedCosts'], ['tim ', 'fixedCosts'], ['windtre', 'fixedCosts'], ['fastweb', 'fixedCosts'],
  ['enel', 'fixedCosts'], ['affitto', 'rent'], ['rent', 'rent'],
  ['eni', 'transport'], ['q8', 'transport'], ['tamoil', 'transport'], ['esso', 'transport'], ['shell', 'transport'],
  ['trenitalia', 'transport'], ['italo', 'transport'], ['atm', 'transport'], ['uber', 'transport'], ['flixbus', 'transport'],
  ['ryanair', 'transport'], ['easyjet', 'transport'], ['telepass', 'transport'],
  ['farmacia', 'health'], ['pharmacy', 'health'], ['farmacie', 'health'],
  ['mcdonald', 'eatingOut'], ['deliveroo', 'eatingOut'], ['glovo', 'eatingOut'], ['just eat', 'eatingOut'], ['starbucks', 'eatingOut'],
  ['pizzeria', 'eatingOut'], ['ristorante', 'eatingOut'], ['restaurant', 'eatingOut'], ['bar ', 'eatingOut'], ['burger', 'eatingOut'],
  ['amazon', 'funShopping'], ['zalando', 'funShopping'], ['ikea', 'funShopping'], ['decathlon', 'funShopping'], ['cinema', 'funShopping'],
  ['trade republic', 'investmentsSaving'], ['scalable', 'investmentsSaving'], ['degiro', 'investmentsSaving'], ['directa', 'investmentsSaving'],
  ['stipendio', 'salary'], ['salary', 'salary'], ['payroll', 'salary'], ['emolumenti', 'salary'],
  ['findomestic', 'loans'], ['agos ducato', 'loans'], ['compass banca', 'loans'], ['klarna', 'loans'], ['scalapay', 'loans'], ['rata mutuo', 'loans'],
]

export const seedRules = (): Rule[] =>
  SEED.map(([keyword, category], i) => ({ id: `seed-${i}`, keyword, category, paidFrom: null, enabled: true }))

/**
 * Proposta per una transazione: la regola con la parola chiave più lunga che compare nella descrizione.
 * Senza regole: un'entrata va in "Entrate extra", un'uscita resta senza categoria (da scegliere).
 */
export function suggest(description: string, signedAmount: number, s: Settings): { category: string | null; paidFrom: string | null; ruleId: string | null } {
  const text = ` ${normalize(description)} `
  const rules = (s.rules ?? seedRules()).filter(r => r.enabled && r.keyword.trim() && s.categories.some(c => c.id === r.category))
    .sort((a, b) => normalize(b.keyword).length - normalize(a.keyword).length)
  for (const r of rules) {
    const k = normalize(r.keyword)
    // parola intera (o frase) per evitare falsi positivi: "eni" non deve riconoscere "benissimo"
    if (text.includes(` ${k} `) || (k.length >= 5 && text.includes(k))) {
      const cat = s.categories.find(c => c.id === r.category)!
      // una regola di spesa non si applica a un'entrata e viceversa
      if ((cat.type === 'income') === (signedAmount > 0)) return { category: r.category, paidFrom: r.paidFrom ?? null, ruleId: r.id }
    }
  }
  if (signedAmount > 0 && s.categories.some(c => c.id === 'extraIncome')) return { category: 'extraIncome', paidFrom: null, ruleId: null }
  return { category: null, paidFrom: null, ruleId: null }
}

/** Parola chiave proposta quando l'utente corregge una transazione: le prime parole significative. */
export function keywordFor(description: string): string {
  const words = normalize(description).split(' ').filter(w => w.length > 2 && !/^\d+$/.test(w) &&
    !['pagamento', 'payment', 'pos', 'carta', 'card', 'acquisto', 'purchase', 'presso', 'the', 'srl', 'spa'].includes(w))
  return words.slice(0, 2).join(' ')
}
