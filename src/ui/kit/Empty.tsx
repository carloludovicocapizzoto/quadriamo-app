import { tap } from './motion'

/**
 * Quando qui non c'è ancora niente: un titolo, una frase che dice cosa comparirà e, se serve, l'azione per cominciare.
 * Prende il posto del protagonista (niente zeri grandi che sembrano un risultato). Niente icone né riquadri.
 */
export function Empty({ title, text, action, quiet = false }: {
  title: string; text?: string; action?: { label: string; onClick: () => void }; quiet?: boolean
}) {
  return (
    <section className="empty" role="status">
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {action && <button className={`btn${quiet ? '' : ' primary'}`} onClick={() => { tap(); action.onClick() }}>{action.label}</button>}
    </section>
  )
}
