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
