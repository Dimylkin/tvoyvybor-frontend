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


test('station does not load or offer reflection', async () => {
  const { QuestInteraction } = await vite.ssrLoadModule('/src/campusos/QuestInteraction.tsx')
  let profileCalls = 0
  const api = { activityProfile: async () => { profileCalls++; return { history: [] } } }
  const quest = { id: 1, title: 'Первое', status: 'active', location_slug: 'backend', giver_npc_id: 'boris', accepted_at: '2026-01-01', gameplay: { kind: 'diagnosis', state: { stage: 'mini-game', hints: 0, attempts: 0, seen: [] } } }
  render(React.createElement(QuestInteraction, { api, quest, close: () => {}, reload: async () => {}, onAwards: () => {}, userId: 1, target: 'terminal' }))
  await act(async () => {})
  assert.equal(profileCalls, 0)
  assert.equal(screen.queryByRole('button', { name: /Отметить впечатление/ }), null)
})

test('opening a quest from a route replaces an already open final card', async () => {
  const { CampusPhone } = await vite.ssrLoadModule('/src/campusos/CampusPhone.tsx')
  const quest = { id: 7, title: 'Новое дело', description: 'Описание', location_slug: 'backend', giver_npc_id: 'boris', category: 'professional', status: 'available', accepted_at: null, objectives: [], gameplay: null }
  const props = { api: {}, user: { email: 'user@example.com' }, quests: [quest], loading: false, loadError: '', reload: async () => {}, close: () => {}, logout: () => {}, profile: null, finalQuestUnlocked: true }
  const view = render(React.createElement(CampusPhone, props))
  fireEvent.click(screen.getByRole('button', { name: 'Задачи' }))
  fireEvent.click(screen.getByRole('button', { name: 'Доступные' }))
  fireEvent.click(screen.getByText('Подвести итоги'))
  assert.ok(screen.getByRole('heading', { name: 'Подвести итоги' }))
  view.rerender(React.createElement(CampusPhone, { ...props, initialQuestId: 7 }))
  assert.ok(screen.getByRole('heading', { name: 'Новое дело' }))
  assert.equal(screen.queryByRole('heading', { name: 'Подвести итоги' }), null)
})
