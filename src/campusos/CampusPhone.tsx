import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react'
import type { ActivityProfile, ApiClient, Quest, User } from '../api'
import { QuestProfile } from './QuestProfile'
import { PhoneIcon } from './PhoneIcon'
import { playerAppearance } from '../playerAppearance'
import { PhoneMap } from './PhoneMap'
import { PhoneHelp } from './PhoneHelp'
import type { CampusPosition } from '../campusReturn'
import './phone.css'
import { locationFor } from '../world'

type AppName = 'home' | 'quests' | 'map' | 'contacts' | 'profile' | 'themes' | 'achievements' | 'help' | 'settings'
type PhoneApp = Exclude<AppName, 'home'>
const locationName = (slug: string) => ({ backend: 'Backend-корпус', frontend: 'Frontend-корпус', analytics: 'Корпус аналитики' }[slug] ?? slug)
const npcName = (id: string) => ({ boris: 'Борис Бэкендович', frontina: 'Фронтина Пиксельевна', anna: 'Анна Литикова' }[id] ?? id)
const categoryName = (category: string) => ({ professional: 'Профессиональное', main: 'Сюжетное', side: 'Дополнительное' }[category] ?? category)
const labels: Record<PhoneApp, string> = { contacts: 'Контакты', profile: 'Профиль', map: 'Карта', achievements: 'Достижения', quests: 'Задачи', help: 'Справка', settings: 'Настройки', themes: 'Темы' }
const themes = [{ id: 'campus', name: 'Campus' }, { id: 'dark', name: 'Dark' }, { id: 'light', name: 'Light' }, { id: 'cyber', name: 'Cyber' }, { id: 'pastel', name: 'Pastel' }] as const
type Theme = typeof themes[number]['id']
const contacts = [
  { slug: 'narrator', role: 'Наставник кампуса', description: 'Дружелюбный проводник, который помогает освоиться и найти свой путь в IT.' },
  { slug: 'backend', role: 'Backend-мастер', description: 'Спокойный разработчик, который ищет причину сбоя в логах и возвращает серверы к жизни.' },
  { slug: 'frontend', role: 'Frontend-мастер', description: 'Внимательна к деталям и превращает сложную логику в понятные интерфейсы.' },
  { slug: 'analytics', role: 'Аналитик', description: 'Любопытна к данным и помогает находить смысл за цифрами и графиками.' },
].flatMap((contact) => { const location = locationFor(contact.slug); return location ? [{ ...contact, name: location.name, portrait: location.portrait }] : [] })

export function CampusPhone({ api, user, quests, loading, loadError, reload, close, logout, profile, position, currentBuilding, finalQuestUnlocked = false, finalQuestCompleted = false, onFinalQuest = () => {}, initialQuestId = null }: { api: ApiClient, user: User, quests: Quest[], loading: boolean, loadError: string, reload: () => Promise<void>, close: () => void, logout: () => void, profile: ReactNode, position?: CampusPosition, currentBuilding?: string, finalQuestUnlocked?: boolean, finalQuestCompleted?: boolean, onFinalQuest?: () => void, initialQuestId?: number | null }) {
  const [time, setTime] = useState(() => new Date())
  const [theme, setTheme] = useState<Theme>(() => { const saved = localStorage.getItem('tvoyvybor.phoneTheme'); return themes.find(t => t.id === saved)?.id ?? 'campus' })
  const gesture = useRef<{ id: number, x: number, y: number, type: 'home' | 'back' } | null>(null)
  const suppressClick = useRef(false)
  const phoneRef = useRef<HTMLElement>(null)
  const [app, setApp] = useState<AppName>(initialQuestId === null ? 'home' : 'quests')
  useEffect(() => { const timer = window.setInterval(() => setTime(new Date()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => { const handle = (event: KeyboardEvent) => { if (event.key !== 'Escape' || event.repeat) return; event.preventDefault(); if (app !== 'home') goHome(); else close() }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle) }, [app, close])
  useEffect(() => { phoneRef.current?.focus() }, [])
  const [tab, setTab] = useState<'active' | 'available' | 'completed'>('active')
  const [selected, setSelected] = useState<number | null>(initialQuestId)
  const [selectedFinal, setSelectedFinal] = useState(false)
  useEffect(() => { if (initialQuestId !== null) { setSelectedFinal(false); setSelected(initialQuestId); setApp('quests') } }, [initialQuestId])
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const lock = useRef(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [achievements, setAchievements] = useState<{ slug: string, title: string, description: string }[]>([])
  const [activityProfile, setActivityProfile] = useState<ActivityProfile | null>(null)
  useEffect(() => { if (app === 'achievements') api.achievements().then(setAchievements).catch((e: Error) => setError(e.message)) }, [api, app])
  const loadProfile = async () => { const result = await api.activityProfile(); setActivityProfile(result); setError('') }
  useEffect(() => { if (app === 'profile' && typeof api.activityProfile === 'function') api.activityProfile().then(setActivityProfile).catch((e: Error) => setError(e.message)) }, [api, app, quests])
  const quest = quests.find((item) => item.id === selected)
  const visibleQuests = quests.filter((q) => q.status === tab || (tab === 'available' && q.status === 'abandoned'))
  const tracked = quests.find((q) => q.tracked)
  const contact = contacts.find((item) => item.slug === selectedContact)
  function goHome() { setApp('home'); setSelected(null); setSelectedFinal(false); setSelectedContact(null); setError('') }
  function goBack() { if (app === 'contacts' && selectedContact) setSelectedContact(null); else if (app === 'quests' && (selected !== null || selectedFinal)) { setSelected(null); setSelectedFinal(false) } else goHome() }
  function startGesture(e: PointerEvent<HTMLElement>) {
    suppressClick.current = false
    if (e.button !== 0 || e.isPrimary === false) return
    const bounds = e.currentTarget.getBoundingClientRect()
    const target = e.target as HTMLElement
    const type = target.closest('.phone-home-indicator') ? 'home' : e.clientX - bounds.left <= 18 ? 'back' : null
    if (!type) return
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, type }; suppressClick.current = false
    if (type === 'home') target.closest('.phone-home-indicator')?.setPointerCapture?.(e.pointerId)
  }
  function endGesture(e: PointerEvent<HTMLElement>) {
    const start = gesture.current; if (!start || start.id !== e.pointerId) return
    gesture.current = null
    const dx = e.clientX - start.x, dy = e.clientY - start.y
    if (start.type === 'home' && dy < -35 && Math.abs(dy) > Math.abs(dx)) { suppressClick.current = true; goHome() }
    else if (start.type === 'back' && dx > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) { suppressClick.current = true; goBack() }
  }
  async function update(action: () => Promise<unknown>) { if (lock.current) return; lock.current = true; setUpdating(true); setError(''); try { await action(); await reload() } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка сервера') } finally { lock.current = false; setUpdating(false) } }
  return <div className="phone-backdrop" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { if (e.target === e.currentTarget) close() }} role="dialog" aria-modal="true" aria-label="CampusOS">
    <div className="phone-device">
    <section ref={phoneRef} tabIndex={-1} onPointerDown={startGesture} onPointerUp={endGesture} onPointerCancel={() => { gesture.current = null }} onClickCapture={e => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false } }} data-theme={theme} className={`campus-phone ${app === 'home' ? 'phone-home-screen' : 'phone-app-screen'}`}>
      <div className="phone-island" aria-hidden="true"><span /></div>
      <div className="phone-status"><time aria-label="Локальное время">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><span aria-hidden="true">● ▮▮ ▰</span></div>
      {app === 'home' ? <div className="phone-home">
        <h1 className="phone-brand">CampusOS</h1>
        <div className="phone-grid">{(Object.keys(labels) as PhoneApp[]).map((key) => <button className="phone-app-icon" key={key} type="button" onClick={() => { setError(''); setApp(key) }}><span className={`phone-icon icon-${key}`}><PhoneIcon name={key} /></span><span>{labels[key]}</span></button>)}</div>
      </div> : <div className="phone-content" key={app}>
        {error && <div className="phone-alert" role="alert">{error} <button type="button" onClick={() => { if (app === 'profile') void loadProfile().catch((e: Error) => setError(e.message)); else void update(reload) }}>Повторить загрузку</button></div>}
        {app === 'quests' && <><div className="phone-app-heading"><span className="phone-kicker">ВАШ МАРШРУТ</span><h2>Задачи</h2></div>{loading ? <p className="phone-empty" role="status">Загружаем задания…</p> : loadError ? <div className="phone-card phone-alert" role="alert"><p>{loadError}</p><button type="button" onClick={() => void update(reload)}>Повторить</button></div> : selectedFinal ? <><button className="phone-back" type="button" onClick={() => setSelectedFinal(false)}>‹ К списку задач</button><article className="phone-card phone-quest-detail"><span className="phone-tag">СЮЖЕТНОЕ · {finalQuestCompleted ? 'ЗАВЕРШЕНО' : 'ДОСТУПНО'}</span><h3>Подвести итоги</h3><p>Поговорите с наставником в главном корпусе.</p><div className="phone-meta"><span>⌁ Главный корпус</span><span>◉ Наставник кампуса</span></div></article><h3 className="phone-section-title">Цели</h3><ul className="phone-objectives"><li><span className={finalQuestCompleted ? 'objective-check completed' : 'objective-check'}>{finalQuestCompleted ? '✓' : ''}</span><span>Поговорить с наставником<small>{finalQuestCompleted ? '1 из 1' : '0 из 1'}</small></span></li></ul>{!finalQuestCompleted && <div className="phone-actions"><button type="button" onClick={onFinalQuest}>Вернуться в игру</button></div>}</> : quest ? <><button className="phone-back" type="button" onClick={() => setSelected(null)}>‹ К списку задач</button><article className="phone-card phone-quest-detail"><span className="phone-tag">{categoryName(quest.category)}</span><h3>{quest.title}</h3><p>{quest.description}</p><div className="phone-meta"><span>⌁ {locationName(quest.location_slug)}</span><span>◉ {npcName(quest.giver_npc_id)}</span>{quest.accepted_at && <span>Получено {new Date(quest.accepted_at).toLocaleString()}</span>}</div></article><h3 className="phone-section-title">Текущий этап</h3>{quest.gameplay && <div className="phone-card"><p>{quest.status !== 'active' && quest.status !== 'completed' ? 'Задание ещё не начато. Можно принять его здесь.' : quest.gameplay.state.stage === 'intro' ? `Поговорите с ${quest.giver_npc_id === 'boris' ? 'Борисом' : quest.giver_npc_id === 'frontina' ? 'Фронтиной' : 'Анной'}` : quest.gameplay.state.feedback}</p></div>}<h3 className="phone-section-title">Цели</h3><ul className="phone-objectives">{quest.objectives.map((o, index) => <li key={o.id}><span className={o.completed ? 'objective-check completed' : 'objective-check'}>{o.completed ? '✓' : ''}</span><span>{index === 0 && quest.gameplay?.state.stage === 'intro' ? 'Поговорите с наставником' : o.title}<small>{o.current_count} из {o.required_count}</small></span></li>)}</ul>{(quest.status === 'available' || quest.status === 'abandoned' || quest.status === 'active') && <div className="phone-actions">{(quest.status === 'available' || quest.status === 'abandoned') ? <button type="button" disabled={updating} onClick={() => void update(async () => { await api.offerQuest(quest.id, quest.giver_npc_id); await api.acceptQuest(quest.id); await api.trackQuest(quest.id); setTab('active') })}>Начать задание</button> : <><button type="button" disabled={updating} onClick={() => void update(() => api.trackQuest(quest.tracked ? null : quest.id))}>{quest.tracked ? 'Не отслеживать' : 'Отслеживать'}</button>{quest.category !== 'main' && <button type="button" disabled={updating} onClick={() => void update(() => api.abandonQuest(quest.id))}>Отказаться</button>}</>}</div>}</> : <><div className="phone-tabs">{(['active', 'available', 'completed'] as const).map((value) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}>{value === 'active' ? 'Активные' : value === 'available' ? 'Доступные' : 'Завершённые'}</button>)}</div>{visibleQuests.length === 0 && !((finalQuestUnlocked && tab === 'available') || (finalQuestCompleted && tab === 'completed')) && <div className="phone-card phone-empty"><span>✦</span><strong>Пока пусто</strong><p>Выберите дело во вкладке «Доступные».</p></div>}{((finalQuestUnlocked && tab === 'available') || (finalQuestCompleted && tab === 'completed')) && <button className="phone-quest" type="button" onClick={() => setSelectedFinal(true)}><span className="phone-quest-icon"><PhoneIcon name="quests" /></span><span className="phone-quest-copy"><strong>Подвести итоги</strong><span>Главный корпус · Наставник кампуса</span><small>{finalQuestCompleted ? '1 / 1' : '0 / 1'} целей</small></span><span aria-hidden="true">›</span></button>}{visibleQuests.map((q) => <button className="phone-quest" key={q.id} type="button" onClick={() => setSelected(q.id)}><span className="phone-quest-icon"><PhoneIcon name="quests" /></span><span className="phone-quest-copy"><strong>{q.title}</strong><span>{locationName(q.location_slug)} · {npcName(q.giver_npc_id)}</span><small>{q.objectives.filter((o) => o.completed).length} / {q.objectives.length} целей {q.tracked ? ' · Отслеживается' : ''}</small></span><span aria-hidden="true">›</span></button>)}</>}</>}
        {app === 'map' && <><PhoneMap position={position} currentBuilding={currentBuilding} /><div className="phone-card"><span className="phone-card-label">ОТСЛЕЖИВАЕТСЯ</span><strong>{tracked ? locationName(tracked.location_slug) : 'Маршрут не выбран'}</strong><p>{tracked?.title ?? 'Выберите активную задачу в журнале.'}</p></div></>}
        {app === 'contacts' && (contact ? <><button className="phone-back" type="button" onClick={() => setSelectedContact(null)}>‹ Контакты</button><article className="phone-contact-profile"><div className="phone-contact-portrait"><img src={contact.portrait} alt={`Портрет: ${contact.name}`} /></div><h2>{contact.name}</h2><span className="phone-tag">{contact.role}</span><p>{contact.description}</p><p>{quests.some(q => q.location_slug === contact.slug && q.accepted_at) ? "Знакомы · задания и результаты в журнале" : "Открыт для знакомства в корпусе"}</p></article></> : <><div className="phone-app-heading"><h2>Контакты</h2></div><div className="phone-contact-list">{contacts.map((item) => <button className="phone-contact" type="button" key={item.slug} onClick={() => setSelectedContact(item.slug)}><span className="phone-avatar"><img src={item.portrait} alt="" /></span><span><strong>{item.name}</strong><small>{item.role}</small></span><span className="phone-contact-chevron" aria-hidden="true">›</span></button>)}</div></>)}
        {app === 'profile' && <><div className="phone-player-card"><img src={playerAppearance.front} alt="Игровой персонаж — робот" /><div><span className="phone-card-label">ИГРОК</span><strong>Стажёр Ноль</strong><small>{user.email}</small></div></div><div className="phone-embedded">{quests.some(q => q.gameplay) ? <QuestProfile quests={quests} activityProfile={activityProfile} api={api} reloadProfile={loadProfile} openQuest={id => { setSelectedFinal(false); setSelected(id); setApp('quests') }} /> : profile}</div></>}
        {app === 'achievements' && <><div className="phone-app-heading"><span className="phone-kicker">ВАША КОЛЛЕКЦИЯ</span><h2>Достижения</h2></div>{achievements.length ? achievements.map((a) => <article className="phone-card phone-achievement" key={a.slug}><span className="phone-award"><PhoneIcon name="achievements" /></span><div><strong>{a.title}</strong><p>{a.description}</p></div></article>) : <div className="phone-card phone-empty"><span>✧</span><strong>Пока нет достижений</strong><p>Продолжайте исследовать кампус.</p></div>}</>}
        {app === 'help' && <PhoneHelp />}
        {app === 'themes' && <><div className="phone-app-heading"><h2>Темы</h2></div><div className="phone-theme-list">{themes.map(t => <button key={t.id} type="button" className="phone-card phone-theme-choice" aria-pressed={theme === t.id} onClick={() => { setTheme(t.id); localStorage.setItem('tvoyvybor.phoneTheme', t.id) }}><span className={`theme-swatch swatch-${t.id}`} /><span>{t.name}</span><span aria-hidden="true">{theme === t.id ? '✓' : ''}</span></button>)}</div></>}
        {app === 'settings' && <><div className="phone-app-heading"><h2>Настройки</h2></div><div className="phone-card"><span className="phone-card-label">АККАУНТ</span><strong>{user.email}</strong></div><div className="phone-card"><span className="phone-card-label">УСТРОЙСТВО</span><strong>CampusOS</strong></div><button className="phone-signout" type="button" onClick={() => { if (window.confirm('Выйти из аккаунта?')) logout() }}><PhoneIcon name="logout" />Выйти из аккаунта</button></>}

      </div>}
      <button className="phone-home-indicator" type="button" onClick={goHome} aria-label="На главный экран телефона" />
    </section>
    </div>
  </div>
}
