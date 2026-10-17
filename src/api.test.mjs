import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiClient, ApiError } from './api.ts'

test('protected requests use the saved token and return server progress', async () => {
  let requestedUrl = ''
  let authorization = ''
  const fetchMock = async (input, init) => {
    requestedUrl = String(input)
    authorization = new Headers(init?.headers).get('Authorization') ?? ''
    return Response.json([{ scenario_id: 7, state: 'active' }])
  }
  const client = new ApiClient('http://localhost:8000/', () => 'saved-token', () => {}, fetchMock)
  assert.deepEqual(await client.progress(), [{ scenario_id: 7, state: 'active' }])
  assert.equal(requestedUrl, 'http://localhost:8000/progress')
  assert.equal(authorization, 'Bearer saved-token')
})

test('401 on a protected request clears the session', async () => {
  let unauthorized = 0
  const fetchMock = async () => Response.json({ detail: 'Invalid authentication credentials' }, { status: 401 })
  const client = new ApiClient('', () => 'expired', () => { unauthorized += 1 }, fetchMock)
  await assert.rejects(client.me(), (error) => error instanceof ApiError && error.status === 401)
  assert.equal(unauthorized, 1)
})

test('login does not send an old token or clear the session on invalid credentials', async () => {
  let authorization = ''
  let unauthorized = 0
  const fetchMock = async (_input, init) => {
    authorization = new Headers(init?.headers).get('Authorization') ?? ''
    return Response.json({ detail: 'Invalid credentials' }, { status: 401 })
  }
  const client = new ApiClient('', () => 'old-token', () => { unauthorized += 1 }, fetchMock)
  await assert.rejects(client.login('user@example.com', 'wrong'), (error) => error instanceof ApiError && error.message === 'Invalid credentials')
  assert.equal(authorization, '')
  assert.equal(unauthorized, 0)
})

test('network failure can be retried without invalidating the saved token', async () => {
  let unauthorized = 0
  const client = new ApiClient('', () => 'saved-token', () => { unauthorized += 1 }, async () => {
    throw new TypeError('offline')
  })

  await assert.rejects(client.me(), /Не удалось связаться с сервером/)
  assert.equal(unauthorized, 0)
})

test('game requests start a scenario and submit an idempotent attempt', async () => {
  const calls = []
  const client = new ApiClient('/api', () => 'saved-token', () => {}, async (input, init) => {
    calls.push({ url: String(input), method: init?.method, body: init?.body, authorization: new Headers(init?.headers).get('Authorization') })
    if (String(input).endsWith('/scenarios/7/start')) return Response.json({ scenario_id: 7, state: 'active' })
    return Response.json({ id: 4, task_id: 9, is_correct: false, reaction: 'retry', explanation: 'Попробуйте ещё раз.', scenario_state: 'active' }, { status: 201 })
  })

  assert.deepEqual(await client.startScenario(7), { scenario_id: 7, state: 'active' })
  const result = await client.submitAttempt(9, '3d1b3b10-9cae-4f10-a064-23fe0ef9a0b5', 'POST')
  assert.equal(result.reaction, 'retry')
  assert.deepEqual(calls, [
    { url: '/api/scenarios/7/start', method: 'PUT', body: undefined, authorization: 'Bearer saved-token' },
    { url: '/api/tasks/9/attempts', method: 'POST', body: '{"request_id":"3d1b3b10-9cae-4f10-a064-23fe0ef9a0b5","answer":"POST"}', authorization: 'Bearer saved-token' },
  ])
})

test('stage 7 report and publication requests match the server contract', async () => {
  const calls = []
  const client = new ApiClient('/api', () => 'saved-token', () => {}, async (input, init) => {
    calls.push({ url: String(input), method: init?.method, body: init?.body })
    return Response.json({})
  })

  await client.finalReport()
  await client.setAdminScenarioPublication(7, true)
  await client.setAdminScenarioPublication(7, false)
  await client.setAdminTaskPublication(9, true)
  await client.setAdminTaskPublication(9, false)

  assert.deepEqual(calls, [
    { url: '/api/final-report', method: undefined, body: undefined },
    { url: '/api/admin/scenarios/7/publish', method: 'PUT', body: undefined },
    { url: '/api/admin/scenarios/7/unpublish', method: 'PUT', body: undefined },
    { url: '/api/admin/tasks/9/publish', method: 'PUT', body: undefined },
    { url: '/api/admin/tasks/9/unpublish', method: 'PUT', body: undefined },
  ])
})
