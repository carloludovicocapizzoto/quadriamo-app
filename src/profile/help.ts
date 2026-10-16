// Centro assistenza: le stesse domande e risposte dell'app e del sito, in un solo file (public/help.json, quattro lingue).
// Lì c'è anche l'email di contatto: quando c'è, "Contattaci" compare da solo nell'app e sul sito.
import { useEffect, useState } from 'react'
import { ENV } from '../env'

export interface HelpLang {
  title: string; intro: string; contactTitle: string; contactText: string; contactSoon: string
  sections: { title: string; items: { q: string; a: string }[] }[]
}
export type Help = { contact: string } & Record<'it' | 'en' | 'es' | 'fr', HelpLang>

let cache: Promise<Help | null> | null = null
const load = () => cache ??= fetch(`${ENV.base}help.json`).then(r => (r.ok ? r.json() as Promise<Help> : null)).catch(() => null)

/** Il centro assistenza (null finché non è arrivato o se non si riesce a leggerlo). */
export function useHelp(): Help | null {
  const [help, setHelp] = useState<Help | null>(null)
  useEffect(() => { let on = true; void load().then(h => { if (on) setHelp(h) }); return () => { on = false } }, [])
  return help
}
