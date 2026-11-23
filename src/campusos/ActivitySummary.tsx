import type { ActivityProfile } from '../api'
import { insightStatusText } from './activityLabels'

export function ActivitySummary({ profile, openQuest }: { profile: ActivityProfile, openQuest?: (id: number) => void }) {
  const main = profile.main_observation
  const insight = (profile.insights ?? []).find(item => item.activity_code === main?.activity_code)
  return <>
    <h3>Твои наблюдения</h3>
    {main ? <article className="phone-card phone-main-observation"><p><strong>{main.headline}</strong> {main.status === 'mixed' ? 'Сравни эти ситуации и обрати внимание, что повлияло на впечатление.' : `Попробуй познакомиться с направлением ${main.direction}: ${main.example}`}</p>
      <details><summary>Почему такой вывод?</summary><p>{main.interest}</p>{insight?.evidence.slice(0, 2).map(e => <p key={e.quest_id}>{e.description}</p>)}</details>
    </article> : (profile.insights ?? []).length ? <article className="phone-card"><strong>{profile.insights[0].label}</strong><p>{insightStatusText(profile.insights[0].status)}</p><details><summary>Почему такой вывод?</summary>{profile.insights[0].evidence.slice(0, 2).map(e => <p key={e.quest_id}>{e.description}</p>)}</details></article> : <p>Пока нет положительных впечатлений о конкретных действиях. Попробуй занятие и отметь впечатление.</p>}
    {profile.next_step && (!main || profile.next_step.quest_id !== null) && <article className="phone-card"><h3>Следующая проба: {profile.next_step.title}</h3><p>{profile.next_step.explanation}</p>{profile.next_step.quest_id !== null && openQuest && <div className="phone-actions"><button type="button" onClick={() => openQuest(profile.next_step!.quest_id!)}>Открыть карточку задания</button></div>}</article>}
    {(profile.insights ?? []).length > 1 && <details><summary>Другие наблюдения</summary>{profile.insights.slice(1).map(item => <article className="phone-card" key={item.activity_code}><strong>{item.label}</strong><p>{insightStatusText(item.status)}</p>{item.evidence.slice(0, 2).map(e => <p key={e.quest_id}>{e.description}</p>)}</article>)}</details>}
  </>
}
