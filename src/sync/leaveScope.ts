import { activateScope, type ScopeLease } from '../store/scope'

/** Sospende prima le azioni e le richieste del vecchio runtime, poi rende durevole la sua coda. */
export async function leaveScope(lease: ScopeLease, flush: () => Promise<void>,
  action: (guard: ScopeLease) => Promise<void>, suspend: (guard: ScopeLease, busy: boolean) => void) {
  lease.assert()
  const guard = activateScope(lease.scope)
  suspend(guard, true)
  try {
    await flush()
    guard.assert()
    await action(guard)
  } finally {
    // Se il server ha già installato un'altra sessione, non riaprire il precedente proprietario.
    if (guard.current()) suspend(activateScope(guard.scope), false)
  }
}
