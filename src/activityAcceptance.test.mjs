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
    main_observation: { activity_code: 'investigation', status, headline: labels[status], interest: 'Тебе интересно искать причины.', direction: 'QA', example: 'Проверь две гипотезы.' },
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
      if (status !== 'mixed') assert.match(document.body.textContent, /QA/)
    }
    render(React.createElement(QuestProfile, { quests: [], activityProfile: profile }))
    assertConclusion(); cleanup()
    render(React.createElement(ProfileScreen, { api }))
    await screen.findByText('Твои наблюдения'); assertConclusion(); cleanup()
    render(React.createElement(ResultsScreen, { api }))
    await screen.findByText('Твои наблюдения'); assertConclusion(); cleanup()
    render(React.createElement(MentorConversation, { api, location: locationFor('narrator'), quests: [], story: { final_quest_unlocked: true, final_quest_completed: false }, onStory: noop, onAwards: noop, close: noop }))
    fireEvent.click(screen.getByRole('button', { name: /Понемногу\. Что здесь можно попробовать/ }))
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    fireEvent.click(screen.getByRole('button', { name: /Покажи темы/ }))
    fireEvent.click(screen.getByText('Подвести итоги'))
    await waitFor(() => assert.match(document.body.textContent, new RegExp(labels[status].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))))
    assert.doesNotMatch(document.body.textContent, /В «Пятничном релизе» ты искал причину сбоя/)
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
  fireEvent.click(screen.getByText('История проб'))
  assert.ok(screen.getByText(/Ответ наставнику: Было интересно/))
  fireEvent.click(screen.getByRole('button', { name: 'Отметить впечатление' }))
  fireEvent.change(screen.getByLabelText('Действие'), { target: { value: 'coding' } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await screen.findByText(/Хочу повторить: Работать над кодом/)
  assert.equal(calls.length, 1); assert.equal(calls[0].id, 7); assert.equal(calls[0].reflection.activity_code, 'coding')
  cleanup(); render(React.createElement(ProfileScreen, { api }))
  assert.ok(await screen.findByText(/Хочу повторить: Работать над кодом/))
})

test('a failed test run keeps progress active without a station reflection', async () => {
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
  assert.equal(screen.queryByRole('button', { name: 'Отметить впечатление' }), null)
  assert.equal(saved, null)
  assert.ok(screen.getByText(/0 из 1 пройдены/))
  assert.ok(actions.includes('run'))
  assert.ok(!actions.includes('react'))
})

for (const scenario of [
  { name: 'positive choice saves activity with retry', choice: 'Неплохо, было интересно.', followup: 'Работать над кодом', response: 'repeat' },
  { name: 'neutral choice preserves uncertainty', choice: 'Нормально, но пока не уверен.', followup: 'Пока не знаю', response: 'unsure' },
  { name: 'skip does not save a reflection', choice: 'Я бы ещё покопался в этом.', followup: 'Пропустить вопрос', response: null },
  { name: 'negative reaction skips the followup', choice: 'Идею понял, но это не моё.', followup: null, response: null },
]) {
  test(`mentor reflection: ${scenario.name}`, async () => {
    const { QuestConversation } = await vite.ssrLoadModule('/src/campusos/QuestInteraction.tsx')
    const calls = []; const actions = []
    const quest = { id: 51, title: 'Проба', status: 'active', location_slug: 'backend', giver_npc_id: 'boris', accepted_at: '2026-01-01', tracked: true, gameplay: { kind: 'code', state: { stage: 'result', hints: 0, attempts: 1 } } }
    const api = {
      questAction: async (_id, _uuid, action, payload) => { actions.push([action, payload]); return { awards: [] } },
      activityProfile: async () => ({ history: [{ quest_id: 51, activities: [{ code: 'coding', label: 'Работать над кодом' }] }] }),
      reflectQuest: async (...args) => { calls.push(args); if (scenario.response === 'repeat' && calls.length === 1) throw new Error('network') },
    }
    render(React.createElement(QuestConversation, { api, quests: [quest], location: locationFor('backend'), close: noop, reload: async () => {}, onAwards: noop, userId: 1 }))
    fireEvent.click(screen.getByText(scenario.choice))
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    await waitFor(() => assert.equal(actions[0]?.[0], 'react'))
    if (scenario.followup) {
      fireEvent.click(await screen.findByText(scenario.followup))
      if (scenario.response === 'repeat') {
        await screen.findByRole('alert')
        fireEvent.click(screen.getByText(scenario.followup))
        await waitFor(() => assert.equal(calls.length, 2))
        assert.equal(calls[0][1], calls[1][1])
      }
      if (scenario.response) await waitFor(() => assert.equal(calls.at(-1)?.[2].response, scenario.response))
    } else {
      await screen.findByText('До встречи!')
      assert.equal(screen.queryByText('Пока не знаю'), null)
    }
    if (!scenario.response) assert.equal(calls.length, 0)
  })
}
