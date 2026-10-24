export interface WorldLocation {
  slug: string
  label: string
  campusPortal: { x: number, y: number }
  npc: { x: number, y: number }
  interior: string
  npcBase: string
  portrait: string
  greeting: string
}

export const worldLocations: Record<string, WorldLocation> = {
  backend: {
    slug: 'backend', label: 'Backend', campusPortal: { x: 174, y: 265 }, npc: { x: 610, y: 320 },
    interior: '/content/backgrounds/interior_backend.png', npcBase: '/content/characters/npcs/npc_backend_base.png',
    portrait: '/content/characters/npcs/npc_backend_portrait.png',
    greeting: 'Я слежу, чтобы системы отвечали честно и вовремя. Выбирайте сценарий, когда будете готовы.',
  },
  frontend: {
    slug: 'frontend', label: 'Frontend', campusPortal: { x: 400, y: 210 }, npc: { x: 600, y: 320 },
    interior: '/content/backgrounds/interior_frontend.png', npcBase: '/content/characters/npcs/npc_frontend_base.png',
    portrait: '/content/characters/npcs/npc_frontend_portrait.png',
    greeting: 'Интерфейс — это разговор с человеком. Давайте найдём задачу, где он получится понятным.',
  },
  analytics: {
    slug: 'analytics', label: 'Analytics', campusPortal: { x: 640, y: 265 }, npc: { x: 595, y: 320 },
    interior: '/content/backgrounds/interior_analytics.png', npcBase: '/content/characters/npcs/npc_analytics_base.png',
    portrait: '/content/characters/npcs/npc_analytics_portrait.png',
    greeting: 'За каждым числом есть история. Выберите сценарий — вместе разберёмся в данных.',
  },
}

export function locationFor(slug: string): WorldLocation | undefined { return worldLocations[slug] }
