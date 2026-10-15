// Il negozio dei dati dell'app, diviso per responsabilità. Questo file è solo il punto d'ingresso:
// types (dati e azioni) · model (identificativi, dati iniziali) · reducer (azioni) · migrate (versioni vecchie)
// importing (estratto conto) · merge (sincronizzazione) · backup (JSON e CSV) · validate (impostazioni).
export * from './types'
export * from './model'
export * from './reducer'
export * from './migrate'
export * from './importing'
export * from './merge'
export * from './backup'
export * from './validate'
