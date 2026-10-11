import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './admin.css'
import { AdminApp } from './AdminApp'

createRoot(document.getElementById('root')!).render(<StrictMode><AdminApp /></StrictMode>)

// Interfaccia ferma come un'app: niente zoom con due dita (iOS ignora user-scalable=no); il doppio tocco lo blocca il CSS
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false })
