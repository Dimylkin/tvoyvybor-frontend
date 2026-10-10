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
const { default: App, GameScreen } = await vite.ssrLoadModule('/src/App.tsx')
const { TaskModal } = await vite.ssrLoadModule('/src/TaskModal.tsx')
const { ApiClient } = await vite.ssrLoadModule('/src/api.ts')

const user = { id: 1, email: 'player@example.com', role: 'user' }
const direction = { id: 3, slug: 'backend', title: 'Backend', description: 'Серверная разработка' }
const scenario = { id: 7, direction_id: 3, slug: 'first', title: 'Первый сценарий', description: 'Проверка сервера', state: 'active' }

function mockApi({ login = false, meStatus = 200 } = {}) {
  const requests = []
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input), 'http://localhost:5173').pathname
    const authorization = new Headers(init?.headers).get('Authorization')
    requests.push({ path, authorization })
    if (path === '/api/auth/login' && login) return Response.json({ access_token: 'test-token', token_type: 'bearer' })
    if (path === '/api/auth/me') return meStatus === 401 ? Response.json({ detail: 'Invalid authentication credentials' }, { status: 401 }) : Response.json(user)
    if (path === '/api/directions') return Response.json([direction])
    if (path === '/api/scenarios') return Response.json([scenario])
    if (path === '/api/progress') return Response.json([{ scenario_id: 7, state: 'completed' }])
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

test('login opens the hub with server-saved scenario status', async () => {
  const requests = mockApi({ login: true })
  render(React.createElement(App))
  fireEvent.change(screen.getByLabelText('Электронная почта'), { target: { value: 'player@example.com' } })
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }))

  assert.ok(await screen.findByText('Первый сценарий'))
  assert.ok(screen.getByText('Завершён'))
  assert.equal(localStorage.getItem('tvoyvybor.accessToken'), 'test-token')
  assert.ok(requests.some((request) => request.path === '/api/progress' && request.authorization === 'Bearer test-token'))
})

test('saved token restores the session and server status after remount', async () => {
  localStorage.setItem('tvoyvybor.accessToken', 'saved-token')
  window.location.hash = '/hub'
  const requests = mockApi()
  render(React.createElement(App))

  assert.ok(await screen.findByText('Первый сценарий'))
  assert.ok(screen.getByText('Завершён'))
  assert.ok(requests.some((request) => request.path === '/api/auth/me' && request.authorization === 'Bearer saved-token'))
  assert.ok(requests.some((request) => request.path === '/api/progress' && request.authorization === 'Bearer saved-token'))
})

test('401 while restoring the session clears the token and opens login', async () => {
  localStorage.setItem('tvoyvybor.accessToken', 'expired-token')
  window.location.hash = '/hub'
  mockApi({ meStatus: 401 })
  render(React.createElement(App))

  await waitFor(() => assert.ok(screen.getByRole('heading', { name: 'Войти в игру' })))
  assert.equal(localStorage.getItem('tvoyvybor.accessToken'), null)
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

test('game screen opens a task from the scene and shows completed server feedback', async () => {
  const calls = []
  const api = new ApiClient('/api', () => 'token', () => {}, async (input, init) => {
    const path = new URL(String(input), 'http://localhost:5173').pathname
    calls.push({ path, method: init?.method })
    if (path === '/api/scenarios/7') return Response.json({ ...scenario, state: 'available', completed_task_ids: [], tasks: [{ id: 9, kind: 'choice', title: 'Метод', content: { prompt: 'Как читать?', options: ['GET', 'POST'] } }] })
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
    'GET /api/scenarios/7', 'PUT /api/scenarios/7/start', 'POST /api/tasks/9/attempts',
  ])
})

test('completed game route restores server state without starting the scenario again', async () => {
  const calls = []
  const api = new ApiClient('/api', () => 'token', () => {}, async (input, init) => {
    const path = new URL(String(input), 'http://localhost:5173').pathname
    calls.push({ path, method: init?.method })
    if (path === '/api/scenarios/7') return Response.json({ ...scenario, state: 'completed', completed_task_ids: [9], tasks: [{ id: 9, kind: 'choice', title: 'Метод', content: { prompt: 'Как читать?', options: ['GET'] } }] })
    throw new Error(`Unexpected API request: ${path}`)
  })
  function Scene() { return React.createElement('div', null, 'Восстановленная сцена') }
  render(React.createElement(GameScreen, { api, scenarioId: 7, Game: Scene }))

  assert.ok(await screen.findByText('Все задания этой локации завершены.'))
  assert.deepEqual(calls, [{ path: '/api/scenarios/7', method: undefined }])
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
