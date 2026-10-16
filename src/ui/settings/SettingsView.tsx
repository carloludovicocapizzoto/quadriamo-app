// Impostazioni, una sezione per file. `only` sceglie quali mostrare (pagine del Profilo, passaggi della configurazione iniziale).
import { Fragment } from 'react'
import { useI18n } from '../../i18n/core'
import { Icon } from '../Icon'
import { CategoriesSection } from './Categories'
import { DataSection } from './Data'
import { useSettingsDraft } from './draft'
import { FxSection } from './Fx'
import { GeneralSection } from './General'
import { RuleSection } from './Rule'
import { RulesSection } from './Rules'

export type SettingsSection = 'general' | 'fx' | 'rule' | 'categories' | 'rules' | 'data'

export function SettingsView({ only, wizard = false }: { only: SettingsSection[]; wizard?: boolean }) {
  const { t } = useI18n()
  const d = useSettingsDraft()
  const { errors, msg } = d
  const show = (x: SettingsSection) => only.includes(x)
  return (
    <div className="settings">
      <Fragment key={d.version}>
        {show('general') && <GeneralSection d={d} />}
        {show('fx') && <FxSection d={d} />}
        {show('rule') && <RuleSection d={d} />}
        {show('categories') && <CategoriesSection d={d} />}
        {show('rules') && <RulesSection d={d} />}
        {show('data') && <DataSection d={d} wizard={wizard} />}
      </Fragment>

      {(errors.length > 0 || msg) && (
        <div className="save-bar" role="status">
          <span className={errors.length || msg?.bad ? 'bad-text small' : 'good-text small'}>
            <Icon name={errors.length || msg?.bad ? 'alert' : 'check'} size={15} className="inline-ico" />
            {errors.length ? t('settings.errors') : msg?.text}</span>
        </div>
      )}
    </div>
  )
}
