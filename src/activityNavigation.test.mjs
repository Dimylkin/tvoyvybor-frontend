import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import React from 'react'
import { createServer } from 'vite'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator })
globalThis.localStorage = dom.window.localStorage
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { render, screen, cleanup, act, fireEvent } = await import('@testing-library/react')
const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
afterEach(cleanup)
after(async () => { await vite.close(); dom.window.close() })

test('phone opens the newly requested quest when already mounted', async () => {
  const { CampusPhone } = await vite.ssrLoadModule('/src/campusos/CampusPhone.tsx')
  const makeQuest = (id, title) => ({ id, title, description: 'Описание', location_slug: 'backend', giver_npc_id: 'boris', category: 'professional', status: 'available', accepted_at: null, objectives: [], gameplay: null })
  const props = { api: {}, user: { email: 'user@example.com' }, quests: [makeQuest(1, 'Первое дело'), makeQuest(2, 'Второе дело')], loading: false, loadError: '', reload: async () => {}, close: () => {}, logout: () => {}, profile: null }
  const view = render(React.createElement(CampusPhone, { ...props, initialQuestId: 1 }))
  assert.ok(screen.getByRole('heading', { name: 'Первое дело' }))
  view.rerender(React.createElement(CampusPhone, { ...props, initialQuestId: 2 }))
  assert.ok(screen.getByRole('heading', { name: 'Второе дело' }))
})

test('history explains archived action and abandoned status without exposing code', async () => {
  const { QuestProfile } = await vite.ssrLoadModule('/src/campusos/QuestProfile.tsx')
  const profile = { event_count: 1, careers: [], insights: [], next_step: null, history: [{ quest_id: 1, title: 'Прошлое дело', status: 'abandoned', published: false, activities: [], reflection: { response: 'repeat', activity_code: 'investigation', barrier: null }, legacy_reaction: null }] }
  render(React.createElement(QuestProfile, { quests: [], activityProfile: profile }))
  assert.ok(screen.getByText('Отложено'))
  assert.ok(screen.getByText('Хочу повторить: Искать причины'))
  assert.doesNotMatch(document.body.textContent, /investigation/)
})


test('late profile response cannot attach another quest reflection to station', async () => {
  const { QuestInteraction } = await vite.ssrLoadModule('/src/campusos/QuestInteraction.tsx')
  const pending = []
  const api = { activityProfile: () => new Promise(resolve => pending.push(resolve)) }
  const quest = (id, title) => ({ id, title, status: 'active', location_slug: 'backend', giver_npc_id: 'boris', accepted_at: '2026-01-01', gameplay: { kind: 'diagnosis', state: { stage: 'intro', hints: 0, attempts: 0 } } })
  const props = { api, close: () => {}, reload: async () => {}, onAwards: () => {}, userId: 1, target: 'terminal' }
  const view = render(React.createElement(QuestInteraction, { ...props, quest: quest(1, 'Первое') }))
  view.rerender(React.createElement(QuestInteraction, { ...props, quest: quest(2, 'Второе') }))
  const item = (id, title) => ({ quest_id: id, title, published: true, activities: [{ code: 'coding', label: 'Работать над кодом' }], reflection: null })
  await act(async () => pending[1]({ history: [item(2, 'Второе')] }))
  await act(async () => pending[0]({ history: [item(1, 'Первое')] }))
  fireEvent.click(screen.getByRole('button', { name: 'Отметить впечатление' }))
  assert.ok(screen.getByRole('region', { name: 'Впечатление: Второе' }))
  assert.equal(screen.queryByRole('region', { name: 'Впечатление: Первое' }), null)
})
