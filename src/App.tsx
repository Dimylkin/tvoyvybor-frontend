import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiClient, ApiError, type Achievement, type AdminScenario, type AdminScenarioInput, type AdminTask, type AdminTaskInput, type Direction, type FinalReport, type InterestEvent, type InterestProfile, type Quest, type Recommendation, type Scenario, type User } from './api'
import { GameCanvas } from './GameCanvas'
import { CampusCanvas } from './CampusCanvas'
import { WorldControls } from './WorldControls'
import { Dialogue } from './Dialogue'
export { Dialogue } from './Dialogue'
import { returnPosition, type CampusEntry, type CampusPosition } from './campusReturn'
import { CampusPhone } from './campusos/CampusPhone'
import { QuestConversation, QuestInteraction } from './campusos/QuestInteraction'
import { locationFor, mainBuilding } from './world'
import './style.css'

const tokenKey = 'tvoyvybor.accessToken'
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
type Route = 'login' | 'register' | 'hub' | 'building' | 'profile' | 'results' | 'admin' | 'help'

function currentRoute(): Route {
  const path = window.location.hash.slice(2)
  if (path.startsWith('game/')) return 'hub'
  if (path.startsWith('building/')) return 'building'
  return path === 'register' || path === 'hub' || path === 'profile' || path === 'results' || path === 'admin' || path === 'help' ? path : 'login'
}
function navigate(route: Route) { window.location.hash = `/${route}` }
function buildingId() { const id = window.location.hash.slice(11); if (id === 'main') return 'main' as const; const value = Number(id); return Number.isInteger(value) && value > 0 ? value : null }
function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'Сессия завершилась. Войдите снова.'
  return error instanceof Error ? error.message : 'Не удалось загрузить данные.'
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
    <header className="site-header" hidden={route !== 'admin'}>
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
    <div hidden={route !== 'hub' && route !== 'building'}><HubScreen api={api} user={user} onOnboardingComplete={setUser} initialBuildingId={route === 'building' ? buildingId() : null} active={route === 'hub' || route === 'building'} logout={logout} /></div>
    {route === 'profile' ? <ProfileScreen api={api} /> : route === 'results' ? <ResultsScreen api={api} /> : route === 'help' ? <HelpScreen /> : route === 'admin' ? user.role === 'admin' ? <AdminScreen api={api} /> : <main className="content"><section className="panel"><h1>Нет доступа</h1><p>Управление контентом доступно только администраторам.</p></section></main> : null}
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
    catch (cause) { setError(cause instanceof ApiError && cause.status === 401 ? 'Неверный адрес электронной почты или пароль.' : errorMessage(cause)) }
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

export function HubScreen({ api, user, onOnboardingComplete, initialBuildingId = null, active = true, logout = () => {} }: { api: ApiClient, user: User, onOnboardingComplete: (user: User) => void, initialBuildingId?: number | 'main' | null, active?: boolean, logout?: () => void }) {
  const [data, setData] = useState<Direction[] | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    api.directions().then((directions) => { if (active) setData(directions) }).catch((cause) => { if (active) setError(errorMessage(cause)) })
    return () => { active = false }
  }, [api, revision])
  const knownDirections = useMemo(() => data?.filter((direction) => locationFor(direction.slug)) ?? [], [data])
  return <main className="game-shell">
    {error ? <LoadState error={error} retry={() => { setError(''); setRevision((value) => value + 1) }} /> : !data ? <p className="game-loading">Загружаем кампус…</p> : <GameShell api={api} user={user} onOnboardingComplete={onOnboardingComplete} logout={logout} directions={knownDirections} initialBuildingId={initialBuildingId} firstVisit={!user.intro_completed} active={active} />}
  </main>
}

function GameShell({ api, user, onOnboardingComplete, logout, directions, initialBuildingId, firstVisit, active }: { api: ApiClient, user: User, onOnboardingComplete: (user: User) => void, logout: () => void, directions: Direction[], initialBuildingId: number | 'main' | null, firstVisit: boolean, active: boolean }) {
  const [phone, setPhone] = useState(false)
  const [workQuestId, setWorkQuestId] = useState<number | null>(null)
  const [interaction, setInteraction] = useState<'npc' | 'server' | 'terminal' | null>(null)
  const [quests, setQuests] = useState<Quest[]>([])
  const [story, setStory] = useState<{ final_quest_unlocked: boolean, final_quest_completed: boolean } | null>(null)
  const [sceneReady, setSceneReady] = useState(false); const [minimumElapsed, setMinimumElapsed] = useState(false)
  const [awards, setAwards] = useState<Achievement[]>([])
  const showAwards = useCallback((items: Achievement[]) => { if (items.length) setAwards(items) }, [])
  useEffect(() => { if (!awards.length) return; const timer = window.setTimeout(() => setAwards([]), 4500); return () => window.clearTimeout(timer) }, [awards])
  const [questError, setQuestError] = useState('')
  const [questsLoading, setQuestsLoading] = useState(true)
  const reloadQuests = useCallback(async () => { setQuestsLoading(true); try { const [updatedQuests, updatedStory] = await Promise.all([api.quests(), api.gameState()]); setQuests(updatedQuests); setStory(updatedStory); setQuestError('') } catch (e) { setQuestError(errorMessage(e)); throw e } finally { setQuestsLoading(false) } }, [api])
  useEffect(() => { void reloadQuests().catch(() => {}) }, [reloadQuests])
  const savedPosition = useMemo(() => {
    try { const raw = localStorage.getItem(`player_position_${user.id}`); const value = raw ? JSON.parse(raw) : null; const validScene = value?.scene === 'campus' ? value.x >= 0 && value.x <= 800 && value.y >= 0 && value.y <= 600 : ['narrator', 'backend', 'frontend', 'analytics'].includes(value?.scene) && value.x >= 0 && value.x <= 800 && value.y >= 0 && value.y <= 450; return value && validScene && Number.isFinite(value.x) && Number.isFinite(value.y) ? value as { scene: string, x: number, y: number } : null } catch { return null }
  }, [user.id])
  const savedBuilding = savedPosition && savedPosition.scene !== 'campus' ? savedPosition.scene === 'narrator' ? mainBuilding : directions.find(d => d.slug === savedPosition.scene) ?? null : null
  const [building, setBuilding] = useState<Direction | null>(() => firstVisit ? mainBuilding : savedBuilding ?? (initialBuildingId === 'main' ? mainBuilding : directions.find((item) => item.id === initialBuildingId) ?? null))
  const initialRouteProcessed = useRef(false)
  const lastRouteBuilding = useRef(initialBuildingId)
  const [dialogue, setDialogue] = useState(false); const [action, setAction] = useState<string | null>(null); const [transition, setTransition] = useState<'idle' | 'closing' | 'loading' | 'opening'>('idle'); const [fullscreen, setFullscreen] = useState(false); const shell = useRef<HTMLDivElement>(null)
  useEffect(() => { const handle = (event: KeyboardEvent) => { if (!active || dialogue || interaction) return; if (event.key === 'Tab' && !phone && !event.repeat) { event.preventDefault(); setPhone(true) } else if (event.key === 'Escape' && phone) { event.preventDefault(); setPhone(false) } }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle) }, [active, phone, interaction, dialogue])
  const actionTrigger = useRef<() => void>(() => {})
  const actionButton = useRef<HTMLButtonElement>(null)
  const campusEntry = useRef<CampusEntry | null>(null)
  const campusPosition = useRef<CampusPosition>({ x: 400, y: 330 })
  const updateCampusPosition = useCallback((position: CampusPosition) => { campusPosition.current = position }, [])
  const [campusSpawn, setCampusSpawn] = useState<CampusPosition | undefined>(() => !firstVisit && savedPosition?.scene === 'campus' ? { x: savedPosition.x, y: savedPosition.y } : undefined)
  const [buildingSpawn, setBuildingSpawn] = useState<{ x: number, y: number } | undefined>(() => firstVisit ? { x: 370, y: 250 } : savedPosition && savedPosition.scene !== 'campus' ? { x: savedPosition.x, y: savedPosition.y } : undefined)
  const [mentorStep, setMentorStep] = useState<number | null>(null)
  const lastPositionWrite = useRef(0)
  const savePosition = useCallback((scene: string, position: { x: number, y: number }, force = false) => {
    if (!force && Date.now() - lastPositionWrite.current < 1500) return
    try { localStorage.setItem(`player_position_${user.id}`, JSON.stringify({ scene, x: position.x, y: position.y })); lastPositionWrite.current = Date.now() } catch { /* storage can be disabled */ }
  }, [user.id])
  const playerPosition = useRef<{ x: number, y: number }>(buildingSpawn ?? campusSpawn ?? { x: 370, y: 250 })
  const activeScene = useRef(building?.slug ?? 'campus')
  activeScene.current = building?.slug ?? 'campus'
  const saveAndLogout = useCallback(() => { savePosition(activeScene.current, playerPosition.current, true); logout() }, [logout, savePosition])
  useEffect(() => {
    const persist = () => savePosition(activeScene.current, playerPosition.current, true)
    window.addEventListener('pagehide', persist)
    document.addEventListener('visibilitychange', persist)
    return () => { window.removeEventListener('pagehide', persist); document.removeEventListener('visibilitychange', persist) }
  }, [savePosition])
  useEffect(() => { if (active && firstVisit && building?.slug === 'narrator' && sceneReady && transition === 'idle') setMentorStep(0) }, [active, firstVisit, building?.slug, sceneReady, transition])
  const workQuests = quests.filter(q => q.location_slug === building?.slug && q.status === 'active' && q.gameplay)
  const workQuest = workQuests.find(q => q.id === workQuestId) ?? workQuests.find(q => q.tracked) ?? workQuests[0]
  const location = building ? locationFor(building.slug) : undefined
  useEffect(() => {
    if (transition !== 'loading') return
    const timer = window.setTimeout(() => setMinimumElapsed(true), 2400)
    return () => window.clearTimeout(timer)
  }, [transition])
  useEffect(() => {
    if (transition !== 'loading' || !sceneReady || !minimumElapsed) return
    setTransition('opening')
  }, [transition, sceneReady, minimumElapsed])
  useEffect(() => {
    if (transition !== 'opening') return
    const timer = window.setTimeout(() => setTransition('idle'), 320)
    return () => window.clearTimeout(timer)
  }, [transition])
  useEffect(() => {
    if (!initialRouteProcessed.current) {
      initialRouteProcessed.current = true
      if (firstVisit) setBuilding(mainBuilding)
      else if (savedBuilding) setBuilding(savedBuilding)
      else if (initialBuildingId !== null) setBuilding(initialBuildingId === 'main' ? mainBuilding : directions.find((item) => item.id === initialBuildingId) ?? mainBuilding)
      else setBuilding(null)
      return
    }
    if (lastRouteBuilding.current !== initialBuildingId) {
      lastRouteBuilding.current = initialBuildingId
      const selected = initialBuildingId === 'main' ? mainBuilding : directions.find((item) => item.id === initialBuildingId)
      setBuilding(initialBuildingId === null ? null : selected ?? mainBuilding)
      return
    }
    if (savedBuilding) setBuilding(savedBuilding)
  }, [directions, initialBuildingId, firstVisit, savedBuilding])
  useEffect(() => { const sync = () => { setFullscreen(document.fullscreenElement === shell.current); if (!document.fullscreenElement) shell.current?.focus() }; document.addEventListener('fullscreenchange', sync); return () => document.removeEventListener('fullscreenchange', sync) }, [])
  const changePlace = useCallback((next: Direction | null) => {
    if (transition !== 'idle') return
    if (!next && building) { const position = returnPosition(building.slug, campusEntry.current); setCampusSpawn(position); if (position) { playerPosition.current = position; savePosition('campus', position, true) } }
    setAction(null); setDialogue(false); setSceneReady(false); setMinimumElapsed(false); setTransition('closing')
    window.setTimeout(() => { setBuilding(next); if (currentRoute() === 'hub' || currentRoute() === 'building') window.location.hash = next ? `#/building/${next.slug === 'narrator' ? 'main' : next.id}` : '#/hub'; setTransition('loading') }, 280)
  }, [transition, building, savePosition])
  useEffect(() => {
    let timer: number | undefined
    const actionElement = actionButton.current
    const handle = (event: KeyboardEvent) => {
      if (timer !== undefined || event.repeat || event.code !== 'KeyE' || !active || dialogue || phone || interaction || transition !== 'idle' || !actionElement) return
      event.preventDefault()
      const button = actionElement
      button.classList.add('key-pressed')
      timer = window.setTimeout(() => { timer = undefined; button.classList.remove('key-pressed'); button.click() }, 120)
    }
    window.addEventListener('keydown', handle)
    return () => { window.removeEventListener('keydown', handle); if (timer !== undefined) window.clearTimeout(timer); actionElement?.classList.remove('key-pressed') }
  }, [active, dialogue, phone, interaction, transition, action])
  async function toggleFullscreen() { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.current?.requestFullscreen() }
  return <section className="play-area" ref={shell} tabIndex={-1} aria-label="Игровая область">
    <WorldControls fullscreen={fullscreen} toggleFullscreen={() => void toggleFullscreen()} openPhone={() => setPhone(true)} isAdmin={user.role === 'admin'} />
    {building && location ? <GameCanvas initialPosition={buildingSpawn} onPositionChange={(position) => { playerPosition.current = position; savePosition(building.slug, position) }} onActionReady={(invoke) => { actionTrigger.current = invoke }} onReady={() => setSceneReady(true)} directionSlug={building.slug} stationSolved={!!workQuest?.gameplay?.state.success} blocked={!active || dialogue || mentorStep !== null || phone || !!interaction || transition !== 'idle'} onActionChange={setAction} onInteract={() => building.slug === 'narrator' || quests.some(q => q.location_slug === building.slug && q.gameplay) ? setInteraction('npc') : setDialogue(true)} onObject={setInteraction} onExit={() => changePlace(null)} /> : <CampusCanvas onPositionChange={(position) => { playerPosition.current = position; updateCampusPosition(position); savePosition('campus', position) }} onActionReady={(invoke) => { actionTrigger.current = invoke }} initialPosition={campusSpawn} onReady={() => setSceneReady(true)} directions={directions} blocked={!active || phone || !!interaction || transition !== 'idle'} onActionChange={setAction} onEnter={(direction, position) => { campusEntry.current = { slug: direction.slug, position }; setBuildingSpawn({ x: 370, y: 250 }); playerPosition.current = { x: 370, y: 250 }; savePosition(direction.slug, playerPosition.current, true); changePlace(direction) }} />}
    {action && !dialogue && !interaction && !phone && <button ref={actionButton} type="button" className="action-prompt" onClick={() => actionTrigger.current()}><kbd>E</kbd><span>{action}</span></button>}
    {questError && <div role="alert" className="quest-error">{questError} <button type="button" onClick={() => void reloadQuests().catch(() => {})}>Повторить</button></div>}
    {phone && <CampusPhone api={api} user={user} quests={quests} loading={questsLoading} loadError={questError} reload={reloadQuests} close={() => { setPhone(false); shell.current?.focus() }} logout={saveAndLogout} position={building && location ? location.campusPortal : campusPosition.current} currentBuilding={building?.slug} finalQuestUnlocked={!!story?.final_quest_unlocked && !story.final_quest_completed} onFinalQuest={() => { setPhone(false); if (building?.slug !== 'narrator') changePlace(mainBuilding); else setInteraction('npc') }} profile={<><ProfileScreen api={api} compact /><ResultsScreen api={api} compact /></>} />}
    {awards.length > 0 && <div className="quest-award-toast" role="status">{awards.map(a => <div key={a.slug}>✦ {a.title}<small>{a.description}</small></div>)}</div>}
    {interaction === 'npc' && location && (location.slug === 'narrator' ? <MentorConversation api={api} location={location} quests={quests} story={story} onStory={setStory} onAwards={showAwards} close={() => setInteraction(null)} /> : <QuestConversation api={api} quests={quests.filter(q => q.location_slug === location.slug && q.gameplay)} location={location} userId={user.id} onAwards={showAwards} reload={reloadQuests} close={() => setInteraction(null)} />)}
    {interaction && interaction !== 'npc' && <QuestInteraction key={`${building?.slug}:${interaction}:${workQuest?.id}`} api={api} quest={workQuest} alternatives={workQuests} selectQuest={setWorkQuestId} target={interaction} userId={user.id} onAwards={showAwards} reload={reloadQuests} close={() => setInteraction(null)} />}
    {dialogue && location && <Dialogue location={location} onClose={() => { setDialogue(false); shell.current?.focus() }} /> }
    {mentorStep !== null && location && <MentorIntro location={location} step={mentorStep} onStep={setMentorStep} onComplete={async () => { const state = await api.completeGameIntro(); onOnboardingComplete({ ...user, intro_completed: true }); setMentorStep(null); setStory(state); savePosition('narrator', playerPosition.current, true) }} />}
    <div className={`iris-transition iris-${transition}`} aria-hidden="true" />
    {transition === 'loading' && <div className="loading-card" role="status">Новая локация готовится… <small>Совет: хороший лог часто честнее воспоминаний о том, «как всё работало вчера».</small><img className="loading-spinner" src="/content/loading-spinner.svg" alt="" /></div>}
  </section>
}


function HelpScreen() { return <main className="content"><section className="panel"><h1>Помощь</h1><p>Это прогулка по IT-кампусу: разговаривайте с мастерами и выбирайте темы без правильных ответов или оценок.</p><ul className="event-list"><li><strong>WASD / стрелки</strong><p>Движение по доступным дорожкам.</p></li><li><strong>E</strong><p>Войти в корпус, поговорить с мастером или выйти в хаб.</p></li><li><strong>Fullscreen</strong><p>Кнопка «На весь экран» разворачивает игровое окно; выход — Esc.</p></li></ul></section></main> }

const mentorIntro = [
  { text: 'Привет. Добро пожаловать. Здесь мы обычно не спрашиваем, кем ты видишь себя через пять лет. У нас даже календарь от таких вопросов закрывается.', emotion: 'friendly' as const, choices: ['Звучит уже неплохо.', 'А что тогда будем делать?'] },
  { text: 'Дадим тебе попробовать настоящие, только немного упрощённые задачи. Не экзамен и не ловушка: если что-то не выйдет, мир не рухнет. Максимум — серверная драматично мигнёт.', emotion: 'thinking' as const, choices: ['А как поймём, что мне подходит?'] },
  { text: 'По тому, что ты делаешь и к чему возвращаешься. Backend — про то, что работает за кулисами; Frontend — про интерфейсы; аналитика — про вопросы к данным. Пока без лекции на сорок слайдов, обещаю.', emotion: 'friendly' as const, choices: ['То есть профессию тест не угадывает?'] },
  { text: 'Именно. Тут не угадывают профессию по тесту. Мы постепенно собираем профиль по твоему опыту и интересу. Можно ошибаться, просить подсказки и менять направление — это не баг, это исследование.', emotion: 'thinking' as const, choices: ['Что делать дальше?'] },
  { text: 'Открой телефон: в «Заданиях» уже лежат варианты. Выбирай то, что меньше всего похоже на мучение. Ну всё, дальше сам — я тут, если понадобится навигация.', emotion: 'friendly' as const, choices: ['Пойду посмотрю.'] },
]

function MentorIntro({ location, step, onStep, onComplete }: { location: NonNullable<ReturnType<typeof locationFor>>, step: number, onStep: (step: number | null) => void, onComplete: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reply, setReply] = useState<string | null>(null)
  const line = mentorIntro[step]
  const finishWithReply = async () => {
    if (step < mentorIntro.length - 1) { setReply(null); onStep(step + 1); return }
    setBusy(true); setError('')
    try { await onComplete() } catch (cause) { setError(errorMessage(cause)); setBusy(false) }
  }
  if (reply !== null) return <Dialogue location={location} onClose={() => {}} scene={{ text: reply, speaker: 'player', busy, error, choices: [], advance: finishWithReply }} />
  return <Dialogue location={location} onClose={() => {}} scene={{ text: line.text, emotion: line.emotion, busy, error, choices: line.choices.map(text => ({ text, select: () => setReply(text) })) }} />
}

function MentorConversation({ api, location, quests, story, onStory, close }: { api: ApiClient, location: NonNullable<ReturnType<typeof locationFor>>, quests: Quest[], story: { final_quest_unlocked: boolean, final_quest_completed: boolean } | null, onStory: (state: { final_quest_unlocked: boolean, final_quest_completed: boolean }) => void, onAwards: (items: Achievement[]) => void, close: () => void }) {
  const [answer, setAnswer] = useState<string | null>(null)
  const [finalStage, setFinalStage] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const topics = [
    ['Что это вообще за место?', 'Кампус-песочница. Тут дают попробовать работу разных IT-команд без собеседования и без вопроса про пять лет.'],
    ['Что мне сейчас делать?', 'Открой телефон. В «Заданиях» всё, что сейчас доступно. Я бы выбрал то, что меньше всего похоже на мучение.'],
    ['Как выбрать направление?', 'Не выбирай навсегда. Возьми задачу, которая зацепила, и посмотри, хочется ли продолжить. Это надёжнее гадания по кофейной гуще.'],
    ['Что такое Backend?', 'Внутренняя кухня: данные, правила и сервисы. Если интерфейс — витрина, backend следит, чтобы за ней не жил один картон.'],
    ['Что такое Frontend?', 'То, с чем человек взаимодействует на экране. Хороший frontend делает сложное понятным и не прячет кнопку в кустах.'],
    ['Чем занимается аналитик?', 'Задаёт данным правильные вопросы и проверяет, не врёт ли красивый график. Графики умеют быть очень убедительными.'],
    ['Где посмотреть задания?', 'В телефоне, приложение «Задания». Я специально не пересказываю список — телефон хотя бы не забывает названия.'],
    ['Как работает мой профиль?', 'Он собирает наблюдения о том, что ты пробовал и как на это реагировал. Подробности — в телефоне, приложение «Профиль».'],
    ['Можно ли ошибаться?', 'Нужно. Ошибка — это наблюдение, иногда просто с очень громким интерфейсом.'],
  ] as const
  const completed = quests.filter(q => q.status === 'completed' && q.gameplay)
  const directions = ['backend', 'frontend', 'analytics'].map(slug => ({ slug, name: ({ backend: 'Backend', frontend: 'Frontend', analytics: 'Analytics' } as Record<string, string>)[slug], items: completed.filter(q => q.location_slug === slug) })).filter(d => d.items.length)
  const highlights = directions.map(d => {
    const more = d.items.filter(q => ['more', 'interesting'].includes(q.gameplay?.state.reaction ?? '')).length
    const support = d.items.reduce((sum, q) => sum + q.gameplay!.state.hints + (q.gameplay!.state.example_used ? 1 : 0), 0)
    const explored = d.items.some(q => q.gameplay!.state.extra_exploration > 0)
    return more > 0 ? `${d.name}: в ${more} ${more === 1 ? 'задаче' : 'задачах'} ты отметил, что было интересно${explored ? ' и продолжил исследовать после решения' : ''}${support ? '; подсказки тоже были частью работы' : ''}.` : `${d.name}: ты попробовал это направление${support ? ' и пользовался подсказками, когда они помогали' : ''}. Даже если не твоё — полезно знать.`
  })
  const recommendation = [...directions].sort((a, b) => b.items.filter(q => ['more', 'interesting'].includes(q.gameplay?.state.reaction ?? '')).length - a.items.filter(q => ['more', 'interesting'].includes(q.gameplay?.state.reaction ?? '')).length)[0]
  if (finalStage && story?.final_quest_unlocked && !story.final_quest_completed) {
    return <Dialogue location={location} onClose={close} scene={{ text: `Ну что, ты прошёл все три направления. ${highlights.join(' ')} ${recommendation && recommendation.items.some(q => ['more', 'interesting'].includes(q.gameplay?.state.reaction ?? '')) ? `Я бы пока присмотрелся к ${recommendation.name}: там у тебя было больше всего любопытства.` : 'Профиль пока не дал достаточно сигналов для уверенного вывода — это тоже честный результат.'} Подробности я оставил в профиле на телефоне. Я могу показать двери. В какую заходить дальше — решать тебе.`, emotion: 'friendly', error, busy, choices: [{ text: 'Завершить разговор', select: () => { setBusy(true); void api.completeFinalQuest().then(state => { onStory(state); close() }).catch(e => { setError(errorMessage(e)); setBusy(false) }) } }] }} />
  }
  if (answer) return <Dialogue location={location} onClose={close} onBack={() => setAnswer(null)} scene={{ text: answer, emotion: 'thinking', choices: [{ text: 'Ещё вопрос', select: () => setAnswer(null) }, ...(story?.final_quest_unlocked && !story.final_quest_completed ? [{ text: 'Подвести итоги путешествия', select: () => setFinalStage(true) }] : []), { text: 'До встречи', select: close }] }} />
  return <Dialogue location={location} onClose={close} scene={{ text: story?.final_quest_unlocked && !story.final_quest_completed ? 'О, ты как раз вовремя. Все обязательные задачи позади. Хочешь подвести итоги?' : 'Ну что, куда сегодня заглянем? Вопросы принимаются, но ответы будут короче моей очереди на кофе.', emotion: 'friendly', canExit: true, choices: [...topics.map(([q, a]) => ({ text: q, select: () => setAnswer(a) })), ...(story?.final_quest_unlocked && !story.final_quest_completed ? [{ text: 'Да, давай подведём итоги', select: () => setFinalStage(true) }] : [])] }} />
}

function ProfileScreen({ api, compact = false }: { api: ApiClient, compact?: boolean }) {
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
    <div className="page-heading"><span className="eyebrow">Ваш путь</span><h1>{compact ? 'Интересы' : 'Профиль интересов'}</h1><p>{compact ? 'История ответов из старых заданий.' : 'Исторические данные получены из старых заданий и не являются оценкой интереса по новым квестам.'}</p></div>
    {error ? <LoadState error={error} retry={() => { setError(''); setRevision((value) => value + 1) }} /> : !data ? <p>Загружаем профиль…</p> : <>
      <section className="panel"><h2>Направления</h2>{Object.keys(data.profile.direction_scores).length === 0 ? <p>{compact ? 'Наблюдений пока нет.' : 'Исторических наблюдений пока нет. Новые квесты не оценивают правильность ответов.'}</p> : <ul className="score-list">{Object.entries(data.profile.direction_scores).map(([id, score]) => <li key={id}><span>{data.directions.find((item) => item.id === Number(id))?.title ?? `Направление ${id}`}</span><strong>{score}</strong></li>)}</ul>}<p className="muted">Учтено событий: {data.profile.event_count}</p></section>
      <section className="panel"><h2>История наблюдений</h2>{data.events.length === 0 ? <p>Событий пока нет.</p> : <ul className="event-list">{data.events.map((event, index) => <li key={`${event.task_id}-${index}`}><strong>{data.directions.find((item) => item.id === event.direction_id)?.title ?? `Направление ${event.direction_id}`}</strong><p>{event.explanation}</p></li>)}</ul>}</section>
    </>}
  </main>
}

function ResultsScreen({ api, compact = false }: { api: ApiClient, compact?: boolean }) {
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
    <div className="page-heading"><span className="eyebrow">{compact ? 'Ваш путь' : 'Отчёт отдела кадров, который никто не просил'}</span><h1>{compact ? 'Отчёт' : 'Результаты'}</h1><p>{compact ? 'История старых заданий; не диагностика.' : 'Отчёт основан на исторических ответах в старых заданиях, а не на новых квестах; это не психологическая диагностика.'}</p></div>
    {error ? <LoadState error={error} retry={() => { setError(''); setRevision((value) => value + 1) }} /> : !data ? <p>Загружаем результаты…</p> : <>
      <section className="panel"><h2>Что мы увидели в игре</h2><p>Зафиксировано наблюдений: {data.report.event_count}. Завершено заданий: {data.report.completed_task_count}.</p>{data.report.observations.length === 0 ? <p>Пока недостаточно игровых фактов для выводов.</p> : <ul className="event-list">{data.report.observations.map((item) => <li key={item}>{item}</li>)}</ul>}</section>
      <section className="panel"><h2>Направления для дальнейшего изучения</h2>{data.report.directions.length === 0 ? <p>Исторических данных пока недостаточно для ориентиров.</p> : <ul className="event-list">{data.report.directions.map((item) => <li key={item.direction_id}><strong>{item.title}</strong><p>{item.reason} Учтённый сигнал: {item.score}.</p></li>)}</ul>}{data.report.next_steps.length > 0 && <><h3>Что попробовать дальше</h3><ul className="event-list">{data.report.next_steps.map((item) => <li key={item}>{item}</li>)}</ul></>}</section>
      <section className="panel"><h2>Текущая рекомендация</h2>{data.recommendation ? <p>{data.recommendation.explanation}</p> : <p>Исторических данных для рекомендации пока нет.</p>}</section>
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
