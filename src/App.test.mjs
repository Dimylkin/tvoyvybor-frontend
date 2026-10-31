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
const { default: App, GameScreen, Dialogue } = await vite.ssrLoadModule('/src/App.tsx')
const { TaskModal } = await vite.ssrLoadModule('/src/TaskModal.tsx')
const { ApiClient } = await vite.ssrLoadModule('/src/api.ts')

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
  assert.ok(screen.getByRole('link', { name: 'Помощь' }))
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
  assert.ok(screen.getByText('Новый сценарий'))
})

test('choice modal keeps an incorrect answer retryable and shows server feedback', async () => {
  let sent = null
  const api = new ApiClient('/api', () => 'token', () => {}, async (_input, init) => {
    sent = JSON.parse(init.body)
    return Response.json({ id: 1, task_id: 9, is_correct: false, reaction: 'retry', explanation: 'Для чтения ресурса используют GET.', scenario_state: 'active' }, { status: 201 })
  })
  const results = []
  render(React.createElement(TaskModal, {
    api,
    task: { id: 9, kind: 'choice', title: 'Метод', content: { prompt: 'Как читать?', options: ['GET', 'POST'] } },
    onResult: (result) => results.push(result),
    onClose: () => {},
  }))

  fireEvent.click(screen.getByLabelText('POST'))
  fireEvent.click(screen.getByRole('button', { name: 'Проверить решение' }))
  assert.ok(await screen.findByText('Мир реагирует: можно попробовать ещё раз.', { exact: false }))
  assert.equal(sent.answer, 'POST')
  assert.match(sent.request_id, /^attempt-|^[0-9a-f-]{36}$/)
  assert.equal(results[0].reaction, 'retry')
  assert.ok(screen.getByRole('button', { name: 'Проверить решение' }))
})

test('choice modal displays validated plot context from server content', () => {
  const api = new ApiClient('/api', () => 'token', () => {}, async () => Response.json({}))
  render(React.createElement(TaskModal, {
    api,
    task: {
      id: 11,
      kind: 'choice',
      title: 'Кнопка исчезла',
      content: {
        context: 'Генеральный директор открыл сайт на планшете, и кнопка решила уйти в отпуск.',
        prompt: 'Что проверить первым?',
        options: ['Адаптивную вёрстку', 'Цвет кружки'],
      },
    },
    onResult: () => {},
    onClose: () => {},
  }))

  assert.ok(screen.getByText('Генеральный директор открыл сайт на планшете, и кнопка решила уйти в отпуск.'))
  assert.ok(screen.getByText('Что проверить первым?'))
})

test('game screen opens a task from the scene and shows completed server feedback', async () => {
  const calls = []
  const api = new ApiClient('/api', () => 'token', () => {}, async (input, init) => {
    const path = new URL(String(input), 'http://localhost:5173').pathname
    calls.push({ path, method: init?.method })
    if (path === '/api/scenarios/7') return Response.json({ ...scenario, state: 'available', completed_task_ids: [], tasks: [{ id: 9, kind: 'choice', title: 'Метод', content: { prompt: 'Как читать?', options: ['GET', 'POST'] } }] })
    if (path === '/api/directions') return Response.json([direction])
    if (path === '/api/scenarios/7/start') return Response.json({ scenario_id: 7, state: 'active' })
    if (path === '/api/tasks/9/attempts') return Response.json({ id: 1, task_id: 9, is_correct: true, reaction: 'completed', explanation: 'GET читает ресурс.', scenario_state: 'completed' }, { status: 201 })
    throw new Error(`Unexpected API request: ${path}`)
  })
  function Scene({ onInteract }) { return React.createElement('button', { type: 'button', onClick: onInteract }, 'Поговорить с NPC') }
  render(React.createElement(GameScreen, { api, scenarioId: 7, Game: Scene }))

  fireEvent.click(await screen.findByRole('button', { name: 'Поговорить с NPC' }))
  fireEvent.click(screen.getByLabelText('GET'))
  fireEvent.click(screen.getByRole('button', { name: 'Проверить решение' }))
  assert.ok(await screen.findByText('NPC доволен решением'))
  assert.deepEqual(calls.map((item) => `${item.method ?? 'GET'} ${item.path}`), [
    'GET /api/scenarios/7', 'GET /api/directions', 'PUT /api/scenarios/7/start', 'POST /api/tasks/9/attempts',
  ])
})

test('completed game route restores server state without starting the scenario again', async () => {
  const calls = []
  const api = new ApiClient('/api', () => 'token', () => {}, async (input, init) => {
    const path = new URL(String(input), 'http://localhost:5173').pathname
    calls.push({ path, method: init?.method })
    if (path === '/api/scenarios/7') return Response.json({ ...scenario, state: 'completed', completed_task_ids: [9], tasks: [{ id: 9, kind: 'choice', title: 'Метод', content: { prompt: 'Как читать?', options: ['GET'] } }] })
    if (path === '/api/directions') return Response.json([direction])
    throw new Error(`Unexpected API request: ${path}`)
  })
  function Scene() { return React.createElement('div', null, 'Восстановленная сцена') }
  render(React.createElement(GameScreen, { api, scenarioId: 7, Game: Scene }))

  assert.ok(await screen.findByText('Все задания этой локации завершены.'))
  assert.equal(screen.getByRole('link', { name: 'Вернуться в хаб' }).getAttribute('href'), '#/hub')
  assert.deepEqual(calls, [{ path: '/api/scenarios/7', method: undefined }, { path: '/api/directions', method: undefined }])
})

test('modal reuses its request id after a network failure', async () => {
  const requestIds = []
  const api = new ApiClient('/api', () => 'token', () => {}, async (_input, init) => {
    requestIds.push(JSON.parse(init.body).request_id)
    if (requestIds.length === 1) throw new TypeError('offline')
    return Response.json({ id: 2, task_id: 9, is_correct: false, reaction: 'retry', explanation: 'Повторите.', scenario_state: 'active' }, { status: 201 })
  })
  render(React.createElement(TaskModal, { api, task: { id: 9, kind: 'choice', title: 'Метод', content: { prompt: 'Как читать?', options: ['GET', 'POST'] } }, onResult: () => {}, onClose: () => {} }))
  fireEvent.click(screen.getByLabelText('POST'))
  fireEvent.click(screen.getByRole('button', { name: 'Проверить решение' }))
  assert.ok(await screen.findByRole('alert'))
  fireEvent.click(screen.getByRole('button', { name: 'Проверить решение' }))
  await screen.findByText('Мир реагирует: можно попробовать ещё раз.', { exact: false })
  assert.equal(requestIds.length, 2)
  assert.equal(requestIds[0], requestIds[1])
  assert.match(requestIds[0], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('switching header tabs preserves the current building scene', async () => {
  localStorage.setItem('tvoyvybor.accessToken', 'saved-token')
  window.location.hash = '/building/3'
  mockApi()
  render(React.createElement(App))
  const scene = await screen.findByLabelText('Игровая сцена')
  fireEvent.click(screen.getByRole('link', { name: 'Помощь' }))
  assert.ok(await screen.findByRole('heading', { name: 'Помощь' }))
  fireEvent.click(screen.getByRole('link', { name: 'Хаб' }))
  assert.equal(await screen.findByLabelText('Игровая сцена'), scene)
  assert.equal(screen.queryByLabelText('Игровой кампус'), null)
})

test('switching header tabs preserves the campus scene', async () => {
  localStorage.setItem('tvoyvybor.accessToken', 'saved-token')
  window.location.hash = '/hub'
  mockApi()
  render(React.createElement(App))
  const scene = await screen.findByLabelText('Игровой кампус')
  fireEvent.click(screen.getByRole('link', { name: 'Помощь' }))
  assert.ok(await screen.findByRole('heading', { name: 'Помощь' }))
  fireEvent.click(screen.getByRole('link', { name: 'Хаб' }))
  assert.equal(await screen.findByLabelText('Игровой кампус'), scene)
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
