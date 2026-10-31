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
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.MutationObserver = dom.window.MutationObserver
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { render, screen, fireEvent, waitFor, cleanup } = await import('@testing-library/react')
const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const { default: App, Dialogue } = await vite.ssrLoadModule('/src/App.tsx')

const user = { id: 1, email: 'player@example.com', role: 'user', onboarding_completed: true }
const direction = { id: 3, slug: 'backend', title: 'Backend', description: 'Серверная разработка' }
const scenario = { id: 7, direction_id: 3, slug: 'first', title: 'Первый сценарий', description: 'Проверка сервера', state: 'active' }

function mockApi({ login = false, me = user, meStatus = 200, directions = [direction], scenarios = [scenario], progress = [{ scenario_id: 7, state: 'completed' }] } = {}) {
  const requests = []
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input), 'http://localhost:5173').pathname
    const authorization = new Headers(init?.headers).get('Authorization')
    requests.push({ path, authorization })
    if (path === '/api/auth/login' && login) return Response.json({ access_token: 'test-token', token_type: 'bearer' })
    if (path === '/api/auth/me') return meStatus === 401 ? Response.json({ detail: 'Invalid authentication credentials' }, { status: 401 }) : Response.json(me)
    if (path === '/api/quests') return Response.json([])
    if (path === '/api/directions') return Response.json(directions)
    if (path === '/api/scenarios') return Response.json(scenarios)
    if (path === '/api/progress') return Response.json(progress)
    throw new Error(`Unexpected API request: ${path}`)
  }
  return requests
}

afterEach(() => {
  cleanup()
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
  mockApi({ me: { ...user, onboarding_completed: false }, directions: [] })
  const fetchApi = globalThis.fetch
  globalThis.fetch = async (input, init) => new URL(String(input), 'http://localhost:5173').pathname === '/api/auth/me/onboarding-complete'
    ? Response.json(user) : fetchApi(input, init)
  render(React.createElement(App))

  assert.ok(await screen.findByLabelText('Игровая сцена'))
  assert.ok(screen.getByRole('dialog', { name: 'Пролог Дяди Дебага' }))
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }))
  await waitFor(() => assert.ok(!screen.queryByRole('dialog', { name: 'Пролог Дяди Дебага' })))
  assert.ok(screen.getByLabelText('Игровая сцена'))
  assert.equal(screen.queryByLabelText('Игровой кампус'), null)
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

test('dialogue uses one speech panel and keeps all actions in the separate choices panel', async () => {
  const { worldLocations } = await vite.ssrLoadModule('/src/world.ts')
  let closed = 0
  const location = worldLocations.frontend
  const { container } = render(React.createElement(Dialogue, { location, onClose: () => { closed++ } }))
  const dialog = screen.getByRole('dialog', { name: 'Разговор: Фронтина Пиксельевна' })
  const panel = container.querySelector('.dialogue-overlay')
  const actions = container.querySelector('.dialogue-choices')
  assert.ok(dialog.contains(panel) && dialog.contains(actions))
  assert.equal(container.querySelectorAll('.dialogue-overlay').length, 1)
  assert.equal(panel.querySelector('button'), null)
  assert.ok(actions.contains(screen.getByRole('button', { name: 'Завершить разговор' })))
  fireEvent.click(screen.getByRole('button', { name: location.choices[0].text }))
  assert.equal(container.querySelector('.dialogue-overlay'), panel)
  assert.ok(panel.classList.contains('player-line'))
  assert.ok(panel.textContent.includes('Стажёр Ноль'))
  assert.equal(panel.lastElementChild.tagName, 'IMG')
  assert.equal(panel.querySelector('button'), null)
  assert.ok(actions.contains(screen.getByRole('button', { name: 'Завершить разговор' })))
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }))
  assert.ok(panel.textContent.includes(location.choices[0].reaction))
  assert.equal(panel.firstElementChild.tagName, 'IMG')
  assert.equal(panel.querySelector('button'), null)
  assert.ok(actions.contains(screen.getByRole('button', { name: 'Выбрать другую тему' })))
  fireEvent.click(screen.getByRole('button', { name: 'Выбрать другую тему' }))
  assert.ok(panel.textContent.includes(location.greeting))
  fireEvent.click(screen.getByRole('button', { name: 'Завершить разговор' }))
  assert.equal(closed, 1)
})

test('dialogue number keys advance and Escape closes without repeating', async () => {
  const { worldLocations } = await vite.ssrLoadModule('/src/world.ts')
  let closed = 0
  render(React.createElement(Dialogue, { location: worldLocations.backend, onClose: () => { closed++ } }))
  fireEvent.keyDown(window, { key: '1' })
  fireEvent.keyDown(window, { key: '1', repeat: true })
  assert.ok(await screen.findByText('Стажёр Ноль'))
  fireEvent.keyDown(window, { key: '1' })
  assert.ok(await screen.findByText(worldLocations.backend.choices[0].reaction))
  fireEvent.keyDown(window, { key: 'Escape' })
  await waitFor(() => assert.equal(closed, 1))
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
  const api = { interact: async (id) => { ids.push(id); if (ids.length === 1) throw new Error('offline'); return { accepted: true, changes: [] } } }
  const quest = { id: 1, slug: 'server-on-vacation', title: 'Сервер', description: '', category: 'professional', location_slug: 'backend', giver_npc_id: 'boris', status: 'active', accepted_at: null, completed_at: null, tracked: false, objectives: [] }
  render(React.createElement(QuestInteraction, { api, quest, target: 'server', reload: async () => {}, close: () => {}, dialogue: () => {} }))
  fireEvent.click(screen.getByRole('button', { name: 'Осмотреть' }))
  assert.ok(await screen.findByRole('alert'))
  fireEvent.click(screen.getByRole('button', { name: 'Осмотреть' }))
  await screen.findByText(/Состояние сервера осмотрено/)
  assert.equal(ids.length, 2)
  assert.equal(ids[0], ids[1])
  sessionStorage.clear()
})
