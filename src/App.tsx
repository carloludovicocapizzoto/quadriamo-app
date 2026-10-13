import { AppShell } from './app/AppShell'
import { Entry } from './app/Entry'

/** Prima l'ingresso (benvenuto, accesso, configurazione), poi l'app. */
export default function App() {
  return <Entry><AppShell /></Entry>
}
