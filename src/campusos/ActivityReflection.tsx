import { useRef, useState } from 'react'
import type { ActivityHistory, ActivityReflection as Reflection, ApiClient } from '../api'

export function ActivityReflection({ api, item, onSaved, onClose }: { api: ApiClient, item: ActivityHistory, onSaved: () => Promise<void>, onClose: () => void }) {
  const [response, setResponse] = useState<Reflection['response']>(item.reflection?.response ?? 'repeat')
  const [code, setCode] = useState(item.reflection?.activity_code ?? '')
  const [barrier, setBarrier] = useState<NonNullable<Reflection['barrier']> | ''>(item.reflection?.barrier ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<{ key: string, id: string } | null>(null)
  async function save() {
    const reflection: Reflection = { response, activity_code: response === 'unsure' ? null : code || null, barrier: barrier || null }
    const key = JSON.stringify(reflection)
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() }
    setBusy(true); setError('')
    try { await api.reflectQuest(item.quest_id, pending.current.id, reflection); await onSaved(); pending.current = null; onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить впечатление.') }
    finally { setBusy(false) }
  }
  return <section className="phone-card" aria-label={`Впечатление: ${item.title}`}><h3>Что хотелось бы повторить?</h3><p>Можно ответить сейчас или вернуться к вопросу позже.</p>
    <label>Впечатление <select value={response} onChange={e => setResponse(e.target.value as Reflection['response'])}><option value="repeat">Хочу повторить действие</option><option value="unsure">Пока не знаю</option><option value="not_mine">Это не моё</option></select></label>
    {response !== 'unsure' && <label>Действие <select value={code} onChange={e => setCode(e.target.value)}><option value="">{response === 'not_mine' ? 'Весь квест' : 'Выбери действие'}</option>{item.activities.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}</select></label>}
    {response !== 'repeat' && <label>Что повлияло? (необязательно) <select value={barrier} onChange={e => setBarrier(e.target.value as typeof barrier)}><option value="">Не указано</option><option value="difficulty">Сложность</option><option value="interface">Интерфейс</option><option value="activity">Само действие</option></select></label>}
    {error && <p role="alert">{error} Попробуй ещё раз.</p>}
    <div className="phone-actions"><button type="button" disabled={busy || (response === 'repeat' && !code)} onClick={() => void save()}>{busy ? 'Сохраняем…' : 'Сохранить'}</button><button type="button" disabled={busy} onClick={onClose}>Позже</button></div>
  </section>
}
