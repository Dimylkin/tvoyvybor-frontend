export interface QuestionnaireAnswer { status: 'answered' | 'skipped' | 'unsure', value?: number | string[] | null }
export interface QuestionnaireQuestion { id: string, format: 'scale' | 'choice', text: string, prompt?: string, max_choices?: number, options?: { id: string, label: string }[] }
export interface QuestionnaireAttempt { id: number, number: number, status: 'in_progress' | 'completed', current_question_id: string, revision: number, answers: Record<string, QuestionnaireAnswer>, started_at: string, completed_at: string | null }
export interface QuestionnaireState { status: 'not_started' | 'in_progress' | 'completed', current: QuestionnaireAttempt | null, last_completed: QuestionnaireAttempt | null }

export interface GameState {
  stage: 'intro' | 'interaction' | 'mini-game' | 'return' | 'result' | 'complete'
  assistant_questions?: string[]
  intro_deferred?: boolean
  code_answer?: string
  interview_history?: string[]
  proposal_draft?: Record<string, string>
  intro_line?: number
  debrief_line?: number
  repair_code?: string
  failed_checks?: number
  user_trace?: { step: string, passed: boolean, message: string }[]
  choices?: string[]
  seen: string[]
  attempts: number
  hints: number
  example_used: boolean
  example_shown?: boolean
  user_checks?: Record<string, boolean>
  extra_exploration: number
  extra_result?: string
  active_seconds: number
  voluntary: boolean
  success: boolean
  feedback: string
  reaction?: string
  code?: string
  properties?: Record<string, string>
  device_results?: Record<string, { overflow: boolean, cards: boolean, button: boolean, readability: boolean }>
  checked?: string[]
  tests?: { input: (number | null)[], passed: boolean, detail: string }[]
  user_step?: number
}
export interface GameActionResult { state: GameState, awards: Achievement[] }

export interface QuestObjective {
  id: number
  title: string
  description: string
  objective_type: string
  required_count: number
  current_count: number
  completed: boolean
  is_required: boolean
}

export interface Quest {
  id: number
  slug: string
  title: string
  description: string
  category: string
  location_slug: string
  giver_npc_id: string
  status: 'locked' | 'available' | 'active' | 'abandoned' | 'completed'
  accepted_at: string | null
  completed_at: string | null
  tracked: boolean
  objectives: QuestObjective[]
  gameplay?: { kind: string, state: GameState } | null
}

export interface InteractionResult {
  accepted: boolean
  changes: { quest_id: number, objective_id: number, objective_completed: boolean, quest_completed: boolean }[]
}

export interface User {
  id: number
  email: string
  role: 'user' | 'admin'
  onboarding_completed: boolean
  intro_completed: boolean
  main_story_completed: boolean
}

export interface StoryState {
  intro_completed: boolean
  final_quest_unlocked: boolean
  final_quest_completed: boolean
  main_story_completed: boolean
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

export interface FinalReportDirection {
  direction_id: number
  title: string
  score: number
  reason: string
}

export interface FinalReport {
  event_count: number
  completed_task_count: number
  directions: FinalReportDirection[]
  observations: string[]
  next_steps: string[]
}

export interface ActivityInterest {
  code: string
  name: string
  description: string
  score: number
  evidence_count: number
  evidence: string[]
}

export interface ActivityRecommendation {
  name: string
  explanation: string
}

export interface LearningSuggestion {
  title: string
  action: string
  group: string
}

export interface ActivityReflection {
  response: 'repeat' | 'unsure' | 'not_mine'
  activity_code: string | null
  barrier: 'difficulty' | 'interface' | 'activity' | null
}
export interface ActivityHistory {
  quest_id: number
  title: string
  status: string
  published: boolean
  legacy_reaction: string | null
  activities: { code: string, label: string }[]
  reflection: ActivityReflection | null
}
export interface ReflectionV2 { quest_id: number, code: string, rating: number | 'unable' | null, reason: string | null, evidence_event_id: number }
export interface CareerProfile { version: number, status: 'empty' | 'preliminary' | 'established', rated_quests: number, directions: { code: string, title: string, score: number | null, traits: string[], coverage: number }[], leaders: string[], careers: { code: string, title: string, score: number | null, traits: string[], tasks: string, skills: string[], exercises: string[], represented: boolean }[], traits: Record<string, { value: number, questionnaire: number | null, game: number | null, divergent: boolean, evidence: { quest_id: number, title: string, activity: string, rating: number, reason: string | null, recorded_at: string, questionnaire_order: 'before' | 'after' | null }[] }>, reflections: ReflectionV2[], next_step: { quest_id: number | null, title: string, explanation: string } | null }
export interface ActivityProfile {
  career_profile?: CareerProfile
  event_count: number
  performance_score: number
  preliminary: boolean
  groups: ActivityInterest[]
  careers: ActivityRecommendation[]
  learning: LearningSuggestion[]
  additional: [string, string] | null
  observations: number
  history: ActivityHistory[]
  insights: { activity_code: string, label: string, status: 'hypothesis' | 'repeated' | 'mixed', evidence: { quest_id: number, title: string, description: string }[] }[]
  next_step: { quest_id: number | null, title: string, explanation: string } | null
  main_observation?: { activity_code: string, status: 'hypothesis' | 'repeated' | 'mixed', headline: string, interest: string, direction: string, example: string } | null
}

export interface AdminScenario {
  id: number
  direction_id: number
  slug: string
  title: string
  description: string
  is_published: boolean
}

export interface AdminTask {
  id: number
  scenario_id: number
  kind: string
  title: string
  content: Record<string, unknown>
  validation_config: Record<string, unknown>
  correct_explanation: string
  incorrect_explanation: string
  is_published: boolean
}

export interface AdminScenarioInput {
  direction_id: number
  slug: string
  title: string
  description: string
}

export interface AdminTaskInput {
  kind: 'choice'
  title: string
  content: Record<string, unknown>
  validation_config: Record<string, unknown>
  correct_explanation: string
  incorrect_explanation: string
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
  private profileCache: Promise<ActivityProfile> | null = null
  private profileGeneration = 0
  private profileToken: string | null = null
  private invalidateProfile() { this.profileGeneration++; this.profileCache = null }
  constructor(
    baseUrl: string,
    getToken: () => string | null,
    onUnauthorized: () => void,
    fetchImpl: typeof fetch = fetch.bind(globalThis),
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

  private async requestVoid(path: string, init: RequestInit = {}): Promise<void> {
    const headers = new Headers(init.headers)
    const token = this.getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${path}`, { ...init, headers })
    } catch {
      throw new Error('Не удалось связаться с сервером. Проверьте подключение и повторите попытку.')
    }
    if (!response.ok) {
      if (response.status === 401) this.onUnauthorized()
      const body: unknown = await response.json().catch(() => null)
      const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null
      throw new ApiError(response.status, typeof detail === 'string' ? detail : `Ошибка сервера (${response.status})`)
    }
  }

  register(email: string, password: string): Promise<User> {
    return this.request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }, false)
  }

  login(email: string, password: string): Promise<TokenResponse> {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false)
  }

  async questAction(id: number, requestId: string, action: string, payload: Record<string, unknown> = {}): Promise<GameActionResult> { const result = await this.request<GameActionResult>(`/quests/${id}/actions`, { method: 'POST', body: JSON.stringify({ request_id: requestId, action, payload }) }); if (action !== 'engage') this.invalidateProfile(); return result }
  quests(): Promise<Quest[]> { return this.request('/quests') }
  offerQuest(id: number, npcId: string): Promise<Quest> { return this.request(`/quests/${id}/offer`, { method: 'POST', body: JSON.stringify({ npc_id: npcId }) }) }
  acceptQuest(id: number): Promise<Quest> { return this.request(`/quests/${id}/accept`, { method: 'POST' }) }
  abandonQuest(id: number): Promise<Quest> { return this.request(`/quests/${id}/abandon`, { method: 'POST' }) }
  trackQuest(id: number | null): Promise<{ quest_id: number | null }> { return this.request('/quests/tracked', { method: 'PUT', body: JSON.stringify({ quest_id: id }) }) }
  terminal(requestId: string): Promise<{ log: string, port: number }> { return this.request('/game/backend-terminal', { method: 'POST', body: JSON.stringify({ request_id: requestId }) }) }
  interact(requestId: string, eventType: string, targetKey: string, payload: Record<string, unknown> = {}): Promise<InteractionResult> { return this.request('/game/interactions', { method: 'POST', body: JSON.stringify({ request_id: requestId, event_type: eventType, target_key: targetKey, payload }) }) }

  questionnaireCatalog(): Promise<{ version: number, questions: QuestionnaireQuestion[] }> { return this.request('/questionnaire/catalog') }
  questionnaireResults(id: number): Promise<QuestionnaireAttempt & { interests: Record<string, number> }> { return this.request(`/questionnaire/attempts/${id}/results`) }
  questionnaireState(): Promise<QuestionnaireState> { return this.request('/questionnaire/state') }
  startQuestionnaire(requestId: string, retake = false): Promise<QuestionnaireAttempt> { return this.request('/questionnaire/attempts', { method: 'POST', body: JSON.stringify({ request_id: requestId, retake }) }) }
  saveQuestionnaire(id: number, requestId: string, revision: number, currentQuestionId: string, answer?: { question_id: string, answer: QuestionnaireAnswer }): Promise<QuestionnaireAttempt> { return this.request(`/questionnaire/attempts/${id}/progress`, { method: 'PUT', body: JSON.stringify({ request_id: requestId, expected_revision: revision, current_question_id: currentQuestionId, answer }) }) }
  async completeQuestionnaire(id: number, requestId: string, revision: number): Promise<QuestionnaireAttempt> { const result = await this.request<QuestionnaireAttempt>(`/questionnaire/attempts/${id}/complete`, { method: 'POST', body: JSON.stringify({ request_id: requestId, expected_revision: revision }) }); this.invalidateProfile(); return result }
  me(): Promise<User> { return this.request('/auth/me') }
  gameState(): Promise<StoryState> { return this.request('/game/state') }
  completeGameIntro(): Promise<StoryState> { return this.request('/game/intro-complete', { method: 'PUT' }) }
  completeFinalQuest(): Promise<StoryState> { return this.request('/game/final-quest/complete', { method: 'PUT' }) }
  completeOnboarding(): Promise<User> { return this.request('/auth/me/onboarding-complete', { method: 'PUT' }) }
  directions(): Promise<Direction[]> { return this.request('/directions') }
  scenarios(): Promise<Scenario[]> { return this.request('/scenarios') }
  interestProfile(): Promise<InterestProfile> { return this.request('/interest-profile') }
  interestEvents(): Promise<InterestEvent[]> { return this.request('/interest-events') }
  recommendation(): Promise<Recommendation | null> { return this.request('/recommendation') }
  achievements(): Promise<Achievement[]> { return this.request('/achievements') }
  finalReport(): Promise<FinalReport> { return this.request('/final-report') }
  activityProfile(): Promise<ActivityProfile> {
    const token = this.getToken()
    if (token !== this.profileToken) { this.profileToken = token; this.invalidateProfile() }
    if (!this.profileCache) {
      const generation = this.profileGeneration
      this.profileCache = this.request<ActivityProfile>('/activity-profile').then(value => generation === this.profileGeneration ? value : this.activityProfile()).catch(error => { if (generation !== this.profileGeneration) return this.activityProfile(); this.profileCache = null; throw error })
    }
    return this.profileCache
  }
  async reflectQuestV2(id: number, requestId: string, changes: { code: string, rating: number | 'unable' | null, reason: string | null }[], repeat: boolean | null): Promise<unknown> { const result = await this.request(`/quests/${id}/reflection-v2`, { method: 'PUT', body: JSON.stringify({ request_id: requestId, changes, repeat }) }); this.invalidateProfile(); return result }
  async reflectQuest(id: number, requestId: string, reflection: ActivityReflection): Promise<ActivityReflection> { const result = await this.request<ActivityReflection>(`/quests/${id}/reflection`, { method: 'POST', body: JSON.stringify({ request_id: requestId, ...reflection }) }); this.invalidateProfile(); return result }
  adminDirections(): Promise<Direction[]> { return this.directions() }
  adminScenarios(): Promise<AdminScenario[]> { return this.request('/admin/scenarios') }
  adminTasks(scenarioId: number): Promise<AdminTask[]> { return this.request(`/admin/scenarios/${scenarioId}/tasks`) }
  createAdminScenario(input: AdminScenarioInput): Promise<AdminScenario> { return this.request('/admin/scenarios', { method: 'POST', body: JSON.stringify(input) }) }
  updateAdminScenario(id: number, input: AdminScenarioInput): Promise<AdminScenario> { return this.request(`/admin/scenarios/${id}`, { method: 'PUT', body: JSON.stringify(input) }) }
  deleteAdminScenario(id: number): Promise<void> { return this.requestVoid(`/admin/scenarios/${id}`, { method: 'DELETE' }) }
  setAdminScenarioPublication(id: number, isPublished: boolean): Promise<AdminScenario> {
    return this.request(`/admin/scenarios/${id}/${isPublished ? 'publish' : 'unpublish'}`, { method: 'PUT' })
  }
  createAdminTask(scenarioId: number, input: AdminTaskInput): Promise<AdminTask> { return this.request(`/admin/scenarios/${scenarioId}/tasks`, { method: 'POST', body: JSON.stringify(input) }) }
  updateAdminTask(id: number, input: AdminTaskInput): Promise<AdminTask> { return this.request(`/admin/tasks/${id}`, { method: 'PUT', body: JSON.stringify(input) }) }
  deleteAdminTask(id: number): Promise<void> { return this.requestVoid(`/admin/tasks/${id}`, { method: 'DELETE' }) }
  setAdminTaskPublication(id: number, isPublished: boolean): Promise<AdminTask> {
    return this.request(`/admin/tasks/${id}/${isPublished ? 'publish' : 'unpublish'}`, { method: 'PUT' })
  }
}
