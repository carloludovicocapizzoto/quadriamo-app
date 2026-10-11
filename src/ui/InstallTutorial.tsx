import { useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/core'
import type { Dict } from '../i18n/en'
import { LogoMark } from './Gate'
import { StepHeader } from './Steps'
import { detectKind, type Kind } from './installKind'

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
type Mock = 'iosBar' | 'iosSheet' | 'iosAdd' | 'home' | 'andMenu' | 'andList' | 'andDialog' | 'deskBar' | 'deskDialog' | 'macMenu' | 'macList' | 'dock'
type Arrow = 'down' | 'up-right' | 'up-left' | null
interface Step { title: keyof Dict; text: keyof Dict; mock: Mock; arrow: Arrow }


const OPEN: Step = { title: 'inst.open', text: 'inst.opend', mock: 'home', arrow: null }
const STEPS: Record<Kind, Step[]> = {
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
  const kind = detectKind()
  const steps = STEPS[kind]
  const [i, setI] = useState(0)
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent) }
    const onInstalled = () => setI(steps.length - 1)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [steps.length])
  const desktop = kind === 'chromium' || kind === 'safari-mac' || kind === 'firefox'
  const step = steps[i]

  return (
    <div className="inst">
      <h1>{desktop ? t('inst.titleDesktop') : t('inst.title')}</h1>
      <p className="muted small">{t('inst.why')}</p>
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
          {i < steps.length - 1 && <button className="btn primary" onClick={() => setI(i + 1)}>{t('step.next')} →</button>}
        </div>
      </>}
      <button className="link-btn inst-skip" onClick={onContinue}>{t('inst.skip')} →</button>
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
    case 'iosBar': return <div className="mock phone"><div className="m-page" /><div className="m-bar ios"><span>‹</span><span>›</span>{hl('⬆︎')}<span>⧉</span><span>⋯</span></div></div>
    case 'iosSheet': return <div className="mock phone"><div className="m-sheet"><div className="m-row">⧉</div><div className="m-row">☆</div>{hl(<div className="m-row">⊞ {t('inst.ios2').replace(/^[^“«"]*[“«"]\s?|[”»"]$/g, '')}</div>)}<div className="m-row">✎</div></div></div>
    case 'iosAdd': return <div className="mock phone"><div className="m-head"><span>✕</span><b>Quadriamo</b>{hl(t('inst.ios3').replace(/^[^“«"]*[“«"]\s?|[”»"]$/g, ''))}</div><div className="m-preview"><LogoMark size={48} /><span>Quadriamo</span></div></div>
    case 'home': return <div className="mock phone home">{icons.map((c, k) => <span key={k} className="m-app" style={{ background: c }} />)}<span className="m-app q"><LogoMark size={38} /></span></div>
    case 'andMenu': return <div className="mock phone"><div className="m-bar and"><span className="m-url">quadriamo…</span>{hl('⋮')}</div><div className="m-page" /></div>
    case 'andList': return <div className="mock phone"><div className="m-bar and"><span className="m-url">quadriamo…</span><span>⋮</span></div><div className="m-menu"><div className="m-row">↻</div><div className="m-row">☆</div>{hl(<div className="m-row">⤓ {t('inst.and2').replace(/^[^“«"]*[“«"]\s?|[”»"]$/g, '')}</div>)}<div className="m-row">⚙</div></div></div>
    case 'andDialog': case 'deskDialog':
      return <div className={`mock ${mock === 'deskDialog' ? 'desk' : 'phone'}`}><div className="m-dialog"><LogoMark size={36} /><b>Quadriamo</b><div className="m-btns"><span>✕</span>{hl(t('inst.and3').replace(/^[^“«"]*[“«"]\s?|[”»"]$/g, ''))}</div></div></div>
    case 'deskBar': return <div className="mock desk"><div className="m-bar desk"><span className="m-url">carloludovicocapizzoto.github.io/quadriamo-app/app/</span>{hl('⊕')}<span>☆</span><span>⋮</span></div><div className="m-page" /></div>
    case 'macMenu': return <div className="mock desk"><div className="m-bar mac"><span></span><b>Safari</b>{hl('File')}<span>…</span></div><div className="m-page" /></div>
    case 'macList': return <div className="mock desk"><div className="m-bar mac"><span></span><b>Safari</b><span className="hl">File</span><span>…</span></div><div className="m-menu left"><div className="m-row">⌘N</div><div className="m-row">⌘T</div>{hl(<div className="m-row">⊞ Dock…</div>)}<div className="m-row">⌘W</div></div></div>
    case 'dock': return <div className="mock desk"><div className="m-page" /><div className="m-dock">{icons.slice(0, 5).map((c, k) => <span key={k} className="m-app" style={{ background: c }} />)}<span className="m-app q"><LogoMark size={34} /></span></div></div>
  }
}
