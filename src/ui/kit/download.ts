/** Fa scaricare un file creato sul momento; al nome si aggiunge la data di oggi. */
export function downloadFile(name: string, ext: 'csv' | 'json', content: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.${ext}`
  a.click()
  URL.revokeObjectURL(a.href)
}
