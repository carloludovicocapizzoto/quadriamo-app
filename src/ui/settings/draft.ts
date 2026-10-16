// La bozza delle impostazioni, condivisa dalle sezioni: ogni modifica valida si salva subito
// (niente modifiche perse cambiando scheda); un messaggio breve conferma il salvataggio.
import { useRef, useState } from 'react'
import type { Settings } from '../../engine'
import { useI18n } from '../../i18n/core'
import { useStore } from '../../store/context'
import { validateSettings } from '../../store/state'

export function useSettingsDraft() {
  const { t } = useI18n()
  const { state, dispatch } = useStore()
  const data = state.data!
  const [draft, setDraft] = useState<Settings>(() => structuredClone(data.settings))
  // cambia quando i dati vengono sostituiti (ripristino): le sezioni ripartono da capo
  const [version, setVersion] = useState(0)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const flash = (text: string, bad = false) => {
    setMsg({ text, bad })
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), bad ? 4000 : 1500)
  }
  const edit = (fn: (s: Settings) => void) => {
    // i cambi automatici possono essere stati aggiornati nel frattempo: si parte sempre dagli ultimi
    const next = structuredClone({ ...draft, fxRates: data.settings.fxRates, fxDate: data.settings.fxDate })
    fn(next)
    setDraft(next)
    if (!validateSettings(next).length) {
      dispatch({ type: 'setSettings', settings: next })
      flash(t('settings.saved'))
    }
  }
  const reset = (settings: Settings) => { setDraft(structuredClone(settings)); setVersion(v => v + 1) }
  return { data, draft, edit, errors: validateSettings(draft), msg, flash, reset, version }
}

export type SettingsDraft = ReturnType<typeof useSettingsDraft>
