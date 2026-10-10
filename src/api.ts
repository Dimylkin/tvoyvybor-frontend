export interface User {
  id: number
  email: string
  role: 'user' | 'admin'
}

export interface Direction {
  id: number
  slug: string
  title: string
  description: string
}

export type ScenarioState = 'locked' | 'available' | 'active' | 'completed' | 'skipped'

export interface Scenario {
  id: number
  direction_id: number
  slug: string
  title: string
  description: string
  state: ScenarioState
}

export interface Progress {
  scenario_id: number
  state: ScenarioState
}

export interface Task {
  id: number
  kind: string
  title: string
  content: Record<string, unknown>
}

export interface ScenarioDetail extends Scenario {
  tasks: Task[]
  completed_task_ids: number[]
}

export interface AttemptResult {
  id: number
  task_id: number
  is_correct: boolean
  reaction: 'retry' | 'completed'
  explanation: string
  scenario_state: ScenarioState
}

export interface InterestProfile {
  direction_scores: Record<string, number>
  event_count: number
}

export interface InterestEvent {
  task_id: number | null
  direction_id: number
  source: string
  weight: number
  explanation: string
}

export interface Recommendation {
  direction_id: number
  explanation: string
}

export interface Achievement {
  slug: string
  title: string
  description: string
}

interface TokenResponse {
  access_token: string
  token_type: string
}

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export class ApiClient {
  private readonly baseUrl: string
  private readonly getToken: () => string | null
  private readonly onUnauthorized: () => void
  private readonly fetchImpl: typeof fetch
  constructor(
    baseUrl: string,
    getToken: () => string | null,
    onUnauthorized: () => void,
    fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = baseUrl
    this.getToken = getToken
    this.onUnauthorized = onUnauthorized
    this.fetchImpl = fetchImpl
  }

  private async request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
    const headers = new Headers(init.headers)
    if (init.body) headers.set('Content-Type', 'application/json')
    const token = this.getToken()
    if (authenticated && token) headers.set('Authorization', `Bearer ${token}`)

    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${path}`, { ...init, headers })
    } catch {
      throw new Error('Не удалось связаться с сервером. Проверьте подключение и повторите попытку.')
    }

    if (!response.ok) {
      if (authenticated && response.status === 401) this.onUnauthorized()
      const body: unknown = await response.json().catch(() => null)
      const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null
      throw new ApiError(response.status, typeof detail === 'string' ? detail : `Ошибка сервера (${response.status})`)
    }
    return response.json() as Promise<T>
  }

  register(email: string, password: string): Promise<User> {
    return this.request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }, false)
  }

  login(email: string, password: string): Promise<TokenResponse> {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false)
  }

  me(): Promise<User> { return this.request('/auth/me') }
  directions(): Promise<Direction[]> { return this.request('/directions') }
  scenarios(): Promise<Scenario[]> { return this.request('/scenarios') }
  scenario(id: number): Promise<ScenarioDetail> { return this.request(`/scenarios/${id}`) }
  startScenario(id: number): Promise<Progress> { return this.request(`/scenarios/${id}/start`, { method: 'PUT' }) }
  submitAttempt(taskId: number, requestId: string, answer: string): Promise<AttemptResult> {
    return this.request(`/tasks/${taskId}/attempts`, { method: 'POST', body: JSON.stringify({ request_id: requestId, answer }) })
  }
  progress(): Promise<Progress[]> { return this.request('/progress') }
  interestProfile(): Promise<InterestProfile> { return this.request('/interest-profile') }
  interestEvents(): Promise<InterestEvent[]> { return this.request('/interest-events') }
  recommendation(): Promise<Recommendation | null> { return this.request('/recommendation') }
  achievements(): Promise<Achievement[]> { return this.request('/achievements') }
}
