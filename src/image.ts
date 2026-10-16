// Immagini ridotte sul telefono prima di caricarle: meno dati, meno attesa, meno spazio occupato.
// WebP dove il browser lo sa scrivere, altrimenti JPEG.

/** `square`: ritaglio al centro in un quadrato di `size` px (foto profilo); altrimenti il lato lungo al massimo `size` px. */
export async function shrinkImage(file: Blob, { size, square = false }: { size: number; square?: boolean }): Promise<Blob> {
  const img = await createImageBitmap(file)
  const side = Math.min(img.width, img.height)
  const scale = square ? 1 : Math.min(1, size / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = square ? size : Math.round(img.width * scale)
  canvas.height = square ? size : Math.round(img.height * scale)
  const g = canvas.getContext('2d')!
  if (square) g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
  else g.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/webp', 0.85))
  return blob && blob.type === 'image/webp' ? blob : await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/jpeg', 0.85))
}
