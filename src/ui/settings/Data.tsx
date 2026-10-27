// I dati: copia di sicurezza, esportazione CSV, ripristino e azzeramento; installazione dell'app.
import { useEffect, type ChangeEvent } from 'react'
import { CUSTOM, FIRST, SPLIT } from '../../engine'
import { useI18n } from '../../i18n/core'
import { useStore } from '../../store/context'
import { useSync } from '../../sync/context'
import { parseBackup, restoreLoss, toCsv, type AppData } from '../../store/state'
import { Icon } from '../Icon'
import { InstallButton } from '../InstallButton'
import { LegalLinks } from '../LegalLinks'
import { downloadFile } from '../kit/download'
import { bucketName, categoryName } from '../names'
import type { SettingsDraft } from './draft'

export function DataSection({ d: { data, flash, reset }, wizard }: { d: SettingsDraft; wizard: boolean }) {
  const { t } = useI18n()
  const { dispatch, lease, storage } = useStore()
  const { showSyncDetails } = useSync()
  // qui il pannello della sincronizzazione resta sempre visibile: stato, esportazione delle copie e archivio di recupero
  useEffect(() => { if (wizard) return; showSyncDetails?.(true); return () => showSyncDetails?.(false) }, [wizard, showSyncDetails])
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
    try { const text = await file.text(); if (lease && !lease.current()) return; parsed = parseBackup(text) } catch { flash(t('settings.importBad'), true); return }
    if ((lease?.scope.kind === 'account' && parsed.demo) || (lease?.scope.kind === 'demo' && !parsed.demo)) { flash(t('settings.importBad'), true); return }
    if (lease?.scope.kind === 'account' && storage) {
      // con un account il backup sostituisce i dati anche nel cloud e sugli altri dispositivi: si dice cosa sparisce
      // e i dati di adesso restano nell'archivio di recupero della sincronizzazione, da esportare se servono
      if (!confirm(t('settings.importConfirmAccount', restoreLoss(data, parsed)))) return
      try {
        await storage.updateCloud(lease, ({ data: current, cloud }) => {
          cloud.recovery.push({ id: crypto.randomUUID(), at: new Date().toISOString(), reason: 'restore', local: current, remote: null, base: cloud.base?.document ?? null })
          return { data: parsed, cloud }
        })
      } catch { flash(t('settings.importBad'), true); return }
    } else {
      if (!confirm(t('settings.importConfirm'))) return
      dispatch({ type: 'replace', data: parsed })
    }
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
        {!wizard && <button className="btn danger" disabled={lease?.scope.kind === 'account'} title={lease?.scope.kind === 'account' ? t('cloud.clearBlocked') : undefined}
          onClick={() => { if (confirm(t('settings.resetConfirm'))) dispatch({ type: 'replace', data: null }) }}>
          {t('settings.reset')}</button>}
      </div>
      {!wizard && lease?.scope.kind === 'account' && <p className="small">{t('cloud.clearBlocked')}</p>}
      <p className="muted small top-gap">{t('settings.install')}</p>
      <InstallButton />
      {!wizard && <LegalLinks />}
      </section>
  )
}
