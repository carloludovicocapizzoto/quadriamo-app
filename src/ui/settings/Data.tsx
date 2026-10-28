// I dati: copia di sicurezza, esportazione CSV, ripristino e azzeramento; installazione dell'app. Ogni azione è una riga.
import type { ChangeEvent } from 'react'
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

  const account = lease?.scope.kind === 'account'
  const chev = <Icon name="chevron" size={18} className="row-chev" />
  return (<>
    {!wizard && account && <section className="group">
      <h2 className="group-title">{t('cloud.title')}</h2>
      {/* qui il pannello della sincronizzazione resta sempre visibile: stato, esportazione delle copie e archivio di recupero */}
      <div ref={showSyncDetails} />
    </section>}
    <section className="group">
      <h2 className="group-title">{t('settings.data')}</h2>
      {wizard && <p className="small group-intro">{t('setup.importHint')}</p>}
      <ul className="group-list">
        {!wizard && <li><button className="row" onClick={exportBackup}><span className="row-main"><span>{t('settings.export')}</span></span>{chev}</button></li>}
        {!wizard && <li><button className="row" onClick={exportCsv}><span className="row-main"><span>{t('settings.exportCsv')}</span></span>{chev}</button></li>}
        <li><label className="row"><span className="row-main"><span>{t('settings.import')}</span></span>{chev}
          <input type="file" accept="application/json,.json" hidden onChange={importBackup} /></label></li>
      </ul>
      {!wizard && <p className="group-foot"><Icon name="lock" size={14} className="inline-ico" />{t('settings.dataHint')}</p>}
    </section>
    {!wizard && <InstallButton rows />}
    {!wizard && <section className="group">
      <ul className="group-list">
        {/* con l'account l'azzeramento non c'è ancora: la riga resta, spenta, e il perché è scritto sotto */}
        <li><button className="row" disabled={account} title={account ? t('cloud.clearBlocked') : undefined}
          onClick={() => { if (confirm(t('settings.resetConfirm'))) dispatch({ type: 'replace', data: null }) }}>
          <span className="row-main"><span className="bad-text">{t('settings.reset')}</span></span></button></li>
      </ul>
      {account && <p className="group-foot">{t('cloud.clearBlockedShort')}</p>}
      <LegalLinks />
    </section>}
  </>)
}
