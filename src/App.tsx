import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiClient, ApiError, type Achievement, type AttemptResult, type Direction, type InterestEvent, type InterestProfile, type Progress, type Recommendation, type Scenario, type ScenarioDetail, type ScenarioState, type Task, type User } from './api'
import { GameCanvas } from './GameCanvas'
import { TaskModal } from './TaskModal'
import './style.css'

const tokenKey = 'tvoyvybor.accessToken'
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
type Route = 'login' | 'register' | 'hub' | 'profile' | 'results' | 'game'

function currentRoute(): Route {
  const path = window.location.hash.slice(2)
  if (path.startsWith('game/')) return 'game'
  return path === 'register' || path === 'hub' || path === 'profile' || path === 'results' ? path : 'login'
}
function navigate(route: Route) { window.location.hash = `/${route}` }
function gameScenarioId() { const value = Number(window.location.hash.slice(7)); return Number.isInteger(value) && value > 0 ? value : null }
function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'Сессия завершилась. Войдите снова.'
  return error instanceof Error ? error.message : 'Не удалось загрузить данные.'
}
const stateLabels: Record<ScenarioState, string> = {
  locked: 'Закрыт', available: 'Доступен', active: 'Начат', completed: 'Завершён', skipped: 'Пропущен',
}

function App() {
  const [route, setRoute] = useState(currentRoute)
  const [user, setUser] = useState<User | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [sessionRevision, setSessionRevision] = useState(0)
  const api = useMemo(() => new ApiClient(apiBaseUrl, () => localStorage.getItem(tokenKey), () => {
    localStorage.removeItem(tokenKey)
    setUser(null)
    navigate('login')
  }), [])

  useEffect(() => {
    const updateRoute = () => setRoute(currentRoute())
    window.addEventListener('hashchange', updateRoute)
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])
  useEffect(() => {
    let active = true
    if (!localStorage.getItem(tokenKey)) { setCheckingSession(false); return }
    api.me().then((profile) => {
      if (active) {
        setUser(profile)
        if (currentRoute() === 'login' || currentRoute() === 'register') navigate('hub')
      }
    }).catch((error) => {
      if (active && !(error instanceof ApiError && error.status === 401)) setSessionError(errorMessage(error))
    }).finally(() => { if (active) setCheckingSession(false) })
    return () => { active = false }
  }, [api, sessionRevision])

  async function authenticate(email: string, password: string, register: boolean) {
    if (register) await api.register(email, password)
    const token = await api.login(email, password)
    localStorage.setItem(tokenKey, token.access_token)
    try {
      setUser(await api.me())
      navigate('hub')
    } catch (error) {
      localStorage.removeItem(tokenKey)
      throw error
    }
  }
  function logout() {
    localStorage.removeItem(tokenKey)
    setUser(null)
    navigate('login')
  }

  if (checkingSession) return <main className="centered"><p>Проверяем сессию…</p></main>
  if (sessionError) return <main className="centered"><LoadState error={sessionError} retry={() => { setSessionError(''); setCheckingSession(true); setSessionRevision((value) => value + 1) }} /></main>
  if (!user) return <AuthScreen register={route === 'register'} onSubmit={authenticate} />
  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="#/hub">ТвойВыбор.exe</a>
      <nav aria-label="Основная навигация">
        <a href="#/hub" aria-current={route === 'hub' ? 'page' : undefined}>Хаб</a>
        <a href="#/profile" aria-current={route === 'profile' ? 'page' : undefined}>Профиль</a>
        <a href="#/results" aria-current={route === 'results' ? 'page' : undefined}>Результаты</a>
      </nav>
      <div className="account"><span>{user.email}</span><button type="button" onClick={logout}>Выйти</button></div>
    </header>
    {route === 'profile' ? <ProfileScreen api={api} /> : route === 'results' ? <ResultsScreen api={api} /> : route === 'game' && gameScenarioId() ? <GameScreen api={api} scenarioId={gameScenarioId()!} /> : <HubScreen api={api} />}
  </div>
}

function AuthScreen({ register, onSubmit }: { register: boolean, onSubmit: (email: string, password: string, register: boolean) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true)
    try { await onSubmit(email, password, register) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  return <main className="auth-layout">
    <div className="auth-intro"><span className="eyebrow">Профориентационная игра</span><h1>ТвойВыбор.exe</h1><p>Исследуйте IT-направления и наблюдайте, как ваши решения формируют профиль интересов.</p></div>
    <form className="panel auth-form" onSubmit={submit}>
      <h2>{register ? 'Создать аккаунт' : 'Войти в игру'}</h2>
      <label>Электронная почта<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Пароль<input type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" type="submit" disabled={busy}>{busy ? 'Подождите…' : register ? 'Зарегистрироваться' : 'Войти'}</button>
      <p>{register ? 'Уже есть аккаунт?' : 'Нет аккаунта?'} <a href={register ? '#/login' : '#/register'} onClick={() => setError('')}>{register ? 'Войти' : 'Зарегистрироваться'}</a></p>
    </form>
  </main>
}

function LoadState({ error, retry }: { error: string, retry: () => void }) {
  return <div className="panel"><p className="error" role="alert">{error}</p><button type="button" onClick={retry}>Повторить</button></div>
}

function HubScreen({ api }: { api: ApiClient }) {
  const [data, setData] = useState<{ directions: Direction[], scenarios: Scenario[], progress: Progress[] } | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    Promise.all([api.directions(), api.scenarios(), api.progress()]).then(([directions, scenarios, progress]) => {
      if (active) setData({ directions, scenarios, progress })
    }).catch((cause) => { if (active) setError(errorMessage(cause)) })
    return () => { active = false }
  }, [api, revision])
  return <main className="content">
    <div className="page-heading"><span className="eyebrow">Карта направлений</span><h1>Хаб</h1><p>Доступные сценарии и ваш сохранённый прогресс загружаются с сервера.</p></div>
    {error ? <LoadState error={error} retry={() => { setError(''); setRevision((value) => value + 1) }} /> : !data ? <p>Загружаем направления…</p> : data.directions.length === 0 ? <div className="panel"><p>Пока нет опубликованных направлений.</p></div> :
      <div className="direction-grid">{data.directions.map((direction) => {
        const scenarios = data.scenarios.filter((scenario) => scenario.direction_id === direction.id)
        return <section className="panel direction" key={direction.id}>
          <h2>{direction.title}</h2><p>{direction.description}</p>
          {scenarios.length === 0 ? <p className="muted">Сценарии пока недоступны.</p> : <ul className="scenario-list">{scenarios.map((scenario) => {
            const state = data.progress.find((item) => item.scenario_id === scenario.id)?.state ?? scenario.state
            return <li key={scenario.id}><span><strong>{scenario.title}</strong><small>{scenario.description}</small></span><span className="scenario-actions"><span className={`status status-${state}`}>{stateLabels[state]}</span>{state !== 'locked' && <a className="play-link" href={`#/game/${scenario.id}`}>{state === 'completed' ? 'Открыть' : 'Играть'}</a>}</span></li>
          })}</ul>}
        </section>
      })}</div>}
  </main>
}

export function GameScreen({ api, scenarioId, Game = GameCanvas }: { api: ApiClient, scenarioId: number, Game?: typeof GameCanvas }) {
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState<AttemptResult | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setScenario(null); setError(''); setFeedback(null)
    api.scenario(scenarioId).then(async (detail) => {
      if (detail.state === 'available') await api.startScenario(scenarioId)
      if (active) {
        setScenario(detail)
        setCompletedTaskIds(new Set(detail.completed_task_ids))
      }
    }).catch((cause) => { if (active) setError(errorMessage(cause)) })
    return () => { active = false }
  }, [api, scenarioId, revision])

  const openTask = useCallback(() => {
    const playable = scenario?.tasks.find((item) => item.kind === 'choice' && !completedTaskIds.has(item.id))
    if (playable) setTask(playable)
    else if (!scenario?.tasks.some((item) => item.kind === 'choice')) setError('В этом сценарии пока нет поддерживаемого задания.')
  }, [completedTaskIds, scenario])

  function handleResult(result: AttemptResult) {
    setFeedback(result)
    if (result.is_correct) setCompletedTaskIds((current) => new Set(current).add(result.task_id))
  }

  if (error) return <main className="content"><LoadState error={error} retry={() => setRevision((value) => value + 1)} /></main>
  if (!scenario) return <main className="content"><p>Загружаем игровую локацию…</p></main>
  return <main className="content game-page">
    <div className="page-heading"><span className="eyebrow">Игровая локация</span><h1>{scenario.title}</h1><p>{scenario.description}</p><a href="#/hub">Вернуться в хаб</a></div>
    <Game scenarioTitle={scenario.title} onInteract={openTask} />
    <section className="panel game-instructions"><h2>Как пройти задание</h2><p>Подойдите к NPC и нажмите <kbd>E</kbd>. Вопрос откроется в обычном React-интерфейсе, а результат сохранится на сервере.</p>{scenario.tasks.some((item) => item.kind === 'choice' && !completedTaskIds.has(item.id)) ? <button type="button" onClick={openTask}>Открыть задание</button> : <p className="success">Все задания этой локации завершены.</p>}</section>
    {feedback && <section className="panel world-feedback" role="status"><h2>{feedback.is_correct ? 'NPC доволен решением' : 'NPC просит проверить ответ'}</h2><p>{feedback.explanation}</p><p className="muted">Сохранённый статус сценария: {stateLabels[feedback.scenario_state]}.</p></section>}
    {task && <TaskModal api={api} task={task} onResult={handleResult} onClose={() => setTask(null)} />}
  </main>
}

function ProfileScreen({ api }: { api: ApiClient }) {
  const [data, setData] = useState<{ directions: Direction[], profile: InterestProfile, events: InterestEvent[] } | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    Promise.all([api.directions(), api.interestProfile(), api.interestEvents()]).then(([directions, profile, events]) => {
      if (active) setData({ directions, profile, events })
    }).catch((cause) => { if (active) setError(errorMessage(cause)) })
    return () => { active = false }
  }, [api, revision])
  return <main className="content">
    <div className="page-heading"><span className="eyebrow">Ваш путь</span><h1>Профиль интересов</h1><p>Профиль составляется из сохранённых на сервере событий.</p></div>
    {error ? <LoadState error={error} retry={() => { setError(''); setRevision((value) => value + 1) }} /> : !data ? <p>Загружаем профиль…</p> : <>
      <section className="panel"><h2>Направления</h2>{Object.keys(data.profile.direction_scores).length === 0 ? <p>Ответьте на задания, чтобы увидеть первые наблюдения.</p> : <ul className="score-list">{Object.entries(data.profile.direction_scores).map(([id, score]) => <li key={id}><span>{data.directions.find((item) => item.id === Number(id))?.title ?? `Направление ${id}`}</span><strong>{score}</strong></li>)}</ul>}<p className="muted">Учтено событий: {data.profile.event_count}</p></section>
      <section className="panel"><h2>История наблюдений</h2>{data.events.length === 0 ? <p>Событий пока нет.</p> : <ul className="event-list">{data.events.map((event, index) => <li key={`${event.task_id}-${index}`}><strong>{data.directions.find((item) => item.id === event.direction_id)?.title ?? `Направление ${event.direction_id}`}</strong><p>{event.explanation}</p></li>)}</ul>}</section>
    </>}
  </main>
}

function ResultsScreen({ api }: { api: ApiClient }) {
  const [data, setData] = useState<{ directions: Direction[], recommendation: Recommendation | null, achievements: Achievement[], scenarios: Scenario[] } | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    Promise.all([api.directions(), api.recommendation(), api.achievements(), api.scenarios()]).then(([directions, recommendation, achievements, scenarios]) => {
      if (active) setData({ directions, recommendation, achievements, scenarios })
    }).catch((cause) => { if (active) setError(errorMessage(cause)) })
    return () => { active = false }
  }, [api, revision])
  return <main className="content">
    <div className="page-heading"><span className="eyebrow">Промежуточный итог</span><h1>Результаты</h1><p>Рекомендация основана на ваших действиях и будет меняться по мере прохождения.</p></div>
    {error ? <LoadState error={error} retry={() => { setError(''); setRevision((value) => value + 1) }} /> : !data ? <p>Загружаем результаты…</p> : <>
      <section className="panel"><h2>Рекомендация</h2>{data.recommendation ? <><h3>{data.directions.find((item) => item.id === data.recommendation?.direction_id)?.title ?? 'Направление'}</h3><p>{data.recommendation.explanation}</p></> : <p>Данных пока недостаточно. Рекомендация появится после первых верных решений.</p>}</section>
      <section className="panel"><h2>Пройденные сценарии</h2><p>{data.scenarios.filter((item) => item.state === 'completed').length} из {data.scenarios.length}</p></section>
      <section className="panel"><h2>Достижения</h2>{data.achievements.length === 0 ? <p>Пока нет достижений.</p> : <ul className="event-list">{data.achievements.map((item) => <li key={item.slug}><strong>{item.title}</strong><p>{item.description}</p></li>)}</ul>}</section>
    </>}
  </main>
}

export default App
