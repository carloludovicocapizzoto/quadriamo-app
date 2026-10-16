import { describe, expect, it } from 'vitest'
import { acceptFiles, MAX_VIDEO_BYTES } from './reports'

const file = (name: string, type: string, size = 10) => { const f = new File(['x'], name, { type }); Object.defineProperty(f, 'size', { value: size }); return f }

describe('allegati delle segnalazioni', () => {
  it('fino a 3 immagini e un video', () => {
    const imgs = [1, 2, 3, 4].map(i => file(`${i}.png`, 'image/png'))
    const r = acceptFiles([], [...imgs, file('a.mp4', 'video/mp4'), file('b.mp4', 'video/mp4')])
    expect(r.files.map(f => f.name)).toEqual(['1.png', '2.png', '3.png', 'a.mp4'])
    expect(r.rejected).toEqual([{ name: '4.png', why: 'count' }, { name: 'b.mp4', why: 'count' }])
  })
  it('niente altri tipi, niente video troppo grandi', () => {
    const r = acceptFiles([], [file('a.pdf', 'application/pdf'), file('big.mov', 'video/quicktime', MAX_VIDEO_BYTES + 1)])
    expect(r.files).toEqual([])
    expect(r.rejected.map(x => x.why)).toEqual(['type', 'size'])
  })
})
