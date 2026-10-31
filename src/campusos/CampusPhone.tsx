import { useEffect, useState, type ReactNode } from 'react'
import type { ApiClient, Quest, User } from '../api'

type AppName = 'home' | 'quests' | 'map' | 'contacts' | 'profile' | 'results' | 'achievements' | 'help' | 'settings'
const locationName = (slug: string) => ({ backend: 'Backend-корпус', frontend: 'Frontend-корпус', analytics: 'Корпус аналитики' }[slug] ?? slug)
const npcName = (id: string) => ({ boris: 'Борис Бэкендович' }[id] ?? id)
const categoryName = (category: string) => ({ professional: 'Профессиональное', main: 'Сюжетное', side: 'Дополнительное' }[category] ?? category)
const labels: Record<Exclude<AppName, 'home'>, string> = { quests: 'Задачи', map: 'Карта', contacts: 'Контакты', profile: 'Профиль', results: 'Отчёт', achievements: 'Достижения', help: 'Справка', settings: 'Настройки' }

export function CampusPhone({ api, user, quests, reload, close, logout, profile, results }: { api: ApiClient, user: User, quests: Quest[], reload: () => Promise<void>, close: () => void, logout: () => void, profile: ReactNode, results: ReactNode }) {
  const [app, setApp] = useState<AppName>('home')
  const [tab, setTab] = useState<'active' | 'available' | 'completed'>('active')
  const [selected, setSelected] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [achievements, setAchievements] = useState<{ slug: string, title: string, description: string }[]>([])
  useEffect(() => { if (app === 'achievements') api.achievements().then(setAchievements).catch((e: Error) => setError(e.message)) }, [api, app])
  const quest = quests.find((item) => item.id === selected)
  async function update(action: () => Promise<unknown>) { setError(''); try { await action(); await reload() } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка сервера') } }
  return <div className="phone-backdrop" onPointerDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="CampusOS">
    <section className="campus-phone"><header><strong>CampusOS</strong><button type="button" autoFocus onClick={close} aria-label="Закрыть телефон">×</button></header>
      <div className="phone-content">{app !== 'home' && <button type="button" onClick={() => { setApp('home'); setSelected(null); setError('') }}>← Домой</button>}
        {error && <p role="alert">{error} <button type="button" onClick={() => void update(reload)}>Повторить загрузку</button></p>}
        {app === 'home' && <><h2>Приложения</h2><div className="phone-grid">{(Object.keys(labels) as Exclude<AppName, 'home'>[]).map((key) => <button key={key} type="button" onClick={() => setApp(key)}>{labels[key]}</button>)}<button type="button" onClick={() => { if (window.confirm('Выйти из аккаунта?')) logout() }}>Выход</button></div></>}
        {app === 'quests' && <><h2>Задачи</h2>{quest ? <><h3>{quest.title}</h3><p>{quest.description}</p><p>{categoryName(quest.category)} · {locationName(quest.location_slug)} · {npcName(quest.giver_npc_id)}</p><p>{quest.accepted_at && `Получено: ${new Date(quest.accepted_at).toLocaleString()}`}</p><ul>{quest.objectives.map((o) => <li key={o.id}>{o.completed ? '✓' : '○'} {o.title} ({o.current_count}/{o.required_count})</li>)}</ul>{quest.status === 'active' && <><button type="button" onClick={() => void update(() => api.trackQuest(quest.tracked ? null : quest.id))}>{quest.tracked ? 'Не отслеживать' : 'Отслеживать'}</button> {quest.category !== 'main' && <button type="button" onClick={() => void update(() => api.abandonQuest(quest.id))}>Отказаться</button>}</>}<button type="button" onClick={() => setSelected(null)}>Назад</button></> : <><div className="phone-tabs">{(['active', 'available', 'completed'] as const).map((value) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}>{value === 'active' ? 'Активные' : value === 'available' ? 'Доступные' : 'Завершённые'}</button>)}</div>{quests.filter((q) => q.status === tab || (tab === 'available' && q.status === 'abandoned')).length === 0 ? <p>Здесь пока пусто.</p> : quests.filter((q) => q.status === tab || (tab === 'available' && q.status === 'abandoned')).map((q) => <button className="phone-quest" key={q.id} type="button" onClick={() => setSelected(q.id)}><strong>{q.title}</strong><span>{locationName(q.location_slug)} · {npcName(q.giver_npc_id)} · {q.objectives.filter((o) => o.completed).length}/{q.objectives.length} {q.tracked ? '★' : ''}</span></button>)}</>}</>}
        {app === 'map' && <><h2>Карта</h2><p>Кампус: главный корпус, Backend, Frontend и Analytics.</p><p>Отслеживается: {locationName(quests.find((q) => q.tracked)?.location_slug ?? 'нет')}</p></>}
        {app === 'contacts' && <><h2>Контакты</h2><p>Дядя Дебаг · Борис Бэкендович · Фронтина Пиксельевна · Анна Литикова</p></>}
        {app === 'profile' && <>{profile}</>}{app === 'results' && <>{results}</>}
        {app === 'achievements' && <><h2>Достижения</h2>{achievements.length ? achievements.map((a) => <p key={a.slug}><strong>{a.title}</strong> — {a.description}</p>) : <p>Пока нет достижений.</p>}</>}
        {app === 'help' && <><h2>Справка</h2><p>WASD или стрелки — движение, E — взаимодействие, Tab — телефон, Escape — закрыть.</p></>}
        {app === 'settings' && <><h2>Настройки</h2><p>Учётная запись: {user.email}</p><p>Дополнительные настройки пока недоступны.</p></>}
      </div></section></div>
}
