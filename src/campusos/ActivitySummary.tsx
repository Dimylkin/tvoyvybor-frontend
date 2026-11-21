import type { ActivityProfile } from '../api'
import { insightStatusText } from './activityLabels'

export function ActivitySummary({ profile, openQuest }: { profile: ActivityProfile, openQuest?: (id: number) => void }) {
  return <>
    <h3>Твои наблюдения</h3>
    {(profile.insights ?? []).length ? profile.insights.map(item => <article className="phone-card" key={item.activity_code}><strong>{item.label}</strong><p>{insightStatusText(item.status)}</p>{item.evidence.map(e => <p key={e.quest_id}>{e.description}</p>)}</article>) : <p>Пока данных мало для вывода: нет положительных впечатлений о конкретных действиях. Можно попробовать занятие и отметить впечатление.</p>}
    {profile.next_step && <article className="phone-card"><h3>Следующая проба: {profile.next_step.title}</h3><p>{profile.next_step.explanation}</p>{profile.next_step.quest_id !== null && openQuest && <button type="button" onClick={() => openQuest(profile.next_step!.quest_id!)}>Открыть карточку задания</button>}</article>}
    {profile.careers.length > 0 && <><h3>Направления для знакомства</h3>{profile.careers.map(c => <article className="phone-card" key={c.name}><strong>{c.name}</strong><p>{c.explanation}</p></article>)}</>}
  </>
}
