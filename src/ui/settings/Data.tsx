// I dati: copia di sicurezza, esportazione CSV, ripristino e azzeramento; installazione dell'app.
import type { ChangeEvent } from 'react'
import { CUSTOM, FIRST, SPLIT } from '../../engine'
import { useI18n } from '../../i18n/core'
import { useStore } from '../../store/context'
import { parseBackup, toCsv, type AppData } from '../../store/state'
import { Icon } from '../Icon'
import { InstallButton } from '../InstallButton'
import { LegalLinks } from '../LegalLinks'
import { downloadFile } from '../kit/download'
import { bucketName, categoryName } from '../names'
import type { SettingsDraft } from './draft'

export function DataSection({ d: { data, flash, reset }, wizard }: { d: SettingsDraft; wizard: boolean }) {
  const { t } = useI18n()
  const { dispatch } = useStore()
  const exportBackup = () => downloadFile('quadriamo-backup', 'json', JSON.stringify(data, null, 2), 'application/json')
  const exportCsv = () => downloadFile('quadriamo-transactions', 'csv', '\ufeff' + toCsv(data, {
    category: id => categoryName(data.settings.categories.find(c => c.id === id), t),
    bucket: id => {
      const b = data.settings.buckets.find(x => x.id === id)
      return b ? bucketName(b, t) : id === SPLIT ? t('split.rule') : id === CUSTOM ? t('split.custom') : id === FIRST ? t('bucket.first') : (id ?? '')
    },
  }), 'text/csv;charset=utf-8')

  async function importBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    let parsed: AppData
    try { parsed = parseBackup(await file.text()) } catch { flash(t('settings.importBad'), true); return }
    if (!confirm(t('settings.importConfirm'))) return
    dispatch({ type: 'replace', data: parsed })
    reset(parsed.settings)
    flash(t('settings.importOk'))
  }

  return (
    <section className="card">
      <h3 className="h-plain">{t('settings.data')}</h3>
      <p className="muted small"><Icon name="lock" size={14} />{t('settings.dataHint')}</p>
      {wizard && <p className="small">{t('setup.importHint')}</p>}
      <div className="stack-row">
        {!wizard && <button className="btn" onClick={exportBackup}>{t('settings.export')}</button>}
        {!wizard && <button className="btn" onClick={exportCsv}>{t('settings.exportCsv')}</button>}
        <label className="btn">{t('settings.import')}
          <input type="file" accept="application/json,.json" hidden onChange={importBackup} /></label>
        {!wizard && <button className="btn danger" onClick={() => { if (confirm(t('settings.resetConfirm'))) dispatch({ type: 'replace', data: null }) }}>
          {t('settings.reset')}</button>}
      </div>
      <p className="muted small top-gap">{t('settings.install')}</p>
      <InstallButton />
      {!wizard && <LegalLinks />}
      </section>
  )
}
