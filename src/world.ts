export interface DialogueChoice { text: string, reaction: string, emotion: 'friendly' | 'thinking' | 'confused' | 'surprised' }
export interface Rect { x: number, y: number, width: number, height: number }

export interface WorldLocation {
  slug: string
  label: string
  name: string
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
  walkable: Rect[]
  blocking: Rect[]
}

export const worldLocations: Record<string, WorldLocation> = {
  backend: {
    slug: 'backend', label: 'Backend', name: 'Борис Бэкендович', campusPortal: { x: 182, y: 282, radius: 56 }, npc: { x: 606, y: 334 }, exit: { x: 114, y: 348 }, floor: { top: 205, bottom: 415 }, scale: { min: .11, max: .16 },
    interior: '/content/backgrounds/interior_backend.png', npcBase: '/content/characters/npcs/npc_backend_base.png',
    portrait: '/content/characters/npcs/npc_backend_portrait.png',
    greeting: 'Я слежу, чтобы системы отвечали честно и вовремя. С чего начнём?',
    choices: [
      { text: 'Чем ты занимаешься на работе?', reaction: 'Я соединяю интерфейсы, базы и серверы так, чтобы API не отвечал загадкой «работает у меня». Логи — мой детектив, а прод — место, где требования любят меняться без предупреждения.', emotion: 'thinking' },
      { text: 'Почему база данных так важна?', reaction: 'Потому что память сервера короткая, а у базы есть привычка помнить всё. Особенно тот запрос, который вы запустили без WHERE.', emotion: 'surprised' },
      { text: 'Что делать, если всё горит?', reaction: 'Сначала посмотреть логи, потом метрики, потом уже драматично сказать «у меня локально работало». Спокойный порядок спасает прод лучше героизма.', emotion: 'friendly' },
    ],
    walkable: [{ x: 82, y: 205, width: 636, height: 210 }], blocking: [{ x: 245, y: 220, width: 165, height: 95 }, { x: 455, y: 205, width: 110, height: 78 }],
  },
  frontend: {
    slug: 'frontend', label: 'Frontend', name: 'Фронтослав Пиксельевич', campusPortal: { x: 401, y: 233, radius: 54 }, npc: { x: 598, y: 336 }, exit: { x: 116, y: 348 }, floor: { top: 205, bottom: 415 }, scale: { min: .11, max: .16 },
    interior: '/content/backgrounds/interior_frontend.png', npcBase: '/content/characters/npcs/npc_frontend_base.png',
    portrait: '/content/characters/npcs/npc_frontend_portrait.png',
    greeting: 'Интерфейс — это разговор с человеком. Что вам интереснее в этом разговоре?',
    choices: [
      { text: 'Чем занимается frontend-разработчик?', reaction: 'Мы превращаем логику в понятный экран. CSS — не магия, но кнопка всё равно умеет уехать на два пикселя вниз в пятницу вечером.', emotion: 'friendly' },
      { text: 'Почему нельзя «просто поставить по центру»?', reaction: 'Можно, но сначала уточним: на каком экране, для кого и что должно быть рядом? UX начинается с вопроса, а не с transform: translate.', emotion: 'thinking' },
      { text: 'Зачем нужна адаптивность?', reaction: 'Потому что сайт не живёт только на ноутбуке разработчика. Телефон, планшет и очень решительный пользователь тоже имеют право на кнопку.', emotion: 'surprised' },
    ],
    walkable: [{ x: 82, y: 205, width: 636, height: 210 }], blocking: [{ x: 250, y: 225, width: 155, height: 85 }, { x: 445, y: 215, width: 120, height: 95 }],
  },
  analytics: {
    slug: 'analytics', label: 'Analytics', name: 'Анна Литикова', campusPortal: { x: 636, y: 282, radius: 56 }, npc: { x: 593, y: 335 }, exit: { x: 116, y: 348 }, floor: { top: 205, bottom: 415 }, scale: { min: .11, max: .16 },
    interior: '/content/backgrounds/interior_analytics.png', npcBase: '/content/characters/npcs/npc_analytics_base.png',
    portrait: '/content/characters/npcs/npc_analytics_portrait.png',
    greeting: 'За каждым числом есть история. Какую историю попробуем услышать?',
    choices: [
      { text: 'Чем занимается аналитик?', reaction: 'Мы задаём данным неудобные вопросы и не верим «очевидному» выводу, пока не посмотрим на источник, формулу и контекст.', emotion: 'thinking' },
      { text: 'Почему Excel иногда пугает?', reaction: 'Не Excel пугает, а формула отчёта, которую изменили после обеда. График красивый, но сначала выясним, что именно он считает.', emotion: 'confused' },
      { text: 'Зачем нужны графики?', reaction: 'Они помогают заметить закономерность, но не заменяют мысль. Хороший график отвечает на вопрос, а не просто радует цветом.', emotion: 'friendly' },
    ],
    walkable: [{ x: 82, y: 205, width: 636, height: 210 }], blocking: [{ x: 230, y: 220, width: 185, height: 95 }, { x: 460, y: 215, width: 105, height: 80 }],
  },
}

export const devOpsSpot = { x: 710, y: 370, label: 'DevOps скоро' }
export const campusWalkable: Rect[] = [{ x: 28, y: 90, width: 744, height: 365 }]
export const campusBlocking: Rect[] = [{ x: 25, y: 92, width: 185, height: 130 }, { x: 275, y: 90, width: 250, height: 105 }, { x: 585, y: 92, width: 185, height: 130 }, { x: 245, y: 350, width: 330, height: 70 }]
export function isWalkable(x: number, y: number, walkable: Rect[], blocking: Rect[]) { return walkable.some((area) => x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height) && !blocking.some((area) => x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height) }
export function locationFor(slug: string): WorldLocation | undefined { return worldLocations[slug] }
