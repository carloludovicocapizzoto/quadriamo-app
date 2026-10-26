// Quale contenuto mostra ogni pagina del Profilo: il tipo Record obbliga ad averne uno per ogni id di profile/pages.ts.
import type { ReactNode } from 'react'
import type { Badge, Streak } from '../../engine'
import type { ProfilePage } from '../../profile/pages'
import type { AppData } from '../../store/state'
import { FeedbackPage } from '../beta/FeedbackPage'
import { GoalsStrip } from '../goals/Goals'
import { PlanCard, ProGate } from '../Pro'
import { SettingsView } from '../settings/SettingsView'
import { SharedView } from '../shared/SharedView'
import { cloudFeature } from '../../features'
import { NotInAlpha } from '../NotInAlpha'
import { CapitalPage } from '../capital/CapitalPage'
import { Accessibility, Appearance, Delete, HelpCenter, Language, Licenses, Motion, Personal, Progress, Security } from './pages'
import { RecurringList } from '../calendar/RecurringList'
import { YearCost } from '../subs/YearCost'
import { DocumentsPage } from '../docs/DocumentsPage'
import { InboxPage } from '../notify/InboxPage'
import { NotificationsPage } from '../notify/NotificationsPage'

export interface PageProps {
  data: AppData; streak: Streak | null; today: string; badges: Badge[]
  onBack: () => void; onLogin: () => void; onHome: () => void; onPage: (p: ProfilePage) => void
}

export const PAGES: Record<ProfilePage, (p: PageProps) => ReactNode> = {
  progress: p => <Progress {...p} />,
  personal: p => <Personal onLogin={p.onLogin} />,
  security: () => <Security />,
  plan: p => <PlanCard onLogin={p.onLogin} />,
  budget: () => <SettingsView only={['general', 'fx', 'rule', 'categories']} />,
  capital: () => <CapitalPage />,
  recurring: () => <RecurringList />,
  yearCost: p => <YearCost onAdd={() => p.onPage('recurring')} />,
  documents: p => <DocumentsPage today={p.today} />,
  goals: p => <GoalsStrip goals={p.data.goals} today={p.today} currency={p.data.settings.currency} titled={false} />,
  rules: () => <SettingsView only={['rules']} />,
  shared: p => cloudFeature('shared') ? <ProGate feature="shared"><SharedView onLogin={p.onLogin} /></ProGate> : <NotInAlpha />,
  appearance: () => <Appearance />,
  language: () => <Language />,
  inbox: p => <InboxPage today={p.today} onPage={p.onPage} />,
  notifications: () => <NotificationsPage />,
  motion: () => <Motion />,
  accessibility: () => <Accessibility />,
  data: () => <SettingsView only={['data']} />,
  delete: p => <Delete onDone={p.onHome} />,
  help: p => <HelpCenter onReport={() => p.onPage('feedback')} />,
  feedback: p => <FeedbackPage onClose={p.onBack} />,
  licenses: () => <Licenses />,
}

