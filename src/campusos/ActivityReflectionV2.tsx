import { useRef, useState } from 'react'
import type { ActivityHistory, ApiClient, ReflectionV2 } from '../api'

type Rating = number | 'unable' | null
export function ActivityReflectionV2({ api, item, existing = [], existingRepeat = null, onSaved, onClose }: { api: ApiClient, item: ActivityHistory, existing?: ReflectionV2[], existingRepeat?: boolean | null, onSaved: () => Promise<void>, onClose: () => void }) {
  const [values, setValues] = useState<Record<string, { rating: Rating, reason: string | null }>>(() => Object.fromEntries(existing.filter(v => v.quest_id === item.quest_id && item.activities.some(a => a.code === v.code)).map(v => [v.code, { rating: v.rating, reason: v.reason }])))
  const [repeat, setRepeat] = useState<boolean | null>(existingRepeat)
  const [repeatEdited, setRepeatEdited] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<{ key: string, id: string } | null>(null)
  async function save() {
    const changes = Object.entries(values).filter(([code, value]) => { const prior = existing.find(v => v.quest_id === item.quest_id && v.code === code); return prior ? prior.rating !== value.rating || prior.reason !== value.reason : value.rating !== null }).map(([code, value]) => ({ code, ...value }))
    const clearRepeat = repeatEdited && repeat === null && existingRepeat !== null
    const repeatValue = repeatEdited ? repeat : null
    const key = JSON.stringify([changes, repeatValue, clearRepeat])
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() }
    setBusy(true); setError('')
    try { await api.reflectQuestV2(item.quest_id, request.current.id, changes, repeatValue, clearRepeat); request.current = null; await onSaved(); onClose() } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить впечатления.') } finally { setBusy(false) }
  }
  return <section className="phone-card"><h3>Впечатления от действий</h3><p>Оценки добровольны. Можно отметить только те действия, о которых есть что сказать.</p>{item.activities.map(activity => <fieldset key={activity.code}><legend>{activity.label}</legend><div className="reflection-ratings">{[1, 2, 3, 4, 5, 'unable' as const].map(rating => <button type="button" key={rating} aria-pressed={values[activity.code]?.rating === rating} onClick={() => setValues(v => ({ ...v, [activity.code]: { rating, reason: null } }))}>{rating === 'unable' ? 'Не могу оценить' : rating}</button>)}<button type="button" onClick={() => setValues(v => ({ ...v, [activity.code]: { rating: null, reason: null } }))}>Очистить</button></div>{typeof values[activity.code]?.rating === 'number' && (values[activity.code].rating as number) <= 2 && <label>Что повлияло? <select value={values[activity.code].reason ?? ''} onChange={e => setValues(v => ({ ...v, [activity.code]: { ...v[activity.code], reason: e.target.value || null } }))}><option value="">Не указывать</option><option value="difficulty">Сложность</option><option value="knowledge">Не хватило знаний</option><option value="interface">Интерфейс</option><option value="activity">Само действие</option><option value="other">Другое</option></select></label>}</fieldset>)}<label>Хочется повторить похожую пробу? <select value={repeat === null ? '' : String(repeat)} onChange={e => { setRepeatEdited(true); setRepeat(e.target.value === '' ? null : e.target.value === 'true') }}><option value="">Не указывать</option><option value="true">Да</option><option value="false">Нет</option></select></label>{error && <p role="alert">{error}</p>}<div className="phone-history-actions"><button type="button" disabled={busy} onClick={() => void save()}>Сохранить</button><button type="button" disabled={busy} onClick={onClose}>Позже</button></div></section>
}
