import type { ReactNode } from 'react'

type IconName = 'quests' | 'map' | 'contacts' | 'profile' | 'themes' | 'achievements' | 'help' | 'settings' | 'logout'
const icons: Record<IconName, ReactNode> = {
  quests: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M8.5 11l1.4 1.4 2.4-2.7M8.5 16h7"/></>,
  map: <><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14m6-12v14"/><circle cx="15" cy="10" r="1"/></>,
  contacts: <><rect x="4" y="4" width="16" height="17" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M8 17c.7-2.6 7.3-2.6 8 0M3 8h2m-2 5h2"/></>,
  profile: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-5.5 13.5-5.5 14 0"/></>,
  themes: <><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-.5a1.5 1.5 0 0 1 0-3H15a6 6 0 0 0 0-12z"/><circle cx="7" cy="10" r="1"/><circle cx="10" cy="6" r="1"/><circle cx="15" cy="6" r="1"/></>,
  achievements: <><path d="M8 4h8v4c0 3-1.8 5-4 5S8 11 8 8zM8 6H5v2c0 2 1.5 3 3.5 3M16 6h3v2c0 2-1.5 3-3.5 3M12 13v4m-4 3h8m-6-3h4"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.1 1.9c-1 .8-1.6 1.2-1.6 2.6m0 3h.01"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="7"/></>,
  logout: <><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m4-4 4-4-4-4m4 4H9"/></>,
}

export function PhoneIcon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
}
