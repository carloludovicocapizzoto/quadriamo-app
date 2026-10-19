# Account isolation browser checks

Requires Node.js, the project dependencies, Playwright, and Chromium. `CHROME` can select an installed Chrome executable; on Windows the runners default to the standard Chrome installation. If Playwright is provided outside this repository, set `PLAYWRIGHT_MODULE` to its absolute `index.mjs` path.

Set `ACCOUNT_EVIDENCE` to an output directory **outside the repository**, then run:

```
node tests/browser/run.mjs
```

The launcher forces a synthetic Supabase URL/key, starts Vite on loopback port 5197, tests widths 1280 and 390, builds the production PWA into the external output directory, and serves it on loopback port 5198. It does not install software, deploy, or modify environment files. Both ports must be free. Exported synthetic caches stay in the evidence directory. The persistent PWA profile uses a new short directory under the system temporary directory to avoid Windows Cache Storage failures with deep paths. Set `ACCOUNT_PROFILE_ROOT` to an external directory to choose a different base; keep it short on Windows. The profile is preserved and its actual path is recorded in `pwa.json`.

The harness mounts the production session, store, sync and application components. A test probe exposes actions and snapshots; IndexedDB, Web Locks, BroadcastChannel, FileReader and service workers are the browser implementations. Quota/read errors and delayed file/network operations are injected explicitly. All API traffic is intercepted, and non-loopback destinations are blocked.

**Authentication is simulated HTTP with the actual Supabase SDK.** These checks do not verify GoTrue, JWT signatures, mail delivery or database RLS. A separate Supabase environment with synthetic users is still required.

The PWA suite uses a persistent Chromium profile, closes and relaunches it offline, installs the push script from the pre-isolation commit `aabdc210`, and injects push events through Chromium DevTools. It tests a queued push behind an IndexedDB lock and retirement failures. It never registers an external push endpoint. DevTools acknowledgment alone is not delivery evidence: assertions inspect registration state, notifications and DOM. Before checking notifications, the runner observes completion from the actual handler or a stopped, redundant state for that exact legacy worker version. It queries the retained registration even after the worker realm closes; a failed notification query is a failure, not an empty result. The application closure gate remains required. `legacy-transition.json` records which termination condition was observed, and unexpected page errors fail the suite.

Reports, requests, IndexedDB snapshots, recovery downloads and screenshots are written to the external directory. The fixture is excluded from the production entry points. No real account or personal data should be used.
