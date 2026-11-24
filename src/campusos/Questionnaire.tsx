import { useEffect, useRef, useState } from 'react'
import type { ApiClient, QuestionnaireAnswer, QuestionnaireAttempt, QuestionnaireQuestion, QuestionnaireState } from '../api'
import './questionnaire.css'
import { careerTraitLabels as labels } from './activityLabels'

export function Questionnaire({ api, onClose }: { api: ApiClient, onClose: () => void }) {
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([])
  const [state, setState] = useState<QuestionnaireState | null>(null)
  const [attempt, setAttempt] = useState<QuestionnaireAttempt | null>(null)
  const [answer, setAnswer] = useState<QuestionnaireAnswer | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [completionPending, setCompletionPending] = useState(false)
  const [confirmRetake, setConfirmRetake] = useState(false)
  const [interests, setInterests] = useState<Record<string, number> | null>(null)
  const pending = useRef<{ key: string, id: string } | null>(null)
  const opId = (key: string) => { if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() }; return pending.current.id }
  useEffect(() => {
    let active = true
    Promise.all([api.questionnaireCatalog(), api.questionnaireState()]).then(([catalog, saved]) => { if (active) { setQuestions(catalog.questions); setState(saved); setAttempt(saved.current); setAnswer(saved.current?.answers[saved.current.current_question_id] ?? null); setError('') } }).catch(() => { if (active) setError('Не удалось загрузить опрос. Попробуй ещё раз.') })
    return () => { active = false }
  }, [api, revision])
  useEffect(() => {
    let active = true
    if (state?.last_completed) api.questionnaireResults(state.last_completed.id).then(result => { if (active) setInterests(result.interests) }).catch(() => { if (active) setInterests(null) })
    return () => { active = false }
  }, [api, state?.last_completed])
  const index = attempt ? questions.findIndex(q => q.id === attempt.current_question_id) : -1
  const question = questions[index]
  async function start(retake: boolean) {
    setBusy(true); setError('')
    try { const key = `start:${retake}`; const next = await api.startQuestionnaire(opId(key), retake); pending.current = null; setAttempt(next); setAnswer(next.answers[next.current_question_id] ?? null) } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось начать опрос.') } finally { setBusy(false) }
  }
  async function finish(next: QuestionnaireAttempt) {
    setCompletionPending(true)
    const key = `complete:${next.id}:${next.revision}`
    const completed = await api.completeQuestionnaire(next.id, opId(key), next.revision)
    pending.current = null; setCompletionPending(false); setAttempt(null); setState({ status: 'completed', current: null, last_completed: completed })
  }
  async function retryFinish() {
    if (!attempt || busy) return
    setBusy(true); setError('')
    try { await finish(attempt) } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось завершить опрос.') } finally { setBusy(false) }
  }
  async function move(target: number, value?: QuestionnaireAnswer) {
    if (!attempt || !question || busy) return
    const destination = questions[target]
    const update = value ? { question_id: question.id, answer: value } : undefined
    const key = JSON.stringify([attempt.id, attempt.revision, destination.id, update])
    setBusy(true); setError('')
    try {
      const next = await api.saveQuestionnaire(attempt.id, opId(key), attempt.revision, destination.id, update)
      pending.current = null; setAttempt(next); setAnswer(next.answers[destination.id] ?? null)
      if (target === index && value && index === questions.length - 1) {
        await finish(next)
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить ответ.') } finally { setBusy(false) }
  }
  async function saveAndClose() {
    if (!attempt || !question || !answer || JSON.stringify(answer) === JSON.stringify(attempt.answers[question.id])) { onClose(); return }
    const update = { question_id: question.id, answer }
    const key = JSON.stringify([attempt.id, attempt.revision, question.id, update])
    setBusy(true); setError('')
    try { await api.saveQuestionnaire(attempt.id, opId(key), attempt.revision, question.id, update); pending.current = null; onClose() } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить ответ.') } finally { setBusy(false) }
  }
  const toggle = (id: string) => {
    const chosen = Array.isArray(answer?.value) ? answer.value : []
    const next = chosen.includes(id) ? chosen.filter(v => v !== id) : question.max_choices === 1 ? [id] : [...chosen, id].slice(0, question.max_choices)
    setAnswer(next.length ? { status: 'answered', value: next } : null)
  }
  return <div className="questionnaire-backdrop" role="dialog" aria-modal="true" aria-label="Знакомство с интересами"><section className="questionnaire-window">
    <header><h2>Знакомство с интересами</h2>{question && <span>{index + 1} из {questions.length}</span>}</header>
    <div className="questionnaire-body">
      {error && <p role="alert">{error} {!state && <button type="button" onClick={() => setRevision(v => v + 1)}>Повторить</button>}{completionPending && <button type="button" disabled={busy} onClick={() => void retryFinish()}>Повторить завершение</button>}</p>}
      {!state ? <p>Загружаем вопросы…</p> : !attempt ? <><p>{state.last_completed ? 'Опрос завершён. Ты можешь посмотреть свои ответы или начать заново.' : 'Ответь на вопросы о том, что тебе интересно. Это займёт около 5–10 минут; любой вопрос можно пропустить.'}</p>{state.last_completed && interests && <p>{Object.keys(interests).length ? `Предварительные интересы: ${Object.entries(interests).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key]) => labels[key] ?? key).join(', ')}. Ответы учтены в профиле.` : 'Числовых ответов нет — можно начать с игровых проб.'}</p>}{state.last_completed && <details><summary>Посмотреть ответы</summary>{questions.map(q => <p key={q.id}><strong>{q.text}</strong><br />{(() => { const a = state.last_completed?.answers[q.id]; return a?.status === 'answered' ? Array.isArray(a.value) ? q.options?.filter(o => (a.value as string[]).includes(o.id)).map(o => o.label).join(', ') : String(a.value) : a?.status === 'unsure' ? 'Пока не могу определиться' : 'Пропущено' })()}</p>)}</details>}{state.last_completed && confirmRetake ? <><p>Предыдущий результат будет использоваться до завершения новой попытки.</p><button type="button" disabled={busy} onClick={() => void start(true)}>Начать повторное прохождение</button><button type="button" disabled={busy} onClick={() => setConfirmRetake(false)}>Отмена</button></> : <button type="button" disabled={busy} onClick={() => state.last_completed ? setConfirmRetake(true) : void start(false)}>{state.last_completed ? 'Пройти заново' : 'Начать'}</button>}</> : question && <><h3>{question.text}</h3><p>{question.prompt ?? (question.max_choices === 1 ? 'Выбери один вариант.' : 'Выбери до двух вариантов.')}</p><div className="questionnaire-options">{question.format === 'scale' ? [1, 2, 3, 4, 5].map(n => <button key={n} type="button" aria-pressed={answer?.status === 'answered' && answer.value === n} onClick={() => setAnswer({ status: 'answered', value: n })}>{n}</button>) : question.options?.map(option => <button key={option.id} type="button" aria-pressed={Array.isArray(answer?.value) && answer.value.includes(option.id)} onClick={() => toggle(option.id)}>{option.label}</button>)}<button type="button" aria-pressed={answer?.status === 'unsure'} onClick={() => setAnswer({ status: 'unsure', value: null })}>Пока не могу определиться</button></div></>}
    </div>
    <footer>{attempt && question && !completionPending && <><button type="button" disabled={busy || index === 0} onClick={() => void move(index - 1)}>Назад</button><button type="button" disabled={busy} onClick={() => void move(Math.min(index + 1, questions.length - 1), { status: 'skipped', value: null })}>Пропустить</button><button type="button" disabled={busy || !answer} onClick={() => answer && void move(Math.min(index + 1, questions.length - 1), answer)}>{index === questions.length - 1 ? 'Завершить' : 'Дальше'}</button></>}<button type="button" disabled={busy} onClick={() => void saveAndClose()}>{attempt ? 'Сохранить и выйти' : 'Вернуться в кампус'}</button></footer>
  </section></div>
}
