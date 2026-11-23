import { useState } from 'react'
import type { ActivityProfile, ApiClient, Quest } from '../api'
import { ActivityReflection } from './ActivityReflection'
import { ActivitySummary } from './ActivitySummary'
import { activityLabel, questStatus } from './activityLabels'

const responses = { repeat: 'Хочу повторить', unsure: 'Пока не знаю', not_mine: 'Это не моё' }
export function QuestProfile({ quests, activityProfile, api, reloadProfile, openQuest }: { quests: Quest[], activityProfile?: ActivityProfile | null, api?: ApiClient, reloadProfile?: () => Promise<void>, openQuest?: (id: number) => void }) {
  const [editing, setEditing] = useState<number | null>(null)
  const started = quests.filter(q => q.gameplay && q.accepted_at)
  const completed = quests.filter(q => q.gameplay && q.status === 'completed')
  return <><div className="phone-app-heading"><h2>Профиль</h2></div>
    {!activityProfile ? <p role="status">Загружаем профиль…</p> : <><ActivitySummary profile={activityProfile} openQuest={openQuest} />
      {!activityProfile.insights && <><h3>Чему уделить время</h3>{activityProfile.groups.map(g => <p key={g.code}>{g.name}</p>)}{activityProfile.learning.map(l => <p key={l.title}>{l.title}</p>)}</>}
      <details className="phone-profile-history"><summary>История проб и статистика</summary><article className="phone-card"><h3>Общий прогресс</h3><strong>{completed.length} из {quests.filter(q => q.gameplay).length} ситуаций завершено</strong><progress aria-label="Общий прогресс" value={completed.length} max={Math.max(1, quests.filter(q => q.gameplay).length)} /><p>{started.length} начато · {Math.floor(started.reduce((sum, q) => sum + q.gameplay!.state.active_seconds, 0) / 60)} мин · {started.reduce((sum, q) => sum + q.gameplay!.state.attempts, 0)} попыток</p></article>{(activityProfile.history ?? []).length === 0 && <p>Здесь появятся первые занятия после начала заданий.</p>}
      {(activityProfile.history ?? []).map(item => <article className="phone-card" key={item.quest_id}><strong>{item.title}</strong><p>{questStatus(item.status)}</p><p>{item.reflection ? `${responses[item.reflection.response]}${item.reflection.activity_code ? `: ${item.activities.find(a => a.code === item.reflection?.activity_code)?.label ?? activityLabel(item.reflection.activity_code)}` : ''}` : 'Впечатление ещё не сохранено'}</p>{item.legacy_reaction && <p>Ответ наставнику: {({ more: 'Хочется продолжить', interesting: 'Было интересно', 'not-mine': 'Пока не моё', enough: 'На сегодня достаточно' } as Record<string, string>)[item.legacy_reaction] ?? item.legacy_reaction}</p>}
        {quests.find(q => q.id === item.quest_id)?.gameplay && <small>Попыток: {quests.find(q => q.id === item.quest_id)!.gameplay!.state.attempts} · Подсказок: {quests.find(q => q.id === item.quest_id)!.gameplay!.state.hints}</small>}
        {editing === item.quest_id && api && reloadProfile ? <ActivityReflection api={api} item={item} onSaved={reloadProfile} onClose={() => setEditing(null)} /> : item.published && item.activities.length > 0 && api && <div className="phone-history-actions"><button type="button" onClick={() => setEditing(item.quest_id)}>{item.reflection ? 'Изменить впечатление' : 'Отметить впечатление'}</button></div>}
      </article>)}</details>
      <small>Это ориентир для знакомства, а не оценка способностей.</small>
    </>}
  </>
}
