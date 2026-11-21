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
globalThis.sessionStorage = dom.window.sessionStorage
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.MutationObserver = dom.window.MutationObserver
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { render, screen, cleanup, fireEvent, waitFor } = await import('@testing-library/react')
// Expose existing screens to test the same components used by the application routes.
const vite = await createServer({ plugins: [{ name: 'expose-profile-screens', enforce: 'pre', transform(source, id) { if (id.endsWith('/src/App.tsx')) return `${source}\nexport { MentorConversation, ProfileScreen, ResultsScreen }` } }], server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const { MentorConversation, ProfileScreen, ResultsScreen } = await vite.ssrLoadModule('/src/App.tsx')
const { QuestProfile } = await vite.ssrLoadModule('/src/campusos/QuestProfile.tsx')
const { QuestInteraction } = await vite.ssrLoadModule('/src/campusos/QuestInteraction.tsx')
const { locationFor } = await vite.ssrLoadModule('/src/world.ts')
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })
after(async () => { await vite.close(); dom.window.close() })

function makeProfile(status = 'hypothesis') {
  return {
    event_count: 1, performance_score: 0, preliminary: true, observations: 1,
    groups: [], learning: [], additional: null,
    insights: [{ activity_code: 'investigation', label: 'Искать причины', status, evidence: [{ quest_id: 1, title: 'Пятничный релиз', description: 'В «Пятничном релизе» ты искал причину сбоя.' }] }],
    careers: status === 'repeated' ? [{ name: 'QA', explanation: 'В QA ищут причины сбоев.' }] : [],
    next_step: { quest_id: 2, title: 'Почему всё стало лучше?', explanation: 'Объясни аномалию в данных.' }, history: [],
  }
}
const noop = () => {}
const labels = { hypothesis: 'Возможно, тебе интересно попробовать это снова.', repeated: 'Этот интерес повторился в разных ситуациях.', mixed: 'В разных ситуациях впечатления различались.' }

for (const status of Object.keys(labels)) {
  test(`four profile surfaces preserve the ${status} conclusion`, async () => {
    const profile = makeProfile(status)
    const api = { activityProfile: async () => profile, achievements: async () => [], scenarios: async () => [] }
    const assertConclusion = () => {
      assert.match(document.body.textContent, new RegExp(labels[status].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      assert.match(document.body.textContent, /В «Пятничном релизе» ты искал причину сбоя/)
      assert.match(document.body.textContent, /Почему всё стало лучше/)
      if (status === 'repeated') { assert.match(document.body.textContent, /QA/); assert.match(document.body.textContent, /В QA ищут причины сбоев/) }
    }
    render(React.createElement(QuestProfile, { quests: [], activityProfile: profile }))
    assertConclusion(); cleanup()
    render(React.createElement(ProfileScreen, { api }))
    await screen.findByText('Искать причины'); assertConclusion(); cleanup()
    render(React.createElement(ResultsScreen, { api }))
    await screen.findByText('Искать причины'); assertConclusion(); cleanup()
    render(React.createElement(MentorConversation, { api, location: locationFor('narrator'), quests: [], story: { final_quest_unlocked: true, final_quest_completed: false }, onStory: noop, onAwards: noop, close: noop }))
    fireEvent.click(screen.getByRole('button', { name: /Понемногу\. Что здесь можно попробовать/ }))
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    fireEvent.click(screen.getByRole('button', { name: /Покажи темы/ }))
    fireEvent.click(screen.getByRole('button', { name: /Да, давай подведём итоги/ }))
    await waitFor(assertConclusion)
  })
}

test('a completed historical quest can be clarified and reloaded from profile', async () => {
  let current = { ...makeProfile(), insights: [], history: [{ quest_id: 7, title: 'Старое дело', status: 'completed', published: true, legacy_reaction: 'interesting', activities: [{ code: 'coding', label: 'Работать над кодом' }], reflection: null }] }
  const calls = []
  const api = {
    activityProfile: async () => current,
    reflectQuest: async (id, requestId, reflection) => { calls.push({ id, requestId, reflection }); current = { ...current, history: [{ ...current.history[0], reflection }] } },
  }
  render(React.createElement(ProfileScreen, { api }))
  await screen.findByText('Старое дело')
  assert.ok(screen.getByText(/Ответ наставнику: Было интересно/))
  fireEvent.click(screen.getByRole('button', { name: 'Отметить впечатление' }))
  fireEvent.change(screen.getByLabelText('Действие'), { target: { value: 'coding' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await screen.findByText(/Хочу повторить: Работать над кодом/)
  assert.equal(calls.length, 1); assert.equal(calls[0].id, 7); assert.equal(calls[0].reflection.activity_code, 'coding')
  cleanup(); render(React.createElement(ProfileScreen, { api }))
  assert.ok(await screen.findByText(/Хочу повторить: Работать над кодом/))
})

test('a failed test run enables reflection without completing the quest', async () => {
  let attempted = false
  let saved = null
  const actions = []
  const code = 'def calculate_average(grades):\n    return 0'
  const initial = { id: 12, title: 'Очень маленькая фича', status: 'active', location_slug: 'backend', giver_npc_id: 'boris', accepted_at: '2026-01-01', gameplay: { kind: 'code', state: { stage: 'mini-game', seen: [], hints: 0, attempts: 0, active_seconds: 0, success: false, code, feedback: '' } } }
  const makeHistory = () => ({ quest_id: 12, title: initial.title, status: 'active', published: true, activities: attempted ? [{ code: 'coding', label: 'Работать над кодом' }] : [], reflection: saved })
  const api = {
    activityProfile: async () => ({ ...makeProfile(), history: [makeHistory()] }),
    questAction: async (_id, _requestId, action) => { actions.push(action); if (action === 'run') attempted = true; return { awards: [] } },
    reflectQuest: async (_id, _requestId, reflection) => { saved = reflection },
  }
  function Station() {
    const [quest, setQuest] = React.useState(initial)
    return React.createElement(QuestInteraction, { api, quest, userId: 1, target: 'terminal', close: noop, onAwards: noop, reload: async () => setQuest(q => ({ ...q, gameplay: { ...q.gameplay, state: { ...q.gameplay.state, attempts: 1, tests: [{ passed: false, input: [1], detail: 'не совпало' }] } } })) })
  }
  render(React.createElement(Station))
  assert.equal(screen.queryByRole('button', { name: 'Отметить впечатление' }), null)
  fireEvent.click(screen.getByRole('button', { name: 'Запустить тесты' }))
  assert.ok(await screen.findByText(/0 из 1 пройдены/))
  fireEvent.click(await screen.findByRole('button', { name: 'Отметить впечатление' }))
  fireEvent.change(screen.getByLabelText('Действие'), { target: { value: 'coding' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => assert.equal(saved?.activity_code, 'coding'))
  assert.ok(screen.getByText(/0 из 1 пройдены/))
  assert.ok(actions.includes('run'))
  assert.ok(!actions.includes('react'))
})
