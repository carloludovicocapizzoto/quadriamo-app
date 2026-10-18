import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activateScope, personalKey, type DataScope } from '../store/scope'
import { avatarSnapshot, loadAvatar, removeAvatar, setAvatar } from './avatar'
import { shrinkImage } from '../image'

const remote = vi.hoisted(() => ({ download: vi.fn(), upload: vi.fn(), remove: vi.fn() }))
vi.mock('../sync/scopedClient', () => ({ scopedClient: () => ({ storage: { from: () => remote } }) }))
vi.mock('../image', () => ({ shrinkImage: vi.fn(async (file: File) => file) }))
const values = new Map<string, string>()
const scope = (owner: string): DataScope => ({ environment: 'test', backend: 'synthetic', kind: 'account', owner })
beforeEach(() => {
  values.clear()
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) })
  vi.stubGlobal('FileReader', class {
    result: string | null = null
    onload: (() => void) | null = null
    readAsDataURL(blob: Blob) { void blob.text().then(t => { this.result = t; this.onload?.() }) }
  })
  remote.download.mockReset(); remote.upload.mockReset(); remote.remove.mockReset()
  remote.upload.mockResolvedValue({ error: null }); remote.remove.mockResolvedValue({ error: null })
  vi.mocked(shrinkImage).mockImplementation(async file => file)
})
describe('avatar ownership', () => {
  it('uses separate offline photos, never the legacy global photo', () => {
    values.set('q.avatar', 'legacy-unknown')
    values.set(personalKey('q.avatar', scope('A')), 'A')
    values.set(personalKey('q.avatar', scope('B')), 'B')
    activateScope(scope('A')); expect(avatarSnapshot()).toBe('A')
    activateScope(scope('B')); expect(avatarSnapshot()).toBe('B')
    activateScope(scope('A')); expect(avatarSnapshot()).toBe('A')
    expect(values.get('q.avatar')).toBe('legacy-unknown')
  })
  it('ignores downloads completed after logout or account switch', async () => {
    let finish!: (v: unknown) => void
    remote.download.mockImplementation(() => new Promise(r => { finish = r }))
    activateScope(scope('A'))
    const pending = loadAvatar('A')
    activateScope(scope('B'))
    finish({ data: new Blob(['A-only']), error: null })
    await expect(pending).rejects.toThrow('session changed')
    expect(avatarSnapshot()).toBeNull()
    expect(values.has(personalKey('q.avatar', scope('B')))).toBe(false)
  })
  it('stops an image being processed before upload if ownership changes', async () => {
    let finish!: (b: Blob) => void
    vi.mocked(shrinkImage).mockImplementation(() => new Promise(r => { finish = r }))
    activateScope(scope('A'))
    const pending = setAvatar(new File(['A'], 'a.png'), 'A')
    activateScope(scope('B')); finish(new Blob(['A']))
    await expect(pending).rejects.toThrow('session changed')
    expect(remote.upload).not.toHaveBeenCalled()
    expect(avatarSnapshot()).toBeNull()
  })
  it('never removes B cache after an A removal request completes', async () => {
    let finish!: (v: unknown) => void
    remote.remove.mockImplementation(() => new Promise(r => { finish = r }))
    activateScope(scope('A'))
    const pending = removeAvatar('A')
    values.set(personalKey('q.avatar', scope('B')), 'B')
    activateScope(scope('B')); finish({ error: null })
    await expect(pending).rejects.toThrow('session changed')
    expect(avatarSnapshot()).toBe('B')
  })
  it('rejects operations carrying another user id', async () => {
    activateScope(scope('B'))
    await expect(setAvatar(new File(['A'], 'a.png'), 'A')).rejects.toThrow('owner mismatch')
  })
})
