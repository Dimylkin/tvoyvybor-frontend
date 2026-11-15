import type { Quest } from '../api'

const reactions: Record<string, string> = { more: 'Хочется продолжить', interesting: 'Было интересно', 'not-mine': 'Пока не моё', enough: 'На сегодня достаточно' }
const directionNames: Record<string, string> = { backend: 'Backend', frontend: 'Frontend', analytics: 'Analytics' }
const activities: Record<string, string> = { diagnosis: 'Искать причины проблем', code: 'Работать с логикой', responsive: 'Настраивать интерфейсы', ux: 'Делать формы понятнее', interview: 'Выяснять потребности людей', data: 'Разбираться в данных' }
const nextSteps: Record<string, string> = { backend: 'Попробуйте ещё одну небольшую функцию или разберите журнал ошибки.', frontend: 'Проверьте знакомую форму на телефоне: что можно сделать понятнее?', analytics: 'Возьмите небольшой набор данных и сформулируйте вопрос к нему.' }
export function QuestProfile({ quests }: { quests: Quest[] }) {
  const games = quests.filter(q => q.gameplay)
  const started = games.filter(q => q.accepted_at)
  const completed = games.filter(q => q.status === 'completed')
  const interested = completed.filter(q => ['more', 'interesting'].includes(q.gameplay!.state.reaction ?? ''))
  const positiveDirections = Object.keys(directionNames).filter(slug => interested.some(q => q.location_slug === slug))
  const untried = Object.keys(directionNames).filter(slug => !completed.some(q => q.location_slug === slug))
  const suggested = positiveDirections.length ? positiveDirections : untried
  const seconds = started.reduce((sum, q) => sum + q.gameplay!.state.active_seconds, 0)
  const attempts = started.reduce((sum, q) => sum + q.gameplay!.state.attempts, 0)
  const needsPractice = started.some(q => q.gameplay!.state.hints > 0)
  return <><div className="phone-app-heading"><h2>Профиль</h2></div>
    <article className="phone-card"><span className="phone-card-label">ОБЩИЙ ПРОГРЕСС</span><strong>{completed.length} из {games.length} ситуаций завершено</strong><progress aria-label="Общий прогресс" value={completed.length} max={Math.max(1, games.length)} /><div className="phone-stat-grid"><div><b>{started.length}</b><small>начато</small></div><div><b>{Math.floor(seconds / 60)}</b><small>минут в работе</small></div><div><b>{attempts}</b><small>проверок и решений</small></div></div></article>
    <h3 className="phone-section-title">Что тебе особенно нравится</h3>
    {interested.length ? <div className="phone-interest-chips">{interested.map(q => <span key={q.id}>✦ {activities[q.gameplay!.kind] ?? q.title}</span>)}</div> : <article className="phone-card"><p>После первых дел поделитесь впечатлением с наставником — здесь появятся занятия, которые вам откликнулись.</p></article>}
    <h3 className="phone-section-title">Направления</h3>
    {Object.entries(directionNames).map(([slug, title]) => {
      const entries = games.filter(q => q.location_slug === slug)
      const done = entries.filter(q => q.status === 'completed').length
      const positive = positiveDirections.includes(slug)
      return <article className="phone-card phone-direction" key={slug}><div><strong>{title}</strong><small>{done} / {entries.length} завершено</small></div><progress aria-label={`Прогресс ${title}`} value={done} max={Math.max(1, entries.length)} /><p>{positive ? 'Есть желание исследовать направление дальше.' : done ? 'Вы попробовали направление. Сравните впечатления с другими занятиями.' : 'Ещё предстоит попробовать.'}</p></article>
    })}
    <article className="phone-card"><span className="phone-card-label">СТОИТ ПОДРОБНЕЕ ПОПРОБОВАТЬ</span><div className="phone-interest-chips">{suggested.map(slug => <span key={slug}>{directionNames[slug]}</span>)}</div><p>{positiveDirections.length ? nextSteps[positiveDirections[0]] : untried.length ? 'Начните с любого любопытного дела и сравните свои впечатления.' : 'Попробуйте новый пример в другом направлении и прислушайтесь к впечатлениям.'}</p></article>
    <article className="phone-card"><span className="phone-card-label">ЧЕМУ УДЕЛИТЬ ВРЕМЯ</span><p>{needsPractice ? 'Повторите небольшой пример из документации, затем попробуйте похожую задачу самостоятельно.' : started.length ? 'Разберите одно решение: что сработало и что хочется попробовать иначе?' : 'Попробуйте по одному делу в разных корпусах. Спешить с выбором профессии не нужно.'}</p><small>Рекомендации — по впечатлениям, без оценки способностей. Ошибки и помощь не снижают интерес.</small></article>
    {started.length > 0 && <details className="phone-profile-history"><summary>Задания и статистика · {started.length}</summary>{started.map(q => { const s = q.gameplay!.state; return <article className="phone-card" key={q.id}><strong>{q.title}</strong><p>{q.status === 'completed' ? 'Завершено' : q.status === 'abandoned' ? 'Отложено' : s.stage === 'intro' ? 'Поговорите с наставником' : q.objectives.find(o => !o.completed)?.title ?? 'В работе'}</p><p>{reactions[s.reaction ?? ''] ?? 'Впечатление ещё не сохранено'}</p><small>Активное время: {Math.floor(s.active_seconds / 60)} мин {s.active_seconds % 60} с · попыток: {s.attempts}<br />{s.hints ? `Помощь: ${s.hints} ур.` : 'Без подсказок'}{s.example_used ? ' · открыт пример' : ''}{s.extra_exploration ? ' · исследовано сверх решения' : ''}</small>{s.tests && <p>Тесты кода: {s.tests.filter(t => t.passed).length} / {s.tests.length}</p>}</article> })}</details>}
  </>
}
