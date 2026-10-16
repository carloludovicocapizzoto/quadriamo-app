// Il foglio di un evento aperto da fuori del calendario (es. toccando l'affitto tra i movimenti): si modifica lì.
import { todayIso } from '../../engine'
import { useI18n } from '../../i18n/core'
import { useStore } from '../../store/context'
import { Sheet } from '../kit/Sheet'
import { EventForm } from './EventForm'
import { useEvents } from './useEvents'

export function EventSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useI18n()
  const { state } = useStore()
  const { events, save, remove } = useEvents()
  const event = events.find(e => e.id === id) ?? null
  return (
    <Sheet open={!!event} onClose={onClose} title={t('ev.edit')}>
      {event && <EventForm key={event.id} event={event} settings={state.data!.settings} today={todayIso()}
        onSave={e => { save(e); onClose() }} onDelete={() => { remove(event.id); onClose() }} />}
    </Sheet>
  )
}
