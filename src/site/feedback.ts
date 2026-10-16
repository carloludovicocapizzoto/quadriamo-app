// Modulo "Manda un feedback" del sito: scrive nella tabella feedback di Supabase (chiunque può inviare,
// solo l'amministratore legge). Email facoltativa, oppure anonimo.
import { ENV } from '../env'

const sb = ENV.supabase
const form = document.getElementById('fb-form') as HTMLFormElement | null

if (form) {
  let rating = 0
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
  const email = $<HTMLInputElement>('fb-email'), anon = $<HTMLInputElement>('fb-anon'), msg = $<HTMLTextAreaElement>('fb-msg')
  const notes = ['fb-ok', 'fb-empty', 'fb-bademail', 'fb-err']
  const show = (id: string | null) => notes.forEach(n => { $(n).hidden = n !== id })
  const stars = Array.from(form.querySelectorAll<HTMLButtonElement>('[data-star]'))
  stars.forEach(b => b.addEventListener('click', () => {
    rating = rating === Number(b.dataset.star) ? 0 : Number(b.dataset.star)
    stars.forEach(s => { s.classList.toggle('on', Number(s.dataset.star) <= rating); s.setAttribute('aria-pressed', String(Number(s.dataset.star) <= rating)) })
  }))
  anon.addEventListener('change', () => { email.disabled = anon.checked; if (anon.checked) email.value = '' })

  form.addEventListener('submit', async e => {
    e.preventDefault()
    const text = msg.value.trim(), mail = anon.checked ? '' : email.value.trim()
    if (!rating && !text) return show('fb-empty')
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return show('fb-bademail')
    if (!sb) return show('fb-err')
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    btn.disabled = true
    try {
      const res = await fetch(`${sb.url}/rest/v1/feedback`, {
        method: 'POST',
        headers: { apikey: sb.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ rating: rating || null, message: text || null, email: mail || null, source: 'site',
          lang: document.documentElement.lang, app_version: 'site' }),
      })
      if (!res.ok) throw new Error(String(res.status))
      form.reset(); rating = 0; stars.forEach(s => s.classList.remove('on')); email.disabled = false
      show('fb-ok')
    } catch { show('fb-err') } finally { btn.disabled = false }
  })
}
