import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

it('builds Alpha-only guide links and copy targets without changing historical guide inputs', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'quadriamo-alpha-guides-'))
  const sourceFiles = {
    'index.html': 'index.html',
    'inizia.html': 'public/inizia.html',
    'install.html': 'public/install.html',
    'home.js': 'public/home.js',
    'pages.js': 'public/pages.js',
    'qr.svg': 'public/qr.svg',
  }
  const before = new Map<string, Buffer>()

  try {
    for (const [output, input] of Object.entries(sourceFiles)) {
      const source = resolve(root, input)
      before.set(output, readFileSync(source))
      cpSync(source, resolve(temporary, output))
    }
    execFileSync(process.execPath, [resolve(root, 'tools/alpha/prepare-guides.mjs'), temporary], { cwd: root })

    const output = Object.fromEntries(Object.keys(sourceFiles).filter(name => name !== 'qr.svg')
      .map(name => [name, readFileSync(resolve(temporary, name), 'utf8')]))
    const helper = readFileSync(resolve(temporary, 'alpha-guides.js'), 'utf8')
    const guides = `${output['index.html']}\n${output['inizia.html']}\n${output['install.html']}\n${output['home.js']}`

    expect(guides).not.toMatch(/carloludovicocapizzoto\.github\.io|quadriamo-app\.github\.io/)
    expect(guides).not.toMatch(/github\.com\/carloludovicocapizzoto\/quadriamo-app\/releases/)
    expect(output['index.html']).toContain('data-qa2g-alpha-guides')
    expect(output['inizia.html']).toContain('data-qa2g-native-panel')
    expect(output['install.html']).toContain('data-qa2g-install-android')
    expect(output['inizia.html']).toContain('data-url="/app/"')
    expect(output['install.html']).toContain('data-qa2g-add-url')
    expect((output['inizia.html'].match(/data-qa2g-native-panel/g) ?? [])).toHaveLength(12)
    expect((output['install.html'].match(/data-qa2g-install-android/g) ?? [])).toHaveLength(4)
    expect((output['install.html'].match(/data-qa2g-add-url/g) ?? [])).toHaveLength(2)
    expect(helper).toContain("new URL('/app/', location.origin)")
    expect(helper).toContain("navigator.clipboard.writeText(url)")
    expect(helper).toContain('clipboardError')
    expect(readFileSync(resolve(temporary, 'pages.js'), 'utf8')).toContain("hasAttribute('data-qa2g-alpha-guides')")
    expect(before.get('inizia.html')?.toString()).toMatch(/carloludovicocapizzoto\.github\.io/)
    expect(before.get('install.html')?.toString()).toMatch(/quadriamo-app\/releases\/download\/android/)
    for (const [name, input] of Object.entries(sourceFiles)) {
      expect(readFileSync(resolve(root, input))).toEqual(before.get(name))
    }
    expect(() => readFileSync(resolve(temporary, 'qr.svg'))).toThrow()
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})

it('keeps Alpha app links and copy feedback localized when language changes without reload', async () => {
  const helper = readFileSync(resolve(root, 'tools/alpha/alpha-guides.js'), 'utf8')
  const translations = {
    it: { open: 'Apri Quadriamo', copied: 'Link copiato', error: 'Non riesco a copiare il link: selezionalo e copialo manualmente.' },
    en: { open: 'Open Quadriamo', copied: 'Link copied', error: 'Could not copy the link. Select and copy it manually.' },
    fr: { open: 'Ouvrir Quadriamo', copied: 'Lien copié', error: 'Impossible de copier le lien. Sélectionnez-le et copiez-le manuellement.' },
    es: { open: 'Abrir Quadriamo', copied: 'Enlace copiado', error: 'No se pudo copiar el enlace. Selecciónalo y cópialo manualmente.' },
  }
  const origin = 'https://quadriamo-alpha.pages.dev'
  let languageChange: (() => void) | undefined
  let failClipboard = false
  const copiedUrls: string[] = []
  const links = Object.fromEntries(Object.keys(translations).map(lang => [lang, {
    href: '', textContent: '', closest: () => ({ getAttribute: () => lang }),
  }])) as Record<keyof typeof translations, { href: string; textContent: string; closest: () => { getAttribute: () => string } }>
  const rootLink = { href: '', textContent: '', closest: () => null }
  const buttons = Object.fromEntries(Object.keys(translations).map(lang => {
    let clickHandler: (() => Promise<void>) | undefined
    const attributes: Record<string, string> = { 'data-url': '/app/', 'data-copy-label': translations[lang as keyof typeof translations].open }
    return [lang, {
      textContent: attributes['data-copy-label'],
      closest: () => ({ getAttribute: () => lang }),
      getAttribute: (name: string) => attributes[name] ?? null,
      setAttribute: (name: string, value: string) => { attributes[name] = value },
      addEventListener: (_event: string, handler: () => Promise<void>) => { clickHandler = handler },
      click: async () => clickHandler?.(),
    }]
  })) as Record<keyof typeof translations, {
    textContent: string; closest: () => { getAttribute: () => string }; getAttribute: (name: string) => string | null
    setAttribute: (name: string, value: string) => void; addEventListener: (event: string, handler: () => Promise<void>) => void
    click: () => Promise<void | undefined>
  }>
  const documentElement = { lang: 'it', setAttribute: (_name: string, _value: string) => undefined }
  const document = {
    documentElement,
    querySelectorAll: (selector: string) => selector === '[data-qa2g-app-open]' ? [...Object.values(links), rootLink]
      : selector === '.copy-link' ? Object.values(buttons) : [],
  }
  runInNewContext(helper, {
    document, location: { origin, host: 'quadriamo-alpha.pages.dev' }, URL,
    navigator: { clipboard: { writeText: async (url: string) => { copiedUrls.push(url); if (failClipboard) throw Error('denied') } } },
    MutationObserver: class { constructor(callback: () => void) { languageChange = callback } observe() {} },
    setTimeout: () => 0,
  })

  for (const lang of Object.keys(translations) as Array<keyof typeof translations>) {
    documentElement.lang = lang
    languageChange?.()
    expect(links[lang].textContent).toBe(translations[lang].open)
    expect(rootLink.textContent).toBe(translations[lang].open)
    expect(links[lang].href).toBe(`${origin}/app/`)
    await buttons[lang].click()
    expect(buttons[lang].textContent).toBe(translations[lang].copied)
    failClipboard = true
    await buttons[lang].click()
    expect(buttons[lang].textContent).toBe(translations[lang].error)
    failClipboard = false
  }
  expect(copiedUrls).toHaveLength(8)
  expect(copiedUrls.every(url => url === `${origin}/app/`)).toBe(true)
})
