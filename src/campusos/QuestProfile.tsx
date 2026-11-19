import type { ActivityProfile, Quest } from '../api'

const reactions: Record<string, string> = { more: 'Хочется продолжить', interesting: 'Было интересно', 'not-mine': 'Пока не моё', enough: 'На сегодня достаточно' }
const activities: Record<string, string> = { diagnosis: 'Поиск причин проблем', code: 'Работа с кодом', responsive: 'Визуальная часть', ux: 'Взаимодействие с пользователем', interview: 'Исследование требований', data: 'Работа с данными' }

export function QuestProfile({ quests, activityProfile }: { quests: Quest[], activityProfile?: ActivityProfile | null }) {
  const games = quests.filter(q => q.gameplay)
  const started = games.filter(q => q.accepted_at)
  const completed = games.filter(q => q.status === 'completed')
  const tried = [...new Set(started.map(q => activities[q.gameplay!.kind] ?? q.title))]
  const seconds = started.reduce((sum, q) => sum + q.gameplay!.state.active_seconds, 0)
  const attempts = started.reduce((sum, q) => sum + q.gameplay!.state.attempts, 0)
  const interests = activityProfile?.groups ?? []
  return <><div className="phone-app-heading"><h2>Профиль</h2></div>
    <article className="phone-card"><span className="phone-card-label">ОБЩИЙ ПРОГРЕСС</span><strong>{completed.length} из {games.length} ситуаций завершено</strong><progress aria-label="Общий прогресс" value={completed.length} max={Math.max(1, games.length)} /><div className="phone-stat-grid"><div><b>{started.length}</b><small>начато</small></div><div><b>{Math.floor(seconds / 60)}</b><small>минут в работе</small></div><div><b>{attempts}</b><small>проверок и решений</small></div></div></article>
    <h3 className="phone-section-title">Твои интересы</h3>
    {!activityProfile ? <article className="phone-card"><p>Загружаем наблюдения о том, какие занятия тебя увлекли…</p></article> : interests.length ? <div className="phone-profile-groups">{interests.slice(0, 5).map(group => <article className="phone-card phone-interest-group" key={group.code}><strong>{group.name}</strong><p>{group.description}</p><small>{group.evidence_count} игровых наблюдений</small></article>)}</div> : <article className="phone-card"><p>{activityProfile.event_count === 0 ? 'Пока данных мало для вывода. Попробуй занятие и поделись впечатлением с наставником.' : 'Пока не проявился устойчивый интерес. Это тоже полезное наблюдение.'}</p></article>}
    {activityProfile?.preliminary && activityProfile.event_count > 0 && <p className="phone-profile-observation">Пока данных немного, поэтому вывод предварительный. Он уточнится по мере новых впечатлений.</p>}
    <h3 className="phone-section-title">Что тебе особенно нравится</h3>
    {interests.length ? <div className="phone-interest-chips">{interests.slice(0, 5).map(group => <span key={group.code}>{group.name}</span>)}</div> : <article className="phone-card"><p>Здесь появятся занятия, которые захочется исследовать дальше.</p></article>}
    <h3 className="phone-section-title">Уже попробовал</h3>
    {tried.length ? <div className="phone-interest-chips">{tried.map(activity => <span key={activity}>{activity}</span>)}</div> : <article className="phone-card"><p>Здесь появятся первые занятия после начала заданий.</p></article>}
    <h3 className="phone-section-title">Стоит подробнее попробовать</h3>
    {activityProfile?.careers.length ? activityProfile.careers.slice(0, 4).map(career => <article className="phone-card" key={career.name}><strong>{career.name}</strong><p>{career.explanation}</p></article>) : <article className="phone-card"><p>Пока мало наблюдений для рекомендаций. Попробуй несколько занятий и отметь впечатление.</p></article>}
    {activityProfile?.additional && <article className="phone-card"><span className="phone-card-label">ЧТО ЕЩЁ СТОИТ ПОПРОБОВАТЬ</span><strong>{activityProfile.additional[0]}</strong><p>{activityProfile.additional[1]}</p></article>}
    <h3 className="phone-section-title">Чему уделить время</h3>
    {activityProfile?.learning.length ? activityProfile.learning.slice(0, 4).map(item => <article className="phone-card" key={item.title}><strong>{item.title}</strong><p>{item.action}</p></article>) : <article className="phone-card"><p>Когда проявятся интересы, здесь появятся идеи для конкретных следующих шагов.</p></article>}
    <small className="phone-profile-note">Рекомендации показывают возможные направления для знакомства, а не оценку способностей. Правильность ответов не определяет интерес.</small>
    {started.length > 0 && <details className="phone-profile-history"><summary>Задания и статистика · {started.length}</summary>{started.map(q => { const s = q.gameplay!.state; return <article className="phone-card" key={q.id}><strong>{q.title}</strong><p>{q.status === 'completed' ? 'Завершено' : q.status === 'abandoned' ? 'Отложено' : s.stage === 'intro' ? 'Поговорите с наставником' : q.objectives.find(o => !o.completed)?.title ?? 'В работе'}</p><p>{reactions[s.reaction ?? ''] ?? 'Впечатление ещё не сохранено'}</p><small>Активное время: {Math.floor(s.active_seconds / 60)} мин {s.active_seconds % 60} с · попыток: {s.attempts}<br />{s.hints ? `Помощь: ${s.hints} ур.` : 'Без подсказок'}{s.example_used ? ' · открыт пример' : ''}{s.extra_exploration ? ' · исследовано сверх решения' : ''}</small>{s.tests && <p>Тесты кода: {s.tests.filter(t => t.passed).length} / {s.tests.length}</p>}</article> })}</details>}
  </>
}
