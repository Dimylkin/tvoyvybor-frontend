import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import React from 'react'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator })
globalThis.localStorage = dom.window.localStorage
globalThis.sessionStorage = dom.window.sessionStorage
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.MutationObserver = dom.window.MutationObserver
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.__testCanvasReadyEnabled = true
globalThis.__testCanvasReadyCallbacks = new Set()

const { render, screen, fireEvent, waitFor, cleanup, act } = await import('@testing-library/react')
function setCanvasReadySignal(enabled) {
  globalThis.__testCanvasReadyEnabled = enabled
  if (enabled) {
    for (const notifyReady of globalThis.__testCanvasReadyCallbacks) notifyReady()
    globalThis.__testCanvasReadyCallbacks.clear()
  }
}
const canvasTestDouble = decodeURIComponent(new URL('./testCanvasMocks.tsx', import.meta.url).pathname)
const vite = await createServer({
  plugins: [{
    name: 'app-canvas-test-doubles',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer?.replaceAll('\\', '/').endsWith('/src/App.tsx') && ['./GameCanvas', './CampusCanvas'].includes(source)) {
        return canvasTestDouble
      }
      return null
    },
  }],
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
})
const { default: App, Dialogue } = await vite.ssrLoadModule('/src/App.tsx')

const user = { id: 1, email: 'player@example.com', role: 'user', onboarding_completed: true, intro_completed: true, main_story_completed: false }
const direction = { id: 3, slug: 'backend', title: 'Backend', description: 'Серверная разработка' }
const scenario = { id: 7, direction_id: 3, slug: 'first', title: 'Первый сценарий', description: 'Проверка сервера', state: 'active' }

function mockApi({ login = false, loginError = null, register = false, me = user, meStatus = 200, directions = [direction], scenarios = [scenario], progress = [{ scenario_id: 7, state: 'completed' }] } = {}) {
  const requests = []
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input), 'http://localhost:5173').pathname
    const authorization = new Headers(init?.headers).get('Authorization')
    requests.push({ path, authorization, method: init?.method })
    if (path === '/api/auth/register' && register) return Response.json(me)
    if (path === '/api/auth/login') {
      if (login) return Response.json({ access_token: 'test-token', token_type: 'bearer' })
      if (loginError) return Response.json({ detail: loginError }, { status: 401 })
    }
    if (path === '/api/auth/me') return meStatus === 401 ? Response.json({ detail: 'Invalid authentication credentials' }, { status: 401 }) : Response.json(me)
    if (path === '/api/quests') return Response.json([])
    if (path === '/api/game/state') return Response.json({ intro_completed: me.intro_completed ?? true, final_quest_unlocked: false, final_quest_completed: me.main_story_completed ?? false, main_story_completed: me.main_story_completed ?? false })
    if (path === '/api/game/intro-complete') return Response.json({ intro_completed: true, final_quest_unlocked: false, final_quest_completed: false, main_story_completed: false })
    if (path === '/api/directions') return Response.json(directions)
    if (path === '/api/scenarios') return Response.json(scenarios)
    if (path === '/api/progress') return Response.json(progress)
    throw new Error(`Unexpected API request: ${path}`)
  }
  return requests
}

afterEach(() => {
  cleanup()
  setCanvasReadySignal(true)
  globalThis.sessionStorage = window.sessionStorage
  localStorage.clear()
  window.location.hash = ''
})
after(async () => {
  await vite.close()
  dom.window.close()
})

test('login opens the compact campus game shell without loading scenarios', async () => {
  const requests = mockApi({ login: true })
  render(React.createElement(App))
  fireEvent.change(screen.getByLabelText('Электронная почта'), { target: { value: 'player@example.com' } })
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }))

  assert.ok(await screen.findByRole('region', { name: 'Игровая область' }))
  assert.equal(localStorage.getItem('tvoyvybor.accessToken'), 'test-token')
  assert.ok(requests.some((request) => request.path === '/api/directions' && request.authorization === 'Bearer test-token'))
  assert.ok(!requests.some((request) => request.path === '/api/progress'))
})

test('registering a new player on /register opens the prologue in the campus hub', async () => {
  window.location.hash = '/register'
  const requests = mockApi({ login: true, register: true, me: { ...user, onboarding_completed: false, intro_completed: false }, directions: [] })
  setCanvasReadySignal(false)
  render(React.createElement(App))
  fireEvent.change(screen.getByLabelText('Электронная почта'), { target: { value: 'new-player@example.com' } })
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

  assert.ok(await screen.findByLabelText('Игровая сцена'))
  assert.equal(screen.queryByRole('dialog', { name: 'Разговор: Дядя Дебаг' }), null)
  act(() => setCanvasReadySignal(true))
  assert.ok(await screen.findByRole('dialog', { name: 'Разговор: Дядя Дебаг' }))
  for (let step = 0; step < 5; step++) {
    const choice = screen.getByRole('dialog').querySelector('button')
    assert.ok(choice)
    fireEvent.click(choice)
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
  }
  await waitFor(() => assert.ok(!screen.queryByRole('dialog', { name: 'Разговор: Дядя Дебаг' })))
  assert.ok(requests.some((request) => request.path === '/api/game/intro-complete' && request.method === 'PUT'))
  fireEvent.click(screen.getByRole('button', { name: 'Телефон · Tab' }))
  assert.ok(screen.getByRole('dialog', { name: 'CampusOS' }))
})

test('invalid login credentials show an authentication error instead of an expired-session message', async () => {
  mockApi({ loginError: 'Invalid credentials' })
  render(React.createElement(App))
  fireEvent.change(screen.getByLabelText('Электронная почта'), { target: { value: 'player@example.com' } })
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'wrong-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }))

  const alert = await screen.findByRole('alert')
  assert.equal(alert.textContent, 'Неверный адрес электронной почты или пароль.')
})

test('saved token restores the session and server status after remount', async () => {
  localStorage.setItem('tvoyvybor.accessToken', 'saved-token')
  window.location.hash = '/hub'
  const requests = mockApi()
  render(React.createElement(App))

  assert.ok(await screen.findByRole('region', { name: 'Игровая область' }))
  assert.ok(requests.some((request) => request.path === '/api/auth/me' && request.authorization === 'Bearer saved-token'))
  assert.ok(!requests.some((request) => request.path === '/api/progress'))
})

test('a new player starts in the main building and remains there after the prologue', async () => {
  localStorage.setItem('tvoyvybor.accessToken', 'saved-token')
  window.location.hash = '/hub'
  mockApi({ me: { ...user, onboarding_completed: false, intro_completed: false }, directions: [] })
  const fetchApi = globalThis.fetch
  globalThis.fetch = async (input, init) => new URL(String(input), 'http://localhost:5173').pathname === '/api/game/intro-complete'
    ? Response.json({ intro_completed: true, final_quest_unlocked: false, final_quest_completed: false, main_story_completed: false }) : fetchApi(input, init)
  render(React.createElement(App))

  assert.ok(await screen.findByLabelText('Игровая сцена'))
  assert.ok(await screen.findByRole('dialog', { name: 'Разговор: Дядя Дебаг' }))
  for (let step = 0; step < 5; step++) {
    const choice = screen.getByRole('dialog').querySelector('button')
    assert.ok(choice)
    fireEvent.click(choice)
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
  }
  await waitFor(() => assert.ok(!screen.queryByRole('dialog', { name: 'Разговор: Дядя Дебаг' })))
  assert.ok(screen.getByLabelText('Игровая сцена'))
  assert.equal(screen.queryByLabelText('Игровой кампус'), null)
  act(() => setCanvasReadySignal(true))
  fireEvent.click(screen.getByRole('button', { name: 'Телефон · Tab' }))
  assert.ok(screen.getByRole('dialog', { name: 'CampusOS' }))
})

test('the main building route restores its interior for an existing player', async () => {
  localStorage.setItem('tvoyvybor.accessToken', 'saved-token')
  window.location.hash = '/building/main'
  mockApi()
  render(React.createElement(App))
  assert.ok(await screen.findByLabelText('Игровая сцена'))
  assert.equal(screen.queryByLabelText('Игровой кампус'), null)
})

test('campus keeps entrances inside the scene and exposes fullscreen control', async () => {
  localStorage.setItem('tvoyvybor.accessToken', 'saved-token')
  window.location.hash = '/hub'
  mockApi({
    directions: [
      direction,
      { id: 4, slug: 'frontend', title: 'Frontend', description: 'Интерфейсы' },
      { id: 5, slug: 'analytics', title: 'Аналитика', description: 'Работа с данными' },
    ],
    scenarios: [
      { ...scenario, id: 8, title: 'API без сюрпризов', state: 'completed' },
      { ...scenario, id: 9, direction_id: 4, title: 'Кнопка на месте', state: 'available' },
      { ...scenario, id: 10, direction_id: 5, title: 'Отчёт без магии', state: 'active' },
    ],
    progress: [{ scenario_id: 8, state: 'completed' }, { scenario_id: 9, state: 'available' }, { scenario_id: 10, state: 'active' }],
  })
  render(React.createElement(App))

  assert.ok(await screen.findByLabelText('Игровой кампус'))
  assert.ok(screen.getByRole('button', { name: 'На весь экран' }))
  assert.equal(screen.queryByRole('button', { name: 'Помощь · F1' }), null)
  assert.ok(screen.getByRole('button', { name: 'Телефон · Tab' }))
  assert.equal(screen.queryByText('Первый сценарий'), null)
  assert.equal(screen.queryByRole('button', { name: /Войти:/ }), null)
})

test('401 while restoring the session clears the token and opens login', async () => {
  localStorage.setItem('tvoyvybor.accessToken', 'expired-token')
  window.location.hash = '/hub'
  mockApi({ meStatus: 401 })
  render(React.createElement(App))

  await waitFor(() => assert.ok(screen.getByRole('heading', { name: 'Войти в игру' })))
  assert.equal(localStorage.getItem('tvoyvybor.accessToken'), null)
})

test('admin session exposes the protected content screen', async () => {
  localStorage.setItem('tvoyvybor.accessToken', 'admin-token')
  window.location.hash = '/admin'
  mockApi({
    me: { ...user, role: 'admin' },
    scenarios: [],
  })
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input), 'http://localhost:5173').pathname
    if (path === '/api/auth/me') return Response.json({ ...user, role: 'admin' })
    if (path === '/api/directions') return Response.json([direction])
    if (path === '/api/admin/scenarios') return Response.json([])
    return originalFetch(input, init)
  }
  render(React.createElement(App))

  assert.ok(await screen.findByRole('heading', { name: 'Администрирование' }))
  assert.ok(screen.getByRole('link', { name: 'Администрирование' }))
  assert.ok(await screen.findByText('Новый сценарий'))
})

test('opening phone preserves the building scene and allows keyboard navigation', async () => {
  localStorage.setItem('tvoyvybor.accessToken', 'saved-token')
  window.location.hash = '/building/3'
  mockApi()
  render(React.createElement(App))
  const scene = await screen.findByLabelText('Игровая сцена')
  fireEvent.keyDown(window, { key: 'Tab' })
  assert.ok(screen.getByRole('dialog', { name: 'CampusOS' }))
  fireEvent.click(screen.getByRole('button', { name: 'Справка' }))
  assert.ok(screen.getByRole('heading', { name: 'Справка' }))
  fireEvent.keyDown(window, { key: 'Escape' })
  assert.equal(screen.queryByRole('dialog', { name: 'CampusOS' }), null)
  assert.equal(screen.getByLabelText('Игровая сцена'), scene)
})

test('dialogue separates player speech from choices and returns to the topic menu', async () => {
  const { worldLocations } = await vite.ssrLoadModule('/src/world.ts')
  let closed = 0
  const location = worldLocations.frontend
  const { container } = render(React.createElement(Dialogue, { location, onClose: () => { closed++ } }))
  const panel = container.querySelector('.dialogue-overlay')
  assert.equal(container.querySelectorAll('.dialogue-overlay').length, 1)
  assert.ok(container.querySelector('.dialogue-choices').contains(screen.getByText('До встречи')))
  fireEvent.keyDown(window, { key: ' ', code: 'Space' })
  assert.ok(screen.getByText(location.greeting))
  fireEvent.click(screen.getByText(location.choices[0].text))
  assert.equal(container.querySelector('.dialogue-overlay'), panel)
  assert.ok(panel.classList.contains('player-line'))
  assert.ok(panel.textContent.includes('Стажёр Ноль'))
  assert.ok(panel.textContent.includes(location.choices[0].text))
  assert.equal(panel.lastElementChild.tagName, 'IMG')
  assert.equal(container.querySelector('.dialogue-choices'), null)
  assert.equal(screen.queryByRole('button', { name: /Пробел.*Продолжить/ }), null)
  assert.doesNotMatch(panel.textContent, /Esc —|Выберите ответ/)
  fireEvent.keyDown(window, { key: ' ', code: 'Space' })
  assert.ok(panel.textContent.includes(location.choices[0].reaction))
  assert.equal(panel.firstElementChild.tagName, 'IMG')
  assert.equal(panel.querySelector('button'), null)
  fireEvent.click(screen.getByText('Выбрать другую тему'))
  assert.ok(panel.textContent.includes(location.greeting))
  fireEvent.click(screen.getByText('До встречи'))
  assert.equal(closed, 1)
})

test('dialogue ignores repeated keys and editable targets while Space advances a spoken line', async () => {
  const { worldLocations } = await vite.ssrLoadModule('/src/world.ts')
  let closed = 0
  render(React.createElement(Dialogue, { location: worldLocations.backend, onClose: () => { closed++ } }))
  fireEvent.keyDown(window, { key: '1', repeat: true })
  assert.equal(screen.queryByText('Стажёр Ноль'), null)
  fireEvent.keyDown(window, { key: '1' })
  assert.ok(screen.getByText('Стажёр Ноль'))
  fireEvent.keyDown(window, { key: ' ', code: 'Space', repeat: true })
  fireEvent.keyDown(window, { key: '1' })
  assert.equal(screen.queryByText(worldLocations.backend.choices[0].reaction), null)
  for (const tag of ['input', 'textarea', 'select', 'div']) {
    const editable = document.createElement(tag)
    if (tag === 'div') editable.setAttribute('contenteditable', 'true')
    document.body.append(editable)
    editable.focus()
    fireEvent.keyDown(editable, { key: ' ', code: 'Space' })
    fireEvent.keyDown(editable, { key: 'Escape' })
    assert.equal(screen.queryByText(worldLocations.backend.choices[0].reaction), null)
    assert.equal(closed, 0)
    editable.remove()
  }
  fireEvent.keyDown(window, { key: ' ', code: 'Space' })
  assert.ok(screen.getByText(worldLocations.backend.choices[0].reaction))
  fireEvent.keyDown(window, { key: 'Escape', repeat: true })
  assert.equal(closed, 0)
  fireEvent.keyDown(window, { key: 'Escape' })
  assert.equal(closed, 1)
})

test('Space does not choose a required scene response', () => {
  let selected = 0, advanced = 0
  const location = { slug: 'frontend', name: 'Фронтина', portrait: '/content/characters/npcs/npc_frontend_portrait.png', choices: [] }
  const { rerender } = render(React.createElement(Dialogue, { location, onClose: () => {}, scene: { text: 'У нас катастрофа.', choices: [{ text: 'Сайт упал?', select: () => { selected++ } }] } }))
  fireEvent.keyDown(window, { key: ' ', code: 'Space' })
  assert.equal(selected, 0)
  fireEvent.click(screen.getByText('Сайт упал?'))
  assert.equal(selected, 1)
  rerender(React.createElement(Dialogue, { location, onClose: () => {}, scene: { text: 'Сайт упал?', speaker: 'player', choices: [], advance: () => { advanced++ } } }))
  assert.equal(document.querySelector('.dialogue-choices'), null)
  fireEvent.keyDown(window, { key: ' ', code: 'Space' })
  assert.equal(advanced, 1)
})

test('quest journal shows persisted status and tracks an active quest', async () => {
  const { CampusPhone } = await vite.ssrLoadModule('/src/campusos/CampusPhone.tsx')
  const calls = []
  const quest = { id: 1, slug: 'server-on-vacation', title: 'Сервер ушёл в отпуск', description: 'Починить сервер', category: 'professional', location_slug: 'backend', giver_npc_id: 'boris', status: 'active', accepted_at: null, completed_at: null, tracked: false, objectives: [{ id: 1, title: 'Осмотреть сервер', description: '', objective_type: 'object_inspected', required_count: 1, current_count: 0, completed: false, is_required: true }] }
  const api = { trackQuest: async (id) => { calls.push(id) } }
  let reloads = 0
  render(React.createElement(CampusPhone, { api, user, quests: [quest], reload: async () => { reloads++ }, close: () => {}, logout: () => {}, profile: null, results: null }))
  fireEvent.click(screen.getByRole('button', { name: 'Задачи' }))
  fireEvent.click(screen.getByRole('button', { name: /Сервер ушёл в отпуск/ }))
  assert.ok(screen.getByText(/Осмотреть сервер/))
  fireEvent.click(screen.getByRole('button', { name: 'Отслеживать' }))
  await waitFor(() => assert.equal(reloads, 1))
  assert.deepEqual(calls, [1])
})

test('game interaction retries an uncertain delivery using the same operation id', async () => {
  const { QuestInteraction } = await vite.ssrLoadModule('/src/campusos/QuestInteraction.tsx')
  globalThis.sessionStorage = window.sessionStorage
  sessionStorage.clear()
  const ids = []
  const api = { questAction: async (_quest, id) => { ids.push(id); if (ids.length === 1) throw new Error('offline'); return { state: {}, awards: [] } } }
  const quest = { id: 1, slug: 'server-on-vacation', title: 'Сервер', description: '', category: 'professional', location_slug: 'backend', giver_npc_id: 'boris', status: 'active', accepted_at: null, completed_at: null, tracked: false, gameplay: { kind: 'diagnosis', state: { stage: 'interaction' } }, objectives: [] }
  render(React.createElement(QuestInteraction, { api, quest, target: 'terminal', reload: async () => {}, close: () => {}, onAwards: () => {}, userId: 1 }))
  fireEvent.click(screen.getByRole('button', { name: 'Начать работу на станции' }))
  assert.ok(await screen.findByRole('alert'))
  fireEvent.click(screen.getByRole('button', { name: 'Начать работу на станции' }))
  await waitFor(() => assert.equal(screen.queryByRole('alert'), null))
  assert.equal(ids.length, 2)
  assert.equal(ids[0], ids[1])
  sessionStorage.clear()
})

test('game interaction stays retryable when session storage is unavailable', async () => {
  const { QuestInteraction } = await vite.ssrLoadModule('/src/campusos/QuestInteraction.tsx')
  globalThis.sessionStorage = {
    getItem() { throw new DOMException('Storage disabled', 'SecurityError') },
    setItem() { throw new DOMException('Storage disabled', 'SecurityError') },
    removeItem() { throw new DOMException('Storage disabled', 'SecurityError') },
  }
  const ids = []
  const api = { questAction: async (_quest, id) => { ids.push(id); if (ids.length === 1) throw new Error('offline'); return { state: {}, awards: [] } } }
  const quest = { id: 1, slug: 'server-on-vacation', title: 'Сервер', description: '', category: 'professional', location_slug: 'backend', giver_npc_id: 'boris', status: 'active', accepted_at: null, completed_at: null, tracked: false, gameplay: { kind: 'diagnosis', state: { stage: 'interaction' } }, objectives: [] }
  render(React.createElement(QuestInteraction, { api, quest, target: 'terminal', reload: async () => {}, close: () => {}, onAwards: () => {}, userId: 91 }))

  fireEvent.click(screen.getByRole('button', { name: 'Начать работу на станции' }))
  assert.ok(await screen.findByRole('alert'))
  fireEvent.click(screen.getByRole('button', { name: 'Начать работу на станции' }))
  await waitFor(() => assert.equal(screen.queryByRole('alert'), null))
  assert.equal(ids.length, 2)
  assert.equal(ids[0], ids[1])
  globalThis.sessionStorage = window.sessionStorage
})

test('retry keeps the operation id when refreshing the journal fails', async () => {
  const { QuestInteraction } = await vite.ssrLoadModule('/src/campusos/QuestInteraction.tsx')
  globalThis.sessionStorage = window.sessionStorage
  sessionStorage.clear()
  const ids = []
  let refreshes = 0
  const api = { questAction: async (_quest, id) => { ids.push(id); return { state: {}, awards: [] } } }
  const quest = { id: 1, title: 'Пятничный релиз', location_slug: 'backend', status: 'active', gameplay: { kind: 'diagnosis', state: { stage: 'interaction' } }, objectives: [] }
  const reload = async () => { if (++refreshes === 1) throw new Error('offline') }
  render(React.createElement(QuestInteraction, { api, quest, target: 'terminal', reload, close: () => {}, onAwards: () => {}, userId: 1 }))
  fireEvent.click(screen.getByRole('button', { name: 'Начать работу на станции' }))
  assert.ok(await screen.findByRole('alert'))
  fireEvent.click(screen.getByRole('button', { name: 'Начать работу на станции' }))
  await waitFor(() => assert.equal(screen.queryByRole('alert'), null))
  assert.equal(ids.length, 2)
  assert.equal(ids[0], ids[1])
  sessionStorage.clear()
})

test('phone gesture indicator returns from an app to the home screen', async () => {
  const { CampusPhone } = await vite.ssrLoadModule('/src/campusos/CampusPhone.tsx')
  render(React.createElement(CampusPhone, { api: {}, user, quests: [], loading: false, loadError: '', reload: async () => {}, close: () => {}, logout: () => {}, profile: null, results: null }))
  fireEvent.click(screen.getByRole('button', { name: 'Карта' }))
  assert.ok(screen.getByRole('heading', { name: 'Карта' }))
  assert.equal(screen.queryByRole('button', { name: /Домой/ }), null)
  fireEvent.click(screen.getByRole('button', { name: 'На главный экран телефона' }))
  assert.ok(screen.getByRole('button', { name: 'Карта' }))
})

test('game controls stay visible on hover and hide after the pointer leaves', async () => {
  const { WorldControls } = await vite.ssrLoadModule('/src/WorldControls.tsx')
  const { container } = render(React.createElement(WorldControls, { fullscreen: false, toggleFullscreen: () => {}, openPhone: () => {}, isAdmin: false }))
  const area = container.querySelector('.world-control-bottom')
  assert.ok(area.classList.contains('is-visible'))
  fireEvent.pointerEnter(area)
  await new Promise((resolve) => setTimeout(resolve, 2600))
  assert.ok(area.classList.contains('is-visible'))
  fireEvent.pointerLeave(area)
  await waitFor(() => assert.equal(area.classList.contains('is-visible'), false), { timeout: 3500 })
  fireEvent.pointerEnter(area)
  assert.ok(area.classList.contains('is-visible'))
})

test('contacts open a character card and only Escape dismisses the phone', async () => {
  const { CampusPhone } = await vite.ssrLoadModule('/src/campusos/CampusPhone.tsx')
  let closed = 0
  render(React.createElement(CampusPhone, { api: {}, user, quests: [], loading: false, loadError: '', reload: async () => {}, close: () => { closed++ }, logout: () => {}, profile: null, results: null }))
  assert.equal(screen.queryByRole('button', { name: 'Закрыть телефон' }), null)
  fireEvent.click(screen.getByRole('button', { name: 'Контакты' }))
  const contact = screen.getByRole('button', { name: /Борис Бэкендович/ })
  assert.ok(contact.querySelector('img').getAttribute('src').endsWith('npc_backend_portrait.png'))
  fireEvent.click(contact)
  assert.ok(screen.getByRole('heading', { name: 'Борис Бэкендович' }))
  assert.ok(screen.getByText('Backend-мастер'))
  assert.ok(screen.getByRole('img', { name: 'Портрет: Борис Бэкендович' }))
  fireEvent.click(screen.getByRole('button', { name: 'На главный экран телефона' }))
  assert.equal(closed, 0)
  assert.ok(screen.getByRole('button', { name: 'Контакты' }))
  assert.equal(screen.queryByRole('button', { name: 'Свернуть телефон' }), null)
  fireEvent.keyDown(window, { key: 'Escape' })
  assert.equal(closed, 1)
})

test('phone profile displays the same player appearance used by the world', async () => {
  const { CampusPhone } = await vite.ssrLoadModule('/src/campusos/CampusPhone.tsx')
  const { playerAppearance } = await vite.ssrLoadModule('/src/playerAppearance.ts')
  render(React.createElement(CampusPhone, { api: {}, user, quests: [], loading: false, loadError: '', reload: async () => {}, close: () => {}, logout: () => {}, profile: null, results: null }))
  fireEvent.click(screen.getByRole('button', { name: 'Профиль' }))
  assert.equal(screen.getByRole('img', { name: 'Игровой персонаж — робот' }).getAttribute('src'), playerAppearance.front)
  assert.ok(screen.getByText(user.email))
})

const gameState = { stage: 'mini-game', seen: [], attempts: 0, hints: 0, example_used: false, extra_exploration: 0, active_seconds: 0, voluntary: true, success: false, feedback: '' }
function gameQuest(kind, state = {}) {
  return { id: 20, title: 'Игровая ситуация', description: 'Исследуйте проблему', location_slug: 'backend', giver_npc_id: 'boris', status: 'active', accepted_at: '2026-11-07T00:00:00Z', completed_at: null, objectives: [], gameplay: { kind, state: { ...gameState, ...state } } }
}

test('phone only starts a quest after explicit action and then directs the player to the NPC', async () => {
  const { CampusPhone } = await vite.ssrLoadModule('/src/campusos/CampusPhone.tsx')
  const calls = []
  let quest = { ...gameQuest('diagnosis', { stage: 'intro' }), status: 'available', accepted_at: null }
  let release
  const acceptance = new Promise(resolve => { release = resolve })
  const api = {
    offerQuest: async (...args) => calls.push(['offer', ...args]),
    acceptQuest: async id => { calls.push(['accept', id]); await acceptance; quest = { ...quest, status: 'active' } },
    trackQuest: async id => { calls.push(['track', id]); quest = { ...quest, tracked: true } },
  }
  const props = { api, user, loading: false, loadError: '', close: () => {}, logout: () => {}, profile: null, results: null }
  const view = render(React.createElement(CampusPhone, { ...props, quests: [quest], reload: async () => { view.rerender(React.createElement(CampusPhone, { ...props, quests: [quest], reload: async () => {} })) } }))
  fireEvent.click(screen.getByRole('button', { name: 'Задачи' }))
  fireEvent.click(screen.getByRole('button', { name: 'Доступные' }))
  fireEvent.click(screen.getByRole('button', { name: /Игровая ситуация/ }))
  assert.deepEqual(calls, [])
  assert.ok(screen.getByText('Задание ещё не начато. Можно принять его здесь.'))
  assert.equal(screen.queryByRole('button', { name: 'Отслеживать' }), null)
  fireEvent.click(screen.getByRole('button', { name: 'Начать задание' }))
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Начать задание' }).disabled))
  fireEvent.click(screen.getByRole('button', { name: 'Начать задание' }))
  release()
  await screen.findByText('Поговорите с Борисом')
  assert.deepEqual(calls, [['offer', quest.id, 'boris'], ['accept', quest.id], ['track', quest.id]])
  assert.ok(screen.getByRole('button', { name: 'Не отслеживать' }))
  assert.equal(screen.queryByRole('button', { name: 'Начать задание' }), null)
})

test('NPC automatically resumes the accepted quest intro and persists each spoken line', async () => {
  const { QuestConversation } = await vite.ssrLoadModule('/src/campusos/QuestInteraction.tsx')
  const { locationFor } = await vite.ssrLoadModule('/src/world.ts')
  const { introductions } = await vite.ssrLoadModule('/src/campusos/questContent.ts')
  const calls = []
  let quest = gameQuest('diagnosis', { stage: 'intro', intro_line: 0 })
  const api = { questAction: async (id, requestId, action, payload) => {
    calls.push({ id, requestId, action, payload })
    quest = { ...quest, gameplay: { ...quest.gameplay, state: { ...quest.gameplay.state, ...(action === 'intro-line' ? { intro_line: Number(payload.value) } : { stage: 'interaction' }) } } }
    return { state: quest.gameplay.state, awards: [] }
  } }
  let closed = 0
  const props = { api, location: locationFor('backend'), close: () => { closed++ }, userId: 1, onAwards: () => {} }
  const reload = async () => view.rerender(React.createElement(QuestConversation, { ...props, quests: [quest], reload }))
  const view = render(React.createElement(QuestConversation, { ...props, quests: [quest], reload }))
  assert.ok(screen.getByText('О, привет! Как дела?'))
  fireEvent.keyDown(window, { key: 'Enter' })
  assert.ok(screen.getByText('О, привет! Как дела?'))
  fireEvent.click(screen.getByText('Нормально. Что случилось?'))
  assert.ok(document.querySelector('.player-line'))
  fireEvent.keyDown(window, { key: 'Enter' })
  assert.ok(screen.getByText('Мы внесли небольшое изменение.'))
  assert.equal(screen.queryByRole('button', { name: /Игровая ситуация/ }), null)
  fireEvent.keyDown(window, { key: ' ', code: 'Space' })
  assert.deepEqual(calls, [])
  const lines = introductions.diagnosis
  for (let line = 1; line < lines.length; line++) {
    if (lines[line].speaker === 'player' && lines[line - 1].speaker !== 'player') fireEvent.click(screen.getByText(lines[line].text))
    else fireEvent.keyDown(window, { key: ' ', code: 'Space' })
    await screen.findByText(lines[line].text)
    await waitFor(() => assert.ok(screen.queryAllByRole('button').every(button => !button.disabled)))
    assert.equal(calls.at(-1).action, 'intro-line')
    assert.equal(calls.at(-1).payload.value, String(line))
    if (lines[line].speaker === 'player') assert.equal(document.querySelector('.dialogue-choices'), null)
  }
  fireEvent.click(screen.getByText('Пойду посмотрю.'))
  await waitFor(() => assert.equal(closed, 1))
  assert.equal(calls.at(-1).action, 'intro-complete')
  assert.equal(new Set(calls.map(c => c.requestId)).size, calls.length)
})

test('profession questions return to the active quest without reopening the NPC', async () => {
  const { QuestConversation } = await vite.ssrLoadModule('/src/campusos/QuestInteraction.tsx')
  const { locationFor } = await vite.ssrLoadModule('/src/world.ts')
  render(React.createElement(QuestConversation, { api: {}, quests: [gameQuest('diagnosis')], location: locationFor('backend'), close: () => {}, reload: async () => {}, userId: 1, onAwards: () => {} }))
  fireEvent.click(screen.getByText('Поговорим о профессии'))
  fireEvent.click(screen.getByRole('button', { name: 'К основному разговору' }))
  assert.ok(screen.getByText(/Ну как, есть новости/))
})

test('responsive edits update the preview immediately and save once before a queued check', async () => {
  const { FrontendGame } = await vite.ssrLoadModule('/src/campusos/games/FrontendGame.tsx')
  const calls = []
  const props = { quest: gameQuest('responsive'), busy: false, send: async (...args) => { calls.push(args) } }
  render(React.createElement(FrontendGame, props))
  fireEvent.click(screen.getByRole('button', { name: 'Mobile' }))
  assert.equal(document.querySelector('.workbench-device').style.width, '320px')
  await waitFor(() => assert.deepEqual(calls.at(-1), ['device', { value: 'Mobile' }]))
  const width = screen.getByLabelText('Ширина карточки, %')
  for (const value of ['100', '90', '92']) fireEvent.change(width, { target: { value } })
  assert.equal(document.querySelector('.workbench-card').style.width, '92%')
  assert.equal(calls.filter(([action]) => action === 'property').length, 0)
  fireEvent.blur(width)
  fireEvent.click(screen.getByRole('button', { name: 'Проверить макет' }))
  await waitFor(() => assert.equal(calls.at(-1)[0], 'verify'))
  assert.deepEqual(calls.filter(([action]) => action === 'property'), [['property', { key: 'width', value: '92' }]])
  assert.ok(calls.findIndex(([action]) => action === 'property') < calls.findIndex(([action]) => action === 'verify'))
})

test('an unsynced Python draft survives immediate close and remains isolated by player', async () => {
  const { BackendGame } = await vite.ssrLoadModule('/src/campusos/games/BackendGame.tsx')
  const serverCode = 'def calculate_average(grades):\n    return 0'
  const draftCode = 'def calculate_average(grades):\n    values = [g for g in grades if g is not None]'
  const calls = []
  const props = { quest: gameQuest('code', { code: serverCode }), busy: false, userId: 101, send: async (...args) => calls.push(args) }
  const initial = render(React.createElement(BackendGame, props))
  fireEvent.change(screen.getByRole('textbox', { name: 'Код Python' }), { target: { value: draftCode } })
  initial.unmount()
  assert.deepEqual(calls, [])
  const restored = render(React.createElement(BackendGame, props))
  assert.equal(screen.getByRole('textbox', { name: 'Код Python' }).value, draftCode)
  restored.unmount()
  const other = render(React.createElement(BackendGame, { ...props, userId: 202 }))
  assert.equal(screen.getByRole('textbox', { name: 'Код Python' }).value, serverCode)
  other.unmount()
  render(React.createElement(BackendGame, props))
  assert.equal(screen.getByRole('textbox', { name: 'Код Python' }).value, draftCode)
})

test('an unfinished OrderService repair survives closing before the server debounce', async () => {
  const { BackendGame } = await vite.ssrLoadModule('/src/campusos/games/BackendGame.tsx')
  const repair = 'def order_status():\n    message = "Order created"\n    return message'
  const calls = []
  const props = { quest: gameQuest('diagnosis', { seen: ['cause'] }), busy: false, userId: 101, send: async (...args) => calls.push(args) }
  const initial = render(React.createElement(BackendGame, props))
  fireEvent.click(screen.getByRole('button', { name: 'Исправление' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Исправление OrderService' }), { target: { value: repair } })
  initial.unmount()
  assert.deepEqual(calls, [])
  render(React.createElement(BackendGame, props))
  fireEvent.click(screen.getByRole('button', { name: 'Исправление' }))
  assert.equal(screen.getByRole('textbox', { name: 'Исправление OrderService' }).value, repair)
})

test('an unsynced layout edit survives immediate close without appearing for another player', async () => {
  const { FrontendGame } = await vite.ssrLoadModule('/src/campusos/games/FrontendGame.tsx')
  const calls = []
  const props = { quest: gameQuest('responsive', { properties: { width: '100' } }), busy: false, userId: 101, send: async (...args) => calls.push(args) }
  const initial = render(React.createElement(FrontendGame, props))
  fireEvent.change(screen.getByLabelText('Ширина карточки, %'), { target: { value: '88' } })
  initial.unmount()
  assert.deepEqual(calls, [])
  const restored = render(React.createElement(FrontendGame, props))
  assert.equal(screen.getByLabelText('Ширина карточки, %').value, '88')
  assert.equal(document.querySelector('.workbench-card').style.width, '88%')
  restored.unmount()
  render(React.createElement(FrontendGame, { ...props, userId: 202 }))
  assert.equal(screen.getByLabelText('Ширина карточки, %').value, '100')
  assert.equal(document.querySelector('.workbench-card').style.width, '100%')
})

test('registration fixes change the preview, preserve mistakes and save selected values', async () => {
  const { FrontendGame } = await vite.ssrLoadModule('/src/campusos/games/FrontendGame.tsx')
  const calls = []
  render(React.createElement(FrontendGame, { quest: gameQuest('ux'), busy: false, send: async (...args) => calls.push(args) }))
  fireEvent.click(screen.getByRole('button', { name: 'Выполнить', exact: true }))
  await waitFor(() => assert.equal(document.querySelector('.mock-cta').textContent, 'Выполнить'))
  fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться', exact: true }))
  await waitFor(() => assert.ok(document.querySelector('.mock-cta').textContent === 'Зарегистрироваться'))
  fireEvent.click(screen.getByRole('button', { name: 'ERROR 0xF14', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Проверьте адрес: нужен символ @', exact: true }))
  await waitFor(() => assert.ok(document.querySelector('.form-hotspot.error').textContent.includes('@')))
  assert.deepEqual(calls.map(call => call[1]), [{ key: 'button', value: 'Выполнить' }, { key: 'button', value: 'Зарегистрироваться' }, { key: 'error', value: 'Проверьте адрес: нужен символ @' }])
})

test('diagnostic tabs replace panels while logs keep arriving on hover and selection stays pinned', async () => {
  const { BackendGame } = await vite.ssrLoadModule('/src/campusos/games/BackendGame.tsx')
  const calls = []
  const originalInterval = window.setInterval
  const originalClear = window.clearInterval
  let tick
  window.setInterval = callback => { tick = callback; return 12345 }
  window.clearInterval = () => {}
  try {
    render(React.createElement(BackendGame, { quest: gameQuest('diagnosis', { seen: ['logs'] }), busy: false, send: async (...args) => calls.push(args) }))
    fireEvent.click(screen.getByRole('button', { name: 'Деплой' }))
    assert.ok(screen.getByText('orders-1.8'))
    assert.equal(screen.queryByLabelText('История логов'), null)
    fireEvent.click(screen.getByRole('button', { name: 'Логи' }))
    assert.equal(screen.queryByText('orders-1.8'), null)
    const history = screen.getByLabelText('История логов')
    act(() => { for (let i = 0; i < 3; i++) tick() })
    const syntax = [...history.querySelectorAll('button')].find(button => button.textContent.includes('SyntaxError'))
    fireEvent.click(syntax)
    assert.equal(calls.at(-1)[0], 'log')
    const detail = document.querySelector('.investigation-log-detail')
    const selectedText = detail.textContent
    const count = history.querySelectorAll('button').length
    fireEvent.pointerEnter(history)
    fireEvent.focus(history)
    act(() => tick())
    assert.equal(history.querySelectorAll('button').length, count + 1)
    assert.equal(detail.textContent, selectedText)
    assert.ok(screen.getByRole('button', { name: 'Пауза потока' }))
    fireEvent.click(screen.getByRole('button', { name: 'Сервисы' }))
    fireEvent.click(screen.getByRole('button', { name: 'Логи' }))
    assert.equal(document.querySelector('.investigation-log-detail').textContent, selectedText)
  } finally {
    cleanup()
    window.setInterval = originalInterval
    window.clearInterval = originalClear
  }
})

test('code editor submits the actual typed Python and never auto-runs an AI example', async () => {
  const { BackendGame } = await vite.ssrLoadModule('/src/campusos/games/BackendGame.tsx')
  const calls = []
  const props = { quest: gameQuest('code', { hints: 3, example_shown: true }), busy: false, send: async (...args) => { calls.push(args) } }
  render(React.createElement(BackendGame, props))
  const code = 'def calculate_average(grades):\n    return 2'
  fireEvent.change(screen.getByRole('textbox', { name: 'Код Python' }), { target: { value: code } })
  fireEvent.click(screen.getByRole('button', { name: 'Запустить тесты' }))
  assert.deepEqual(calls[0], ['run', { value: code }])
  fireEvent.click(screen.getByRole('button', { name: 'AI-помощник' }))
  fireEvent.click(screen.getByRole('button', { name: /Взять пример/ }))
  await waitFor(() => assert.match(screen.getByRole('textbox', { name: 'Код Python' }).value, /sum\(values\)/))
  assert.deepEqual(calls.map(c => c[0]), ['run', 'use-example'])
})

test('customer chat keeps message history and offers distracting questions without a forced route', async () => {
  const { AnalyticsGame } = await vite.ssrLoadModule('/src/campusos/games/AnalyticsGame.tsx')
  const calls = []
  render(React.createElement(AnalyticsGame, { quest: gameQuest('interview'), busy: false, send: async (...args) => calls.push(args) }))
  assert.ok(screen.getByRole('button', { name: 'Когда отчёт должен быть готов?' }))
  fireEvent.click(screen.getByRole('button', { name: 'Какого цвета должна быть кнопка?' }))
  await screen.findByText(/Синяя/)
  fireEvent.click(screen.getByRole('button', { name: 'Кто пользуется экспортом?' }))
  await screen.findByText(/Я, руководитель отдела/)
  assert.ok(screen.getByText(/Синяя/))
  assert.equal(screen.queryByRole('dialog'), null)
  assert.equal(screen.getByRole('log').querySelectorAll('.chat-outgoing').length, 2)
  fireEvent.click(screen.getByRole('button', { name: 'Собрать решение' }))
  for (const [label, value] of [['Что мешает клиенту?', 'manual'], ['Что изменим?', 'weekly-report'], ['Что попадёт в файл?', 'paid-csv'], ['Как доставим результат?', 'friday-director']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Обсудить решение' }))
  assert.equal(calls.at(-1)[0], 'compose')
  assert.deepEqual(JSON.parse(calls.at(-1)[1].value), { problem: 'manual', automation: 'weekly-report', data: 'paid-csv', delivery: 'friday-director' })
})

test('phone summarizes quest interest and assistance in human terms', async () => {
  const { CampusPhone } = await vite.ssrLoadModule('/src/campusos/CampusPhone.tsx')
  const quest = { ...gameQuest('code', { stage: 'complete', reaction: 'more', hints: 2, attempts: 4, success: true }), status: 'completed' }
  render(React.createElement(CampusPhone, { api: {}, user, quests: [quest], loading: false, loadError: '', reload: async () => {}, close: () => {}, logout: () => {}, profile: null, results: null }))
  fireEvent.click(screen.getByRole('button', { name: 'Профиль' }))
  fireEvent.click(screen.getByText(/Задания и статистика/))
  assert.ok(screen.getByText('Хочется продолжить'))
  assert.ok(screen.getByText('Есть желание исследовать направление дальше.'))
  assert.match(document.body.textContent, /попыток: 4/)
  assert.match(document.body.textContent, /Помощь: 2 ур./)
})

test('workstations are reachable without overlapping their NPC interaction radius', async () => {
  const { worldLocations } = await vite.ssrLoadModule('/src/world.ts')
  for (const slug of ['backend', 'frontend', 'analytics']) {
    const { workstation, npc } = worldLocations[slug]
    assert.ok(workstation)
    assert.ok(Math.hypot(workstation.x - npc.x, workstation.y - npc.y) > 95)
  }
})

test('registration shows all five visual fixes and the user feedback beside the form', async () => {
  const { FrontendGame } = await vite.ssrLoadModule('/src/campusos/games/FrontendGame.tsx')
  const calls = []
  render(React.createElement(FrontendGame, { quest: gameQuest('ux', { properties: { button: 'Зарегистрироваться', error: 'Проверьте адрес: нужен @', hint: 'Не менее 8 символов', reveal: 'show', order: 'email-first' }, user_trace: [{ step: 'order', passed: true, message: 'Нашёл почту.' }, { step: 'button', passed: false, message: 'Не понимаю действие.' }] }), busy: false, send: async (...args) => calls.push(args) }))
  assert.ok(screen.getByText(/Не понимаю действие/))
  fireEvent.click(screen.getByRole('button', { name: 'Показать этот элемент' }))
  assert.ok(screen.getByRole('heading', { name: 'Что написано на кнопке?' }))
  fireEvent.click(screen.getByRole('button', { name: 'Показать пароль', exact: true }))
  assert.equal(screen.getByDisplayValue('campus!234').type, 'text')
  fireEvent.click(screen.getByRole('button', { name: 'Попросить пользователя попробовать' }))
  assert.deepEqual(calls.at(-1), ['simulate'])
})

test('AI chat only accepts prepared questions and keeps each answer on topic', async () => {
  const { BackendGame } = await vite.ssrLoadModule('/src/campusos/games/BackendGame.tsx')
  const calls = []
  render(React.createElement(BackendGame, { quest: gameQuest('code'), busy: false, send: async (...args) => calls.push(args) }))
  fireEvent.click(screen.getByRole('button', { name: 'AI-помощник' }))
  assert.equal(screen.queryByRole('textbox'), null)
  fireEvent.click(screen.getByRole('button', { name: 'А можно было написать на JavaScript?' }))
  await waitFor(() => assert.match(screen.getByRole('log').textContent, /легко перенести в другой язык\./), { timeout: 3000 })
  fireEvent.click(screen.getByRole('button', { name: 'Что делать с None?' }))
  await waitFor(() => assert.match(screen.getByRole('log').textContent, /Пропускай только его/))
  await waitFor(() => assert.equal(screen.getByRole('log').getAttribute('aria-busy'), 'false'), { timeout: 3000 })
  assert.deepEqual(calls, [['assistant-question', { key: 'javascript' }], ['assistant-question', { key: 'none' }]])
  fireEvent.click(screen.getByRole('button', { name: 'Документация', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'AI-помощник', exact: true }))
  assert.match(screen.getByRole('log').textContent, /Пропускай только его/)
})

test('phone home is minimal, logout lives in settings and themes persist across remount', async () => {
  const { CampusPhone } = await vite.ssrLoadModule('/src/campusos/CampusPhone.tsx')
  const props = { api: {}, user, quests: [], loading: false, loadError: '', reload: async () => {}, close: () => {}, logout: () => {}, profile: null }
  let view = render(React.createElement(CampusPhone, props))
  assert.equal(screen.queryByRole('button', { name: 'Отчёт' }), null)
  assert.equal(screen.queryByRole('button', { name: /Выход|Выйти из аккаунта|Свернуть телефон|Закрыть телефон/ }), null)
  assert.doesNotMatch(document.body.textContent, /Привет, исследователь|ТВОЙ КАМПУС|КАМПУС НА СВЯЗИ/)
  fireEvent.click(screen.getByRole('button', { name: 'Темы' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cyber', exact: true }))
  assert.equal(localStorage.getItem('tvoyvybor.phoneTheme'), 'cyber')
  assert.equal(document.querySelector('.campus-phone').dataset.theme, 'cyber')
  fireEvent.click(screen.getByRole('button', { name: 'На главный экран телефона' }))
  fireEvent.click(screen.getByRole('button', { name: 'Настройки' }))
  assert.ok(screen.getByRole('button', { name: 'Выйти из аккаунта' }))
  assert.equal(document.querySelector('.campus-phone').dataset.theme, 'cyber')
  view.unmount()
  view = render(React.createElement(CampusPhone, props))
  assert.equal(document.querySelector('.campus-phone').dataset.theme, 'cyber')
})

test('phone map reuses the four campus tiles and plots player position or building', async () => {
  const { PhoneMap } = await vite.ssrLoadModule('/src/campusos/PhoneMap.tsx')
  const view = render(React.createElement(PhoneMap, { position: { x: 250, y: 350 } }))
  const map = screen.getByRole('img', { name: /Мини-карта кампуса/ })
  const images = [...map.querySelectorAll('img')]
  assert.equal(images.length, 4)
  assert.ok(images.every(img => img.src.includes('/content/backgrounds/campus_main_')))
  assert.equal(map.querySelector('svg g:last-child').getAttribute('transform'), 'translate(250 350)')
  assert.ok(screen.getByText('Вы на территории кампуса'))
  view.rerender(React.createElement(PhoneMap, { position: { x: 125, y: 245 }, currentBuilding: 'backend' }))
  assert.ok(screen.getByText('Вы в корпусе: Backend'))
})

test('phone help includes mouse movement, FAQ and project sections', async () => {
  const { PhoneHelp } = await vite.ssrLoadModule('/src/campusos/PhoneHelp.tsx')
  render(React.createElement(PhoneHelp))
  assert.ok(screen.getByText('Клик мышью'))
  assert.ok(screen.getByText('Идти к доступной точке'))
  fireEvent.click(screen.getByRole('button', { name: 'FAQ', exact: true }))
  fireEvent.click(screen.getByText('Можно ли ошибаться в заданиях?'))
  assert.ok(screen.getByText(/Исправляйте решение и проверяйте снова/))
  fireEvent.click(screen.getByRole('button', { name: 'О проекте', exact: true }))
  assert.ok(screen.getByText('ТвойВыбор.exe'))
})

function phonePointer(target, type, x, y) {
  fireEvent(target, Object.assign(new window.Event(type, { bubbles: true }), { button: 0, isPrimary: true, pointerId: 1, clientX: x, clientY: y }))
}

test('phone gestures go back from nested screens and swipe home without dismissing', async () => {
  const { CampusPhone } = await vite.ssrLoadModule('/src/campusos/CampusPhone.tsx')
  let closed = 0
  render(React.createElement(CampusPhone, { api: {}, user, quests: [], loading: false, loadError: '', reload: async () => {}, close: () => { closed++ }, logout: () => {}, profile: null }))
  fireEvent.click(screen.getByRole('button', { name: 'Контакты' }))
  fireEvent.click(screen.getByRole('button', { name: /Борис Бэкендович/ }))
  const phone = document.querySelector('.campus-phone')
  phonePointer(phone, 'pointerdown', 2, 250)
  phonePointer(phone, 'pointerup', 90, 255)
  assert.equal(screen.queryByRole('heading', { name: 'Борис Бэкендович' }), null)
  assert.ok(screen.getByRole('button', { name: /Борис Бэкендович/ }))
  phonePointer(phone, 'pointerdown', 2, 250)
  phonePointer(phone, 'pointerup', 25, 251)
  assert.ok(screen.getByRole('heading', { name: 'Контакты' }))
  const bar = screen.getByRole('button', { name: 'На главный экран телефона' })
  phonePointer(bar, 'pointerdown', 100, 550)
  phonePointer(bar, 'pointerup', 105, 470)
  assert.ok(screen.getByRole('button', { name: 'Карта', exact: true }))
  assert.equal(closed, 0)
  phonePointer(phone, 'pointerdown', 80, 250)
  fireEvent.click(screen.getByRole('button', { name: 'Карта', exact: true }))
  assert.ok(screen.getByRole('heading', { name: 'Карта' }))
  fireEvent.keyDown(window, { key: 'Escape', repeat: true })
  assert.equal(closed, 0)
  fireEvent.keyDown(window, { key: 'Escape' })
  assert.equal(closed, 1)
})

test('phone profile combines statistics, activities and recommendations without fit scores', async () => {
  const { QuestProfile } = await vite.ssrLoadModule('/src/campusos/QuestProfile.tsx')
  const q = { ...gameQuest('diagnosis', { stage: 'complete', reaction: 'interesting', attempts: 3, active_seconds: 180, success: true }), status: 'completed' }
  render(React.createElement(QuestProfile, { quests: [q] }))
  assert.ok(screen.getByRole('progressbar', { name: 'Общий прогресс' }))
  assert.ok(screen.getByText('1 из 1 ситуаций завершено'))
  assert.ok(screen.getByText(/Искать причины проблем/))
  assert.ok(screen.getByText(/СТОИТ ПОДРОБНЕЕ ПОПРОБОВАТЬ/))
  assert.ok(screen.getByText(/ЧЕМУ УДЕЛИТЬ ВРЕМЯ/))
  assert.doesNotMatch(document.body.textContent, /% подходит/)
})

test('phone clock follows browser local time and stops its timer on unmount', async t => {
  const { CampusPhone } = await vite.ssrLoadModule('/src/campusos/CampusPhone.tsx')
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 7, 10, 21, 0) })
  let updateClock
  t.mock.method(window, 'setInterval', callback => { updateClock = callback; return 90001 })
  const cleared = []
  t.mock.method(window, 'clearInterval', id => { cleared.push(id) })
  const view = render(React.createElement(CampusPhone, { api: {}, user, quests: [], loading: false, loadError: '', reload: async () => {}, close: () => {}, logout: () => {}, profile: null }))
  const clock = screen.getByLabelText('Локальное время')
  const format = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const initial = clock.textContent
  assert.equal(initial, format())
  t.mock.timers.tick(61000)
  await act(async () => updateClock())
  assert.equal(clock.textContent, format())
  assert.notEqual(clock.textContent, initial)
  view.unmount()
  assert.ok(cleared.includes(90001))
})

test('all six NPC offers can be postponed and resumed with a short reminder', async () => {
  const { QuestConversation } = await vite.ssrLoadModule('/src/campusos/QuestInteraction.tsx')
  const { introductions, reminders } = await vite.ssrLoadModule('/src/campusos/questContent.ts')
  const { locationFor } = await vite.ssrLoadModule('/src/world.ts')
  for (const kind of Object.keys(introductions)) {
    let quest = gameQuest(kind, { stage: 'intro', intro_line: 4 })
    const calls = []
    const props = { api: { questAction: async (id, requestId, action) => {
      calls.push(action)
      quest = { ...quest, gameplay: { ...quest.gameplay, state: { ...quest.gameplay.state, intro_deferred: action === 'intro-defer', intro_line: action === 'intro-resume' ? 5 : 4 } } }
      return { state: quest.gameplay.state, awards: [] }
    } }, location: locationFor('backend'), close: () => {}, userId: 401, onAwards: () => {} }
    let view
    const reload = async () => view.rerender(React.createElement(QuestConversation, { ...props, quests: [quest], reload }))
    view = render(React.createElement(QuestConversation, { ...props, quests: [quest], reload }))
    assert.equal(screen.getByText(introductions[kind][4].text).tagName, 'P')
    fireEvent.click(screen.getByText('Не, давай потом.'))
    await screen.findByText('Эх… ладно. Если передумаешь — я здесь.')
    assert.deepEqual(calls, ['intro-defer'])
    assert.match(screen.getByRole('img').src, /sad\.png$/)
    view.unmount()
    view = render(React.createElement(QuestConversation, { ...props, quests: [quest], reload }))
    assert.ok(screen.getByText(reminders[kind]))
    fireEvent.click(screen.getByText(introductions[kind][5].text))
    await screen.findByText(introductions[kind][5].text)
    await waitFor(() => assert.equal(calls.at(-1), 'intro-resume'))
    view.unmount()
  }
})

test('NPC responds after every interest answer including a completed quest disappearing from the active list', async () => {
  const { QuestConversation } = await vite.ssrLoadModule('/src/campusos/QuestInteraction.tsx')
  const { locationFor } = await vite.ssrLoadModule('/src/world.ts')
  for (const [choice, response] of [['Я бы ещё покопался в этом.', /прекрасных пятниц/], ['Неплохо, было интересно.', /прекрасных пятниц/], ['Идею понял, но это не моё.', /третьего ночного падения/], ['Нормально, но пока не уверен.', /Теперь знаешь/]]) {
    let quest = gameQuest('diagnosis', { stage: 'result' })
    let closed = 0
    const props = { location: locationFor('backend'), close: () => { closed++ }, userId: 402, onAwards: () => {}, api: { questAction: async () => { quest = { ...quest, status: 'completed' }; return { state: quest.gameplay.state, awards: [] } } } }
    let view
    const reload = async () => view.rerender(React.createElement(QuestConversation, { ...props, quests: [quest], reload }))
    view = render(React.createElement(QuestConversation, { ...props, quests: [quest], reload }))
    fireEvent.click(screen.getByText(choice))
    fireEvent.keyDown(window, { key: 'Enter' })
    await screen.findByText(response)
    assert.equal(closed, 0)
    fireEvent.keyDown(window, { key: 'Enter' })
    assert.equal(closed, 1)
    view.unmount()
  }
})

test('code debrief offers four honest answers and remembers the selected branch', async () => {
  const { QuestConversation } = await vite.ssrLoadModule('/src/campusos/QuestInteraction.tsx')
  const { codeAnswers } = await vite.ssrLoadModule('/src/campusos/questContent.ts')
  const { locationFor } = await vite.ssrLoadModule('/src/world.ts')
  for (const [value, text, reply] of codeAnswers) {
    let quest = gameQuest('code', { stage: 'return', debrief_line: 0 })
    const props = { location: locationFor('backend'), close: () => {}, userId: 403, onAwards: () => {}, api: { questAction: async (id, rid, action, payload) => {
      quest = { ...quest, gameplay: { ...quest.gameplay, state: { ...quest.gameplay.state, code_answer: value, debrief_line: action === 'debrief-answer' ? 1 : Number(payload.value) } } }
      return { state: quest.gameplay.state, awards: [] }
    } } }
    let view
    const reload = async () => view.rerender(React.createElement(QuestConversation, { ...props, quests: [quest], reload }))
    view = render(React.createElement(QuestConversation, { ...props, quests: [quest], reload }))
    fireEvent.click(screen.getByText(text))
    await waitFor(() => assert.equal(document.querySelector('.player-line p').textContent, text))
    await act(async () => {})
    fireEvent.keyDown(window, { key: 'Enter' })
    await screen.findByText(content => content.startsWith(reply))
    view.unmount()
  }
})


test('every quest greets the player with a visible response and uses a distinct final reaction', async () => {
  const { QuestConversation } = await vite.ssrLoadModule('/src/campusos/QuestInteraction.tsx')
  const { introductions, finalReactions } = await vite.ssrLoadModule('/src/campusos/questContent.ts')
  const { locationFor } = await vite.ssrLoadModule('/src/world.ts')
  const seen = new Set()
  for (const kind of Object.keys(introductions)) {
    const location = locationFor(['diagnosis', 'code'].includes(kind) ? 'backend' : ['responsive', 'ux'].includes(kind) ? 'frontend' : 'analytics')
    const view = render(React.createElement(QuestConversation, { api: {}, quests: [gameQuest(kind, { stage: 'intro', intro_line: 0 })], location, close: () => {}, reload: async () => {}, userId: 501, onAwards: () => {} }))
    fireEvent.click(screen.getByText('Привет! Нормально.'))
    assert.ok(document.querySelector('.player-line'))
    fireEvent.keyDown(window, { key: 'Enter' })
    assert.ok(screen.getByText(introductions[kind][0].text))
    for (const reaction of Object.values(finalReactions[kind])) { assert.ok(!seen.has(reaction)); seen.add(reaction) }
    if (location.slug !== 'backend') { assert.doesNotMatch(finalReactions[kind].positive, /Рад /); }
    view.unmount()
  }
  assert.equal(seen.size, 18)
})

test('wrong interview proposal is spoken by the customer and dismissing returns to the chat', async () => {
  const { AnalyticsGame } = await vite.ssrLoadModule('/src/campusos/games/AnalyticsGame.tsx')
  const feedback = 'Мне всё ещё придётся собирать отчёт руками или ждать его. Давайте сверим решение с перепиской.'
  let view
  const props = { quest: gameQuest('interview'), busy: false, send: async () => view.rerender(React.createElement(AnalyticsGame, { ...props, quest: gameQuest('interview', { attempts: 1, feedback, proposal_draft: { problem: 'manual' } }) })) }
  view = render(React.createElement(AnalyticsGame, props))
  fireEvent.click(screen.getByText('Собрать решение'))
  for (const [label, value] of [['Что мешает клиенту?', 'manual'], ['Что изменим?', 'export'], ['Что попадёт в файл?', 'paid-csv'], ['Как доставим результат?', 'friday-director']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.click(screen.getByText('Обсудить решение'))
  const dialog = await screen.findByRole('dialog', { name: 'Разговор: Михаил · заказчик' })
  assert.ok(dialog.textContent.includes(feedback))
  fireEvent.click(screen.getByText('Хорошо, пересмотрю решение.'))
  assert.equal(screen.queryByRole('dialog'), null)
  assert.ok(screen.getByRole('log', { name: 'История переписки' }))
})

test('task status always has a separate frame slot and assistant has no duplicate hints', async () => {
  const { QuestInteraction } = await vite.ssrLoadModule('/src/campusos/QuestInteraction.tsx')
  render(React.createElement(QuestInteraction, { api: {}, quest: gameQuest('code'), userId: 502, close: () => {}, reload: async () => {}, onAwards: () => {}, target: 'terminal' }))
  const status = screen.getByRole('status', { name: 'Состояние задания' })
  assert.equal(status.parentElement.classList.contains('task-window'), true)
  assert.equal(document.querySelector('.task-body').contains(status), false)
  assert.equal(screen.queryByRole('button', { name: /Подсказки/ }), null)
  fireEvent.click(screen.getByText('AI-помощник'))
  assert.equal(screen.queryByRole('textbox'), null)
  assert.equal(status.getAttribute('data-tone'), 'info')
})

test('task feedback distinguishes warnings, failures and successful completion', async () => {
  const { TaskStatus } = await vite.ssrLoadModule('/src/campusos/TaskStatus.tsx')
  const view = render(React.createElement(TaskStatus, { state: { ...gameState, feedback: 'Есть несовпадения. Проверьте функцию.' }, busy: false, error: '' }))
  assert.equal(screen.getByRole('status').getAttribute('data-tone'), 'warning')
  view.rerender(React.createElement(TaskStatus, { state: gameState, busy: false, error: 'Нет соединения. Повторите действие.' }))
  assert.ok(screen.getByRole('alert').textContent.includes('Нет соединения'))
  view.rerender(React.createElement(TaskStatus, { state: { ...gameState, success: true }, busy: false, error: '' }))
  assert.equal(screen.getByRole('status').getAttribute('data-tone'), 'success')
})

test('dialogue keeps keyboard focus on its own responses rather than the paused workspace', () => {
  const location = { slug: 'analytics', name: 'Клиент', portrait: '', choices: [] }
  render(React.createElement(Dialogue, { location, onClose: () => {}, scene: { text: 'Пересмотрим решение?', choices: [{ text: 'Да, пересмотрю', select: () => {} }, { text: 'Вернуться в чат', select: () => {} }] } }))
  const buttons = screen.getAllByRole('button')
  fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
  assert.equal(document.activeElement, buttons[1])
  fireEvent.keyDown(window, { key: 'Tab' })
  assert.equal(document.activeElement, buttons[0])
  fireEvent.keyDown(window, { key: 'Tab' })
  assert.equal(document.activeElement, buttons[1])
})
