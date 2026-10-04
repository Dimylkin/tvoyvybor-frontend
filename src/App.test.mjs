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
const { default: App } = await vite.ssrLoadModule('/src/App.tsx')

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
