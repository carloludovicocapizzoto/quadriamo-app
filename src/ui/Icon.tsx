// Icone dell'app: un solo stile (tratto 1.75, angoli arrotondati), al posto di emoji e simboli di testo.
const P: Record<string, string> = {
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z',
  month: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5ZM4 10h16M8.5 3v4M15.5 3v4',
  list: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  year: 'M5 20V12M10 20V6M15 20v-9M20 20V4',
  growth: 'M4 17l5.5-5.5 4 4L20 9M14.5 9H20v5.5',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.3 1-1.8 3.1-1.6-.5a7 7 0 0 1-1.9 1.1L15 20h-3.6l-.4-1.8a7 7 0 0 1-1.9-1.1l-1.6.5-1.8-3.1 1.3-1a7 7 0 0 1 0-2.2l-1.3-1 1.8-3.1 1.6.5a7 7 0 0 1 1.9-1.1L11.4 4H15l.4 1.8a7 7 0 0 1 1.9 1.1l1.6-.5 1.8 3.1-1.3 1a7 7 0 0 1 0 2.2Z',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3ZM14.5 7.5l3 3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  close: 'M6 6l12 12M18 6 6 18',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15ZM10 20.5a2 2 0 0 0 4 0',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8',
  chevron: 'M9 6l6 6-6 6',
  share: 'M12 15V4M8 8l4-4 4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13',
  back: 'M15 6l-6 6 6 6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  key: 'M14.5 13a4.5 4.5 0 1 0-4.2-2.9L4 16.4V20h3.5v-2h2v-2h2l.8-.8A4.5 4.5 0 0 0 14.5 13ZM16 8.5h.01',
  lock: 'M6 11h12v9H6ZM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  alert: 'M12 4 2.8 19.5h18.4ZM12 10v4.5M12 17.2h.01',
  upload: 'M12 16V4M7.5 8.5 12 4l4.5 4.5M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16',
  chart: 'M5 20V12M10 20V6M15 20v-9M20 20V4',
  mail: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5ZM4.5 6.5 12 12l7.5-5.5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 12h.01',
  plane: 'M21 3 3 10.5l7 2.5 2.5 7L21 3ZM10 13l5-5',
  car: 'M5 15.5V12l2-5h10l2 5v3.5M3.5 15.5h17v3h-17ZM7 19v1.5M17 19v1.5M7 12h10',
  gift: 'M4 11h16v9H4ZM3 7.5h18V11H3ZM12 7.5V20M12 7.5c-1.4-3-5-3.2-5-.8 0 .8 1 .8 5 .8Zm0 0c1.4-3 5-3.2 5-.8 0 .8-1 .8-5 .8Z',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20Z',
  minus: 'M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  filter: 'M4 6h16M7 12h10M10 18h4',
  news: 'M5 5h11v14H6.5A1.5 1.5 0 0 1 5 17.5ZM16 9h3v8.5a1.5 1.5 0 0 1-3 0ZM8 9h5M8 12.5h5M8 16h3',
  refresh: 'M19.5 8A8 8 0 1 0 20 13M20 4v4.5h-4.5',
  message: 'M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4Z',
}
export type IconName = keyof typeof P

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`ico${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  )
}
