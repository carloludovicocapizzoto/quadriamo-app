import { useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/core'
import { ENV } from '../env'
import type { Dict } from '../i18n/en'
import { LogoMark } from './Gate'
import { StepHeader } from './Steps'
import { Icon } from './Icon'
import { CHOICES, detectKind, familyOf, type Kind } from './installKind'

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
type Mock = 'iosBar' | 'iosTop' | 'samBar' | 'samList' | 'samSheet' | 'ffList' | 'iosSheet' | 'iosAdd' | 'home' | 'andMenu' | 'andList' | 'andDialog' | 'deskBar' | 'deskDialog' | 'macMenu' | 'macList' | 'dock'
type Arrow = 'down' | 'down-right' | 'up-right' | 'up-left' | null
interface Step { title: keyof Dict; text: keyof Dict; mock: Mock; arrow: Arrow }


const OPEN: Step = { title: 'inst.open', text: 'inst.opend', mock: 'home', arrow: null }
const STEPS: Record<Kind, Step[]> = {
  ipad: [{ title: 'inst.iosO1', text: 'inst.ipad1d', mock: 'iosTop', arrow: 'up-right' }, { title: 'inst.ios2', text: 'inst.ios2d', mock: 'iosSheet', arrow: null },
    { title: 'inst.ios3', text: 'inst.ios3d', mock: 'iosAdd', arrow: null }, OPEN],
  'ios-other': [{ title: 'inst.iosO1', text: 'inst.iosO1d', mock: 'iosTop', arrow: 'up-right' }, { title: 'inst.ios2', text: 'inst.ios2d', mock: 'iosSheet', arrow: null },
    { title: 'inst.ios3', text: 'inst.ios3d', mock: 'iosAdd', arrow: null }, OPEN],
  'android-samsung': [{ title: 'inst.sam1', text: 'inst.sam1d', mock: 'samBar', arrow: 'down-right' }, { title: 'inst.sam2', text: 'inst.sam2d', mock: 'samList', arrow: null },
    { title: 'inst.sam3', text: 'inst.sam3d', mock: 'samSheet', arrow: null }, OPEN],
  'android-firefox': [{ title: 'inst.ff1', text: 'inst.ff1d', mock: 'andMenu', arrow: 'up-right' }, { title: 'inst.ff2', text: 'inst.ff2d', mock: 'ffList', arrow: null }, OPEN],
  'android-other': [{ title: 'inst.oth1', text: 'inst.oth1d', mock: 'andMenu', arrow: null }, { title: 'inst.oth2', text: 'inst.oth2d', mock: 'andList', arrow: null }, OPEN],
  ios: [{ title: 'inst.ios1', text: 'inst.ios1d', mock: 'iosBar', arrow: 'down' }, { title: 'inst.ios2', text: 'inst.ios2d', mock: 'iosSheet', arrow: null },
    { title: 'inst.ios3', text: 'inst.ios3d', mock: 'iosAdd', arrow: null }, OPEN],
  android: [{ title: 'inst.and1', text: 'inst.and1d', mock: 'andMenu', arrow: 'up-right' }, { title: 'inst.and2', text: 'inst.and2d', mock: 'andList', arrow: null },
    { title: 'inst.and3', text: 'inst.and3d', mock: 'andDialog', arrow: null }, OPEN],
  chromium: [{ title: 'inst.desk1', text: 'inst.desk1d', mock: 'deskBar', arrow: 'up-right' }, { title: 'inst.desk2', text: 'inst.desk2d', mock: 'deskDialog', arrow: null }],
  'safari-mac': [{ title: 'inst.safari1', text: 'inst.safari1d', mock: 'macMenu', arrow: 'up-left' }, { title: 'inst.safari2', text: 'inst.safari2d', mock: 'macList', arrow: null },
    { title: 'inst.open', text: 'inst.desk2d', mock: 'dock', arrow: null }],
  firefox: [],
}

/** Tutorial interattivo per aggiungere l'app alla Home (o installarla sul computer), prima della registrazione. */
export function InstallTutorial({ onContinue }: { onContinue: () => void }) {
  const { t } = useI18n()
  const [kind, setKindState] = useState<Kind>(() => detectKind())
  const steps = STEPS[kind]
  const [i, setI] = useState(0)
  const setKind = (k: Kind) => { setKindState(k); setI(0) }
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent) }
    const onInstalled = () => setI(steps.length - 1)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [steps.length])
  const desktop = familyOf(kind) === 'desktop'
  const step = steps[i]

  return (
    <div className="inst">
      <h1>{desktop ? t('inst.titleDesktop') : t('inst.title')}</h1>
      {i === 0 && <p className="muted small">{t('inst.why')}</p>}
      <div className="inst-browsers" role="group" aria-label={t('inst.otherBrowser')}>
        <span className="small muted">{t('inst.otherBrowser')}</span>
        {CHOICES[familyOf(kind)].map(([k, name]) => (
          <button key={k} type="button" className={`chip${k === kind ? ' on' : ''}`} aria-pressed={k === kind} onClick={() => setKind(k)}>
            {name === '…' ? t('prof.other') : name}</button>
        ))}
      </div>
      {evt && (
        <div className="inst-quick">
          <span>{t('inst.oneTap')}</span>
          <button className="btn primary" onClick={async () => { await evt.prompt(); const c = await evt.userChoice; setEvt(null); if (c.outcome === 'accepted') setI(steps.length - 1) }}>
            ⤓ {t('inst.installNow')}</button>
        </div>
      )}
      {kind === 'firefox' ? <p className="inst-note">{t('inst.firefox')}</p> : step && <>
        <StepHeader n={i + 1} total={steps.length} title={t(step.title)} />
        <div className="step-body" key={i}>
          <p>{t(step.text)}</p>
          <MockScreen mock={step.mock} />
        </div>
        <div className="step-nav">
          {i > 0 && <button className="btn" onClick={() => setI(i - 1)}>← {t('step.back')}</button>}
          {i < steps.length - 1 && <button className="btn primary" onClick={() => setI(i + 1)}>{t('step.next')}<Icon name="chevron" size={16} /></button>}
        </div>
      </>}
      <button className="link-btn inst-skip" onClick={onContinue}>{t('inst.skip')}<Icon name="chevron" size={16} /></button>
      {step?.arrow && <div className={`inst-arrow ${step.arrow}`} aria-hidden="true" key={`a${i}`}>➜</div>}
    </div>
  )
}

/** Disegni semplificati dello schermo, con il punto da toccare evidenziato. */
function MockScreen({ mock }: { mock: Mock }) {
  const { t } = useI18n()
  const hl = (x: ReactNode) => <span className="hl">{x}</span>
  const icons = ['#7C9CBF', '#9BC48A', '#E5B85C', '#C98BB9', '#7FB7B2', '#B9A27F', '#8C8FD9']
  switch (mock) {
    case 'iosBar': return <div className="mock phone"><div className="m-page" /><div className="m-bar ios"><span>‹</span><span>›</span><span className="hl" title={t('inst.lblShare')}>⬆︎</span><span>⧉</span><span>⋯</span></div></div>
    case 'iosTop': return <div className="mock phone"><div className="m-bar and"><span className="m-url">quadriamo…</span>{hl('⬆︎')}<span>⋯</span></div><div className="m-page" /></div>
    case 'samBar': return <div className="mock phone"><div className="m-page" /><div className="m-bar ios"><span>‹</span><span>›</span><span>⌂</span><span>⧉</span>{hl('≡')}</div></div>
    case 'samList': return <div className="mock phone"><div className="m-page" /><div className="m-sheet"><div className="m-row">◷</div><div className="m-row">⤓</div>{hl(<div className="m-row">⊕ {t('inst.lblAddPage')}</div>)}<div className="m-row">⚙</div></div></div>
    case 'samSheet': return <div className="mock phone"><div className="m-page" /><div className="m-sheet"><div className="m-row">☆</div><div className="m-row">{t('inst.lblHome')}</div>{hl(<div className="m-row">{t('inst.lblWebApp')}</div>)}</div></div>
    case 'ffList': return <div className="mock phone"><div className="m-bar and"><span className="m-url">quadriamo…</span><span>⋮</span></div><div className="m-menu"><div className="m-row">↻</div><div className="m-row">☆</div>{hl(<div className="m-row">⊞ {t('inst.lblFfAdd')}</div>)}<div className="m-row">⚙</div></div></div>
    case 'iosSheet': return <div className="mock phone"><div className="m-sheet"><div className="m-row">⧉</div><div className="m-row">☆</div>{hl(<div className="m-row">⊞ {t('inst.lblAddHome')}</div>)}<div className="m-row">✎</div></div></div>
    case 'iosAdd': return <div className="mock phone"><div className="m-head"><span>✕</span><b>Quadriamo</b>{hl(t('inst.lblAdd'))}</div><div className="m-preview"><LogoMark size={48} /><span>Quadriamo</span></div></div>
    case 'home': return <div className="mock phone home">{icons.map((c, k) => <span key={k} className="m-app" style={{ background: c }} />)}<span className="m-app q"><LogoMark size={38} /></span></div>
    case 'andMenu': return <div className="mock phone"><div className="m-bar and"><span className="m-url">quadriamo…</span>{hl('⋮')}</div><div className="m-page" /></div>
    case 'andList': return <div className="mock phone"><div className="m-bar and"><span className="m-url">quadriamo…</span><span>⋮</span></div><div className="m-menu"><div className="m-row">↻</div><div className="m-row">☆</div>{hl(<div className="m-row">⤓ {t('inst.lblInstallApp')}</div>)}<div className="m-row">⚙</div></div></div>
    case 'andDialog': case 'deskDialog':
      return <div className={`mock ${mock === 'deskDialog' ? 'desk' : 'phone'}`}><div className="m-dialog"><LogoMark size={36} /><b>Quadriamo</b><div className="m-btns"><span>✕</span>{hl(t('inst.lblInstall'))}</div></div></div>
    case 'deskBar': return <div className="mock desk"><div className="m-bar desk"><span className="m-url">{location.host}{ENV.base}app/</span>{hl('⊕')}<span>☆</span><span>⋮</span></div><div className="m-page" /></div>
    case 'macMenu': return <div className="mock desk"><div className="m-bar mac"><span></span><b>Safari</b>{hl('File')}<span>…</span></div><div className="m-page" /></div>
    case 'macList': return <div className="mock desk"><div className="m-bar mac"><span></span><b>Safari</b><span className="hl">File</span><span>…</span></div><div className="m-menu left"><div className="m-row">⌘N</div><div className="m-row">⌘T</div>{hl(<div className="m-row">⊞ {t('inst.lblAddDock')}</div>)}<div className="m-row">⌘W</div></div></div>
    case 'dock': return <div className="mock desk"><div className="m-page" /><div className="m-dock">{icons.slice(0, 5).map((c, k) => <span key={k} className="m-app" style={{ background: c }} />)}<span className="m-app q"><LogoMark size={34} /></span></div></div>
  }
}
