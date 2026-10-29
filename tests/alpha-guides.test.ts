import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
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
