import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiClient, ApiError, type Achievement, type AdminScenario, type AdminScenarioInput, type AdminTask, type AdminTaskInput, type AttemptResult, type Direction, type FinalReport, type InterestEvent, type InterestProfile, type Progress, type Recommendation, type Scenario, type ScenarioDetail, type ScenarioState, type Task, type User } from './api'
import { GameCanvas } from './GameCanvas'
import { CampusCanvas } from './CampusCanvas'
import { TaskModal } from './TaskModal'
import { locationFor } from './world'
import './style.css'

const tokenKey = 'tvoyvybor.accessToken'
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
type Route = 'login' | 'register' | 'hub' | 'building' | 'profile' | 'results' | 'admin' | 'game' | 'help'

function currentRoute(): Route {
  const path = window.location.hash.slice(2)
  if (path.startsWith('game/')) return 'game'
  if (path.startsWith('building/')) return 'building'
  return path === 'register' || path === 'hub' || path === 'profile' || path === 'results' || path === 'admin' || path === 'help' ? path : 'login'
}
function navigate(route: Route) { window.location.hash = `/${route}` }
function buildingId() { const value = Number(window.location.hash.slice(11)); return Number.isInteger(value) && value > 0 ? value : null }
function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'Сессия завершилась. Войдите снова.'
  return error instanceof Error ? error.message : 'Не удалось загрузить данные.'
}
const stateLabels: Record<ScenarioState, string> = { locked: 'Закрыт', available: 'Доступен', active: 'Начат', completed: 'Завершён', skipped: 'Пропущен' }

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
        <a href="#/help" aria-current={route === 'help' ? 'page' : undefined}>Помощь</a>
        {user.role === 'admin' && <a href="#/admin" aria-current={route === 'admin' ? 'page' : undefined}>Администрирование</a>}
      </nav>
      <div className="account"><span>{user.email}</span><button type="button" onClick={logout}>Выйти</button></div>
    </header>
    {route === 'profile' ? <ProfileScreen api={api} /> : route === 'results' ? <ResultsScreen api={api} /> : route === 'help' ? <HelpScreen /> : route === 'admin' ? user.role === 'admin' ? <AdminScreen api={api} /> : <main className="content"><section className="panel"><h1>Нет доступа</h1><p>Управление контентом доступно только администраторам.</p></section></main> : <HubScreen api={api} user={user} onOnboardingComplete={setUser} initialBuildingId={route === 'building' ? buildingId() : null} />}
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

export function HubScreen({ api, user, onOnboardingComplete, initialBuildingId = null }: { api: ApiClient, user: User, onOnboardingComplete: (user: User) => void, initialBuildingId?: number | null }) {
  const [data, setData] = useState<Direction[] | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    api.directions().then((directions) => { if (active) setData(directions) }).catch((cause) => { if (active) setError(errorMessage(cause)) })
    return () => { active = false }
  }, [api, revision])
  const knownDirections = data?.filter((direction) => locationFor(direction.slug)) ?? []
  async function completeOnboarding() { onOnboardingComplete(await api.completeOnboarding()) }
  return <main className="game-shell">
    {error ? <LoadState error={error} retry={() => { setError(''); setRevision((value) => value + 1) }} /> : !data ? <p className="game-loading">Загружаем кампус…</p> : data.length === 0 ? <div className="panel"><p>Пока нет опубликованных направлений.</p></div> : <GameShell directions={knownDirections} initialBuildingId={initialBuildingId} />}
    {!user.onboarding_completed && <NarratorPrologue onComplete={completeOnboarding} />}
  </main>
}

function GameShell({ directions, initialBuildingId }: { directions: Direction[], initialBuildingId: number | null }) {
  const [building, setBuilding] = useState<Direction | null>(() => directions.find((item) => item.id === initialBuildingId) ?? null)
  const [dialogue, setDialogue] = useState(false); const [choice, setChoice] = useState<number | null>(null); const [action, setAction] = useState<string | null>(null); const [transition, setTransition] = useState<'idle' | 'closing' | 'loading' | 'opening'>('idle'); const [fullscreen, setFullscreen] = useState(false); const shell = useRef<HTMLDivElement>(null)
  const location = building ? locationFor(building.slug) : undefined
  useEffect(() => { const selected = directions.find((item) => item.id === initialBuildingId) ?? null; if (selected) setBuilding(selected) }, [directions, initialBuildingId])
  useEffect(() => { const sync = () => { setFullscreen(document.fullscreenElement === shell.current); if (!document.fullscreenElement) shell.current?.focus() }; document.addEventListener('fullscreenchange', sync); return () => document.removeEventListener('fullscreenchange', sync) }, [])
  useEffect(() => { const openHelp = (event: KeyboardEvent) => { if (event.key === 'F1') { event.preventDefault(); window.location.hash = '#/help' } }; window.addEventListener('keydown', openHelp); return () => window.removeEventListener('keydown', openHelp) }, [])
  const changePlace = useCallback((next: Direction | null) => {
    if (transition !== 'idle') return
    setDialogue(false); setChoice(null); setTransition('closing')
    window.setTimeout(() => { setBuilding(next); window.location.hash = next ? `#/building/${next.id}` : '#/hub'; setTransition('loading') }, 280)
    window.setTimeout(() => setTransition('opening'), 5300); window.setTimeout(() => setTransition('idle'), 5620)
  }, [transition])
  async function toggleFullscreen() { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.current?.requestFullscreen() }
  const reaction = choice === null ? undefined : location?.choices[choice]?.reaction
  return <section className="play-area" ref={shell} tabIndex={-1} aria-label="Игровая область">
    <div className="world-controls"><button type="button" onClick={() => { window.location.hash = '#/help' }}>Помощь · F1</button><button type="button" onClick={() => void toggleFullscreen()}>{fullscreen ? 'Свернуть' : 'На весь экран'}</button></div>
    {building && location ? <GameCanvas directionSlug={building.slug} blocked={dialogue || transition !== 'idle'} onActionChange={setAction} onInteract={() => setDialogue(true)} onExit={() => changePlace(null)} /> : <CampusCanvas directions={directions} blocked={transition !== 'idle'} onActionChange={setAction} onEnter={(direction) => changePlace(direction)} />}
    {action && !dialogue && <div className="action-prompt"><kbd>E</kbd><span>{action}</span></div>}
    {dialogue && location && <>{choice === null && <div className="dialogue-choices"><strong>Выберите ответ</strong>{location.choices.map((item, index) => <button key={item.text} type="button" onClick={() => setChoice(index)}>{item.text}</button>)}</div>}{choice !== null && <div className="dialogue-overlay player-line"><img src="/content/characters/player/player_robot_front.png" alt="Стажёр Ноль" /><div className="dialogue-copy"><strong>Стажёр Ноль</strong><p>{location.choices[choice].text}</p></div></div>}<div className={`dialogue-overlay ${choice !== null ? 'npc-reaction' : ''}`} role="dialog" aria-modal="true" aria-label={location.name}><img src={choice === null ? location.portrait : `/content/characters/npcs/emotions/${location.slug}/${location.choices[choice].emotion}.png`} alt={`Портрет ${location.name}`} /><div className="dialogue-copy"><strong>{location.name}</strong><p>{reaction ?? location.greeting}</p>{choice !== null && <button type="button" className="primary" onClick={() => { setChoice(null) }}>Выбрать другую тему</button>}<button type="button" onClick={() => { setDialogue(false); setChoice(null); shell.current?.focus() }}>Завершить разговор</button></div></div></>}
    <div className={`iris-transition iris-${transition}`} aria-hidden="true" />
    {transition === 'loading' && <div className="loading-card" role="status">Новая локация готовится… <small>Совет: хороший лог часто честнее воспоминаний о том, «как всё работало вчера».</small></div>}
  </section>
}

function HelpScreen() { return <main className="content"><section className="panel"><h1>Помощь</h1><p>Это прогулка по IT-кампусу: разговаривайте с мастерами и выбирайте темы без правильных ответов или оценок.</p><ul className="event-list"><li><strong>WASD / стрелки</strong><p>Движение по доступным дорожкам.</p></li><li><strong>E</strong><p>Войти в корпус, поговорить с мастером или выйти в хаб.</p></li><li><strong>Fullscreen</strong><p>Кнопка «На весь экран» разворачивает игровое окно; выход — Esc.</p></li><li><strong>F1</strong><p>Открывает эту справку из игры.</p></li></ul></section></main> }

function NarratorPrologue({ onComplete }: { onComplete: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function finish() { setBusy(true); setError(''); try { await onComplete() } catch (cause) { setError(errorMessage(cause)); setBusy(false) } }
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Пролог Дяди Дебага"><section className="panel narrator-prologue"><img src="/content/characters/npcs/npc_narrator_portrait.png" alt="Дядя Дебаг" /><div><span className="eyebrow">Дядя Дебаг</span><h2>Добро пожаловать в кампус</h2><p>Здесь можно пробовать разные IT-направления без единственно правильного маршрута. Подходите к корпусам, говорите с мастерами и выбирайте сценарии.</p>{error && <p className="error" role="alert">{error}</p>}<div className="admin-actions"><button className="primary" type="button" disabled={busy} onClick={finish}>Продолжить</button><button type="button" disabled={busy} onClick={finish}>Пропустить</button></div></div></section></div>
}

export function BuildingScreen({ api, directionId }: { api: ApiClient, directionId: number }) {
  const [data, setData] = useState<{ direction: Direction, scenarios: Scenario[], progress: Progress[] } | null>(null)
  const [dialogue, setDialogue] = useState(false); const [error, setError] = useState('')
  useEffect(() => { let active = true; Promise.all([api.directions(), api.scenarios(), api.progress()]).then(([directions, scenarios, progress]) => { const direction = directions.find((item) => item.id === directionId); if (!direction) throw new Error('Направление не найдено.'); if (active) setData({ direction, scenarios, progress }) }).catch((cause) => { if (active) setError(errorMessage(cause)) }); return () => { active = false } }, [api, directionId])
  if (error) return <main className="content"><LoadState error={error} retry={() => window.location.hash = '#/hub'} /></main>
  if (!data) return <main className="content"><p>Открываем корпус…</p></main>
  const location = locationFor(data.direction.slug)
  return <main className="content game-page"><GameCanvas directionSlug={data.direction.slug} onInteract={() => setDialogue(true)} onExit={() => { window.location.hash = '#/hub' }} /><section className="panel game-instructions"><button type="button" onClick={() => setDialogue(true)}>Поговорить с мастером</button></section>{dialogue && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Мастер ${data.direction.title}`}><section className="panel direction-dialogue"><img src={location?.portrait} alt="Портрет мастера" /><div><span className="eyebrow">Мастер {data.direction.title}</span><p>{location?.greeting}</p><button type="button" onClick={() => setDialogue(false)}>Закрыть</button></div></section></div>}</main>
}

export function GameScreen({ api, scenarioId, Game = GameCanvas }: { api: ApiClient, scenarioId: number, Game?: typeof GameCanvas }) {
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState<AttemptResult | null>(null)
  const [revision, setRevision] = useState(0)
  const [directionSlug, setDirectionSlug] = useState<string | undefined>()

  useEffect(() => {
    let active = true
    setScenario(null); setError(''); setFeedback(null)
    Promise.all([api.scenario(scenarioId), api.directions()]).then(async ([detail, directions]) => {
      if (detail.state === 'available') await api.startScenario(scenarioId)
      if (active) {
        setScenario(detail)
        setDirectionSlug(directions.find((direction) => direction.id === detail.direction_id)?.slug)
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
    <Game directionSlug={directionSlug ?? 'backend'} onInteract={openTask} onExit={() => { window.location.hash = '#/hub' }} />
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
  const [data, setData] = useState<{ report: FinalReport, recommendation: Recommendation | null, achievements: Achievement[], scenarios: Scenario[] } | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    Promise.all([api.finalReport(), api.recommendation(), api.achievements(), api.scenarios()]).then(([report, recommendation, achievements, scenarios]) => {
      if (active) setData({ report, recommendation, achievements, scenarios })
    }).catch((cause) => { if (active) setError(errorMessage(cause)) })
    return () => { active = false }
  }, [api, revision])
  return <main className="content">
    <div className="page-heading"><span className="eyebrow">Отчёт отдела кадров, который никто не просил</span><h1>Результаты</h1><p>Это не психологическая диагностика, а объяснимое наблюдение за действиями в игре.</p></div>
    {error ? <LoadState error={error} retry={() => { setError(''); setRevision((value) => value + 1) }} /> : !data ? <p>Загружаем результаты…</p> : <>
      <section className="panel"><h2>Что мы увидели в игре</h2><p>Зафиксировано наблюдений: {data.report.event_count}. Завершено заданий: {data.report.completed_task_count}.</p>{data.report.observations.length === 0 ? <p>Пока недостаточно игровых фактов для выводов.</p> : <ul className="event-list">{data.report.observations.map((item) => <li key={item}>{item}</li>)}</ul>}</section>
      <section className="panel"><h2>Направления для дальнейшего изучения</h2>{data.report.directions.length === 0 ? <p>Пройдите несколько заданий, чтобы появились первые ориентиры.</p> : <ul className="event-list">{data.report.directions.map((item) => <li key={item.direction_id}><strong>{item.title}</strong><p>{item.reason} Учтённый сигнал: {item.score}.</p></li>)}</ul>}{data.report.next_steps.length > 0 && <><h3>Что попробовать дальше</h3><ul className="event-list">{data.report.next_steps.map((item) => <li key={item}>{item}</li>)}</ul></>}</section>
      <section className="panel"><h2>Текущая рекомендация</h2>{data.recommendation ? <p>{data.recommendation.explanation}</p> : <p>Данных пока недостаточно. Рекомендация появится после первых верных решений.</p>}</section>
      <section className="panel"><h2>Пройденные сценарии</h2><p>{data.scenarios.filter((item) => item.state === 'completed').length} из {data.scenarios.length}</p></section>
      <section className="panel"><h2>Достижения</h2>{data.achievements.length === 0 ? <p>Пока нет достижений.</p> : <ul className="event-list">{data.achievements.map((item) => <li key={item.slug}><strong>{item.title}</strong><p>{item.description}</p></li>)}</ul>}</section>
    </>}
  </main>
}

function parseObject(value: string, label: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(`${label} должен быть JSON-объектом.`)
  return parsed as Record<string, unknown>
}

function AdminScreen({ api }: { api: ApiClient }) {
  const [data, setData] = useState<{ directions: Direction[], scenarios: AdminScenario[] } | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [tasks, setTasks] = useState<AdminTask[]>([])
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [scenarioForm, setScenarioForm] = useState<AdminScenarioInput>({ direction_id: 0, slug: '', title: '', description: '' })
  const [editingScenario, setEditingScenario] = useState<number | null>(null)
  const [taskForm, setTaskForm] = useState({ title: '', content: '{\n  "prompt": "",\n  "options": []\n}', validation: '{\n  "correct": ""\n}', correct_explanation: '', incorrect_explanation: '' })
  const [editingTask, setEditingTask] = useState<number | null>(null)
  useEffect(() => {
    let active = true
    Promise.all([api.adminDirections(), api.adminScenarios()]).then(([directions, scenarios]) => {
      if (active) { setData({ directions, scenarios }); setScenarioForm((current) => ({ ...current, direction_id: current.direction_id || directions[0]?.id || 0 })) }
    }).catch((cause) => { if (active) setError(errorMessage(cause)) })
    return () => { active = false }
  }, [api, revision])
  useEffect(() => {
    if (selected === null) { setTasks([]); return }
    api.adminTasks(selected).then(setTasks).catch((cause) => setError(errorMessage(cause)))
  }, [api, selected, revision])
  const reload = () => setRevision((value) => value + 1)
  async function createScenario(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    try { if (editingScenario === null) await api.createAdminScenario(scenarioForm); else await api.updateAdminScenario(editingScenario, scenarioForm); setEditingScenario(null); setScenarioForm((current) => ({ ...current, slug: '', title: '', description: '' })); reload() } catch (cause) { setError(errorMessage(cause)) }
  }
  async function createTask(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); if (selected === null) return; setError('')
    try {
      const input: AdminTaskInput = { kind: 'choice', title: taskForm.title, content: parseObject(taskForm.content, 'Контент'), validation_config: parseObject(taskForm.validation, 'Конфигурация проверки'), correct_explanation: taskForm.correct_explanation, incorrect_explanation: taskForm.incorrect_explanation }
      if (editingTask === null) await api.createAdminTask(selected, input); else await api.updateAdminTask(editingTask, input); setEditingTask(null); setTaskForm((current) => ({ ...current, title: '', correct_explanation: '', incorrect_explanation: '' })); reload()
    } catch (cause) { setError(errorMessage(cause)) }
  }
  if (error && !data) return <main className="content"><LoadState error={error} retry={() => { setError(''); reload() }} /></main>
  return <main className="content admin-page">
    <div className="page-heading"><span className="eyebrow">Контент</span><h1>Администрирование</h1><p>Управляйте сценариями и заданиями существующего типа choice. Права проверяет сервер.</p></div>
    {error && <p className="error" role="alert">{error}</p>}
    {!data ? <p>Загружаем контент…</p> : <>
      <section className="panel"><h2>{editingScenario === null ? 'Новый сценарий' : 'Редактирование сценария'}</h2><form className="admin-form" onSubmit={createScenario}>
        <label>Направление<select required value={scenarioForm.direction_id} onChange={(event) => setScenarioForm({ ...scenarioForm, direction_id: Number(event.target.value) })}>{data.directions.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
        <label>Slug<input required value={scenarioForm.slug} onChange={(event) => setScenarioForm({ ...scenarioForm, slug: event.target.value })} /></label>
        <label>Название<input required value={scenarioForm.title} onChange={(event) => setScenarioForm({ ...scenarioForm, title: event.target.value })} /></label>
        <label>Описание<textarea required value={scenarioForm.description} onChange={(event) => setScenarioForm({ ...scenarioForm, description: event.target.value })} /></label>
        <button className="primary" type="submit" disabled={!scenarioForm.direction_id}>{editingScenario === null ? 'Создать сценарий' : 'Сохранить сценарий'}</button>
      </form></section>
      <section className="panel"><h2>Сценарии</h2><ul className="event-list admin-list">{data.scenarios.map((item) => <li key={item.id}>
        <strong>{item.title}</strong><p>{item.description}</p><div className="admin-actions">
          <button type="button" onClick={() => setSelected(item.id)}>Задания</button>
          <button type="button" onClick={() => { setEditingScenario(item.id); setScenarioForm({ direction_id: item.direction_id, slug: item.slug, title: item.title, description: item.description }) }}>Изменить</button>
          <button type="button" onClick={async () => { try { await api.setAdminScenarioPublication(item.id, !item.is_published); reload() } catch (cause) { setError(errorMessage(cause)) } }}>{item.is_published ? 'Снять с публикации' : 'Опубликовать'}</button>
          <button type="button" onClick={async () => { try { await api.deleteAdminScenario(item.id); if (selected === item.id) setSelected(null); reload() } catch (cause) { setError(errorMessage(cause)) } }}>Удалить</button>
        </div>
      </li>)}</ul></section>
      {selected !== null && <section className="panel"><h2>Задания сценария</h2><form className="admin-form" onSubmit={createTask}>
        <label>Название<input required value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} /></label>
        <label>Контент JSON<textarea required value={taskForm.content} onChange={(event) => setTaskForm({ ...taskForm, content: event.target.value })} /></label>
        <label>Проверка JSON<textarea required value={taskForm.validation} onChange={(event) => setTaskForm({ ...taskForm, validation: event.target.value })} /></label>
        <label>Объяснение верного ответа<textarea required value={taskForm.correct_explanation} onChange={(event) => setTaskForm({ ...taskForm, correct_explanation: event.target.value })} /></label>
        <label>Объяснение неверного ответа<textarea required value={taskForm.incorrect_explanation} onChange={(event) => setTaskForm({ ...taskForm, incorrect_explanation: event.target.value })} /></label>
        <button className="primary" type="submit">{editingTask === null ? 'Добавить choice-задание' : 'Сохранить задание'}</button>
      </form><ul className="event-list admin-list">{tasks.map((item) => <li key={item.id}>
        <strong>{item.title}</strong><p>{item.is_published ? 'Опубликовано' : 'Черновик'}</p><div className="admin-actions">
          <button type="button" onClick={() => { setEditingTask(item.id); setTaskForm({ title: item.title, content: JSON.stringify(item.content, null, 2), validation: JSON.stringify(item.validation_config, null, 2), correct_explanation: item.correct_explanation, incorrect_explanation: item.incorrect_explanation }) }}>Изменить</button>
          <button type="button" onClick={async () => { try { await api.setAdminTaskPublication(item.id, !item.is_published); reload() } catch (cause) { setError(errorMessage(cause)) } }}>{item.is_published ? 'Снять с публикации' : 'Опубликовать'}</button>
          <button type="button" onClick={async () => { try { await api.deleteAdminTask(item.id); reload() } catch (cause) { setError(errorMessage(cause)) } }}>Удалить</button>
        </div>
      </li>)}</ul></section>}
    </>}
  </main>
}

export default App
