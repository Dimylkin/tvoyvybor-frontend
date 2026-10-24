export interface DialogueChoice { text: string, reaction: string }

export interface WorldLocation {
  slug: string
  label: string
  campusPortal: { x: number, y: number, radius: number }
  npc: { x: number, y: number }
  exit: { x: number, y: number }
  floor: { top: number, bottom: number }
  scale: { min: number, max: number }
  interior: string
  npcBase: string
  portrait: string
  greeting: string
  choices: DialogueChoice[]
}

export const worldLocations: Record<string, WorldLocation> = {
  backend: {
    slug: 'backend', label: 'Backend', campusPortal: { x: 182, y: 282, radius: 56 }, npc: { x: 606, y: 334 }, exit: { x: 114, y: 348 }, floor: { top: 205, bottom: 415 }, scale: { min: .11, max: .16 },
    interior: '/content/backgrounds/interior_backend.png', npcBase: '/content/characters/npcs/npc_backend_base.png',
    portrait: '/content/characters/npcs/npc_backend_portrait.png',
    greeting: 'Я слежу, чтобы системы отвечали честно и вовремя. С чего начнём?',
    choices: [
      { text: 'Как сервер выдерживает нагрузку?', reaction: 'Разбиваем большую нагрузку на понятные части, измеряем узкие места и не забываем про запас прочности.' },
      { text: 'Почему API должно быть понятным?', reaction: 'Потому что хороший контракт экономит часы всей команде: и клиенту, и серверу, и будущему нам.' },
    ],
  },
  frontend: {
    slug: 'frontend', label: 'Frontend', campusPortal: { x: 401, y: 233, radius: 54 }, npc: { x: 598, y: 336 }, exit: { x: 116, y: 348 }, floor: { top: 205, bottom: 415 }, scale: { min: .11, max: .16 },
    interior: '/content/backgrounds/interior_frontend.png', npcBase: '/content/characters/npcs/npc_frontend_base.png',
    portrait: '/content/characters/npcs/npc_frontend_portrait.png',
    greeting: 'Интерфейс — это разговор с человеком. Что вам интереснее в этом разговоре?',
    choices: [
      { text: 'Как сделать интерфейс понятным?', reaction: 'Начните с задачи человека, а потом уберите всё, что мешает решить её с первого взгляда.' },
      { text: 'Зачем проверять интерфейс с людьми?', reaction: 'Даже аккуратная идея может быть непонятной. Реальная обратная связь быстрее всего показывает путь к ясности.' },
    ],
  },
  analytics: {
    slug: 'analytics', label: 'Analytics', campusPortal: { x: 636, y: 282, radius: 56 }, npc: { x: 593, y: 335 }, exit: { x: 116, y: 348 }, floor: { top: 205, bottom: 415 }, scale: { min: .11, max: .16 },
    interior: '/content/backgrounds/interior_analytics.png', npcBase: '/content/characters/npcs/npc_analytics_base.png',
    portrait: '/content/characters/npcs/npc_analytics_portrait.png',
    greeting: 'За каждым числом есть история. Какую историю попробуем услышать?',
    choices: [
      { text: 'С чего начать работу с данными?', reaction: 'С хорошего вопроса. Когда понятно, что нужно узнать, таблицы перестают быть просто набором чисел.' },
      { text: 'Можно ли доверять красивому графику?', reaction: 'Только после проверки источника, масштаба и контекста. Визуализация помогает думать, но не отменяет вопросов.' },
    ],
  },
}

export const devOpsSpot = { x: 710, y: 370, label: 'DevOps скоро' }
export function locationFor(slug: string): WorldLocation | undefined { return worldLocations[slug] }
