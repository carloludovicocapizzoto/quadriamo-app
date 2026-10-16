// Profilo → Segnala un problema. Chi prova la beta (flag "tester") può mandare una segnalazione completa
// oppure il voto; negli altri ambienti c'è il voto con il commento.
import { useState } from 'react'
import { ENV } from '../../env'
import { useI18n } from '../../i18n/core'
import { Segmented } from '../kit/Segmented'
import { FeedbackCard } from './FeedbackCard'
import { ReportForm } from './ReportForm'

export function FeedbackPage({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'report' | 'rate'>('report')
  if (!ENV.flags.tester) return <FeedbackCard onClose={onClose} />
  return <>
    <Segmented className="feedback-tabs" value={tab} onChange={setTab} label={t('prof.feedback')} options={[{ id: 'report', label: t('rep.tab.report') }, { id: 'rate', label: t('rep.tab.rate') }]} />
    {tab === 'report' ? <ReportForm /> : <FeedbackCard onClose={onClose} />}
  </>
}
