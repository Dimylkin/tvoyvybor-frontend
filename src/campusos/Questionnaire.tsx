import { useEffect, useRef, useState } from 'react'
import type { ApiClient, QuestionnaireAnswer, QuestionnaireAttempt, QuestionnaireQuestion, QuestionnaireResult, QuestionnaireState } from '../api'
import './questionnaire.css'
import { careerTraitLabels as labels } from './activityLabels'

const bipolarLabels = ['Точно первая', 'Скорее первая', 'Одинаково', 'Скорее вторая', 'Точно вторая']
const scaleLabels = ['Совсем неинтересно', 'Скорее неинтересно', 'Нейтрально', 'Скорее интересно', 'Очень интересно']

function describeAnswer(q: QuestionnaireQuestion, a?: QuestionnaireAnswer) {
  if (!a || a.status === 'skipped') return 'Пропущено'
  if (a.status === 'unsure') return 'Пока не могу определиться'
  if (a.status === 'neither') return 'Ни один вариант не близок'
  if (Array.isArray(a.value)) return q.options?.filter(o => (a.value as string[]).includes(o.id)).map(o => o.label).join(', ') ?? ''
  if (q.format === 'bipolar' && typeof a.value === 'number') return bipolarLabels[a.value + 2]
  if (q.format === 'scale' && typeof a.value === 'number') return `${a.value} — ${scaleLabels[a.value - 1]}`
  return String(a.value ?? '')
}

export function Questionnaire({ api, onClose, onOpenProfile }: { api: ApiClient, onClose: () => void, onOpenProfile?: () => void }) {
  const [latestVersion, setLatestVersion] = useState<number | null>(null)
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([])
  const [state, setState] = useState<QuestionnaireState | null>(null)
  const [attempt, setAttempt] = useState<QuestionnaireAttempt | null>(null)
  const [answer, setAnswer] = useState<QuestionnaireAnswer | null>(null)
  const [result, setResult] = useState<QuestionnaireResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [completionPending, setCompletionPending] = useState(false)
  const [confirmRetake, setConfirmRetake] = useState(false)
  const pending = useRef<{ key: string, id: string } | null>(null)
  const opId = (key: string) => { if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() }; return pending.current.id }

  useEffect(() => {
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => { origin?.focus() }
  }, [])
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { latest_catalog_version: latest } = await api.questionnaireCapabilities()
        const saved = await api.questionnaireState(latest)
        const catalog = await api.questionnaireCatalog(saved.current?.catalog_version ?? latest)
        if (!active) return
        setLatestVersion(latest); setQuestions(catalog.questions); setState(saved); setAttempt(saved.current)
        setAnswer(saved.current?.answers[saved.current.current_question_id] ?? null); setError('')
      } catch { if (active) setError('Не удалось загрузить опрос. Попробуй ещё раз.') }
    }
    void load()
    return () => { active = false }
  }, [api, revision])
  useEffect(() => {
    let active = true
    setResult(null)
    if (state?.last_completed) api.questionnaireResults(state.last_completed.id).then(value => { if (active) setResult(value) }).catch(() => { if (active) setError('Не удалось загрузить результаты опроса.') })
    return () => { active = false }
  }, [api, state?.last_completed])
  const index = attempt ? questions.findIndex(q => q.id === attempt.current_question_id) : -1
  const question = questions[index]
  async function start(retake: boolean) {
    if (latestVersion === null) return
    setBusy(true); setError('')
    try {
      const catalog = await api.questionnaireCatalog(latestVersion)
      const next = await api.startQuestionnaire(opId(`start:${retake}`), retake, latestVersion)
      const actual = next.catalog_version !== latestVersion ? await api.questionnaireCatalog(next.catalog_version) : catalog
      pending.current = null; setQuestions(actual.questions); setAttempt(next); setAnswer(next.answers[next.current_question_id] ?? null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось начать опрос.') } finally { setBusy(false) }
  }
  async function finish(next: QuestionnaireAttempt) {
    setCompletionPending(true)
    const completed = await api.completeQuestionnaire(next.id, opId(`complete:${next.id}:${next.revision}`), next.revision)
    pending.current = null; setCompletionPending(false); setAttempt(null)
    try { setState(await api.questionnaireState(latestVersion!)) } catch { setState({ status: 'completed', current: null, last_completed: completed }) }
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
      if (target === index && value && index === questions.length - 1) await finish(next)
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить ответ.') } finally { setBusy(false) }
  }
  async function saveAndClose() {
    if (!attempt || !question) { onClose(); return }
    const saved = attempt.answers[question.id]
    const current = answer ?? (saved ? { status: 'skipped' as const, value: null } : null)
    if (!current || JSON.stringify(current) === JSON.stringify(saved)) { onClose(); return }
    const update = { question_id: question.id, answer: current }
    const key = JSON.stringify([attempt.id, attempt.revision, question.id, update])
    setBusy(true); setError('')
    try { await api.saveQuestionnaire(attempt.id, opId(key), attempt.revision, question.id, update); pending.current = null; onClose() } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить ответ.') } finally { setBusy(false) }
  }
  async function showResult(id: number) {
    setBusy(true); setError('')
    try { setResult(await api.questionnaireResults(id)) } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить ответы.') } finally { setBusy(false) }
  }
  const toggle = (id: string) => {
    const chosen = Array.isArray(answer?.value) ? answer.value : []
    const next = chosen.includes(id) ? chosen.filter(v => v !== id) : question.max_choices === 1 ? [id] : [...chosen, id].slice(0, question.max_choices)
    setAnswer(next.length ? { status: 'answered', value: next } : null)
  }
  return <div className="questionnaire-backdrop task-backdrop" role="dialog" aria-modal="true" aria-label="Знакомство с интересами"><section className="panel task-window questionnaire-window">
    <header className="task-header"><h2>Знакомство с интересами</h2>{question && <span>{index + 1} из {questions.length}</span>}</header>
    <div className="questionnaire-body task-body">
      {error && <p role="alert">{error} {!state && <button type="button" onClick={() => setRevision(v => v + 1)}>Повторить</button>}{completionPending && <button type="button" disabled={busy} onClick={() => void retryFinish()}>Повторить завершение</button>}{state && error.includes('изменилось') && <button type="button" onClick={() => setRevision(v => v + 1)}>Загрузить актуальное состояние</button>}</p>}
      {!state ? <p>Загружаем вопросы…</p> : !attempt ? <>
        <p>{state.last_completed ? 'Опрос завершён. Ты можешь посмотреть свои ответы или начать заново.' : 'Ответь на вопросы о том, что тебе интересно. Любой вопрос можно пропустить.'}</p>
        {result?.summary && <p>{(() => { const contextNames: Record<string, string> = { B: 'серверная логика', F: 'интерфейсы', D: 'данные', R: 'требования' }; const positives = Object.entries(result.summary).filter(([, value]) => value.label === 'positive').map(([key]) => contextNames[key]); const mixed = Object.entries(result.summary).filter(([, value]) => value.label === 'mixed').map(([key]) => contextNames[key]); return [positives.length ? `Предварительный интерес: ${positives.join(', ')}.` : '', mixed.length ? `В ответах о темах ${mixed.join(', ')} есть разные впечатления.` : '', !positives.length && !mixed.length ? 'Ответов пока недостаточно для выраженного вывода.' : '', 'Практика поможет уточнить впечатление.'].filter(Boolean).join(' ') })()}</p>}
        {result && onOpenProfile && <button type="button" onClick={onOpenProfile}>Открыть профиль</button>}
        {result?.interests && <p>{Object.keys(result.interests).length ? `Предварительные интересы: ${Object.entries(result.interests).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key]) => labels[key] ?? key).join(', ')}.` : 'Числовых ответов нет — можно начать с игровых проб.'}</p>}
        {result && <details><summary>Посмотреть ответы{result.catalog_version === 1 ? ' — предыдущая версия опроса' : ''}</summary>{result.catalog.map(q => <p key={q.id}><strong>{q.context && `${q.context}: `}{q.text}</strong>{q.alternatives && <><br />{q.alternatives[0].label} / {q.alternatives[1].label}</>}<br />{describeAnswer(q, result.answers[q.id])}</p>)}</details>}
        {(state.history?.length ?? 0) > 1 && <details><summary>История прохождений</summary>{state.history?.map(item => <button type="button" disabled={busy} key={item.id} onClick={() => void showResult(item.id)}>Прохождение {item.number}{item.catalog_version === 1 ? ' — предыдущая версия' : ''}{item.completed_at ? ` · ${new Date(item.completed_at).toLocaleDateString('ru-RU')}` : ''}</button>)}</details>}
        {state.last_completed && confirmRetake ? <><p>Предыдущий результат будет использоваться до завершения новой попытки.</p><button type="button" disabled={busy} onClick={() => void start(true)}>Начать повторное прохождение</button><button type="button" disabled={busy} onClick={() => setConfirmRetake(false)}>Отмена</button></> : <button type="button" disabled={busy} onClick={() => state.last_completed ? setConfirmRetake(true) : void start(false)}>{state.last_completed ? 'Пройти заново' : 'Начать'}</button>}
      </> : question && <>
        <h3 className="questionnaire-question">{question.context ?? question.text}</h3>{question.context && <p className="questionnaire-hint">{question.text}</p>}
        {question.format === 'bipolar' && question.alternatives ? <><div className="questionnaire-alternatives"><p><strong>Первая:</strong> {question.alternatives[0].label}</p><p><strong>Вторая:</strong> {question.alternatives[1].label}</p></div><fieldset className="questionnaire-scale"><legend className="questionnaire-visually-hidden">Выбери, что ближе</legend>{bipolarLabels.map((label, i) => <label key={label}><input type="radio" name="bipolar" checked={answer?.status === 'answered' && answer.value === i - 2} onChange={() => setAnswer({ status: 'answered', value: i - 2 })} /><span>{label}</span></label>)}</fieldset></> : question.format === 'scale' ? <><p>{question.prompt}</p><fieldset className="questionnaire-scale"><legend>Интерес к занятию</legend>{scaleLabels.map((label, i) => <label key={label}><input type="radio" name="scale" checked={answer?.status === 'answered' && answer.value === i + 1} onChange={() => setAnswer({ status: 'answered', value: i + 1 })} /><span>{i + 1}<br />{label}</span></label>)}</fieldset></> : <><p>{question.max_choices === 1 ? 'Выбери один вариант.' : 'Выбери до двух вариантов.'}</p><div className="questionnaire-options">{question.options?.map(option => <button key={option.id} type="button" aria-pressed={Array.isArray(answer?.value) && answer.value.includes(option.id)} onClick={() => toggle(option.id)}>{option.label}</button>)}</div>{!answer && attempt.answers[question.id]?.status === 'answered' && <p>Выбор снят. При переходе вопрос будет пропущен.</p>}</>}
        {(answer?.status === 'neither' || answer?.status === 'unsure') && <p className="questionnaire-hint">Ранее сохранённый ответ: {describeAnswer(question, answer)}. Можно оставить его, выбрать другой ответ или пропустить вопрос.</p>}
      </>}
    </div>
    <footer className="questionnaire-footer">{attempt && question && !completionPending && <><button type="button" disabled={busy || index === 0} onClick={() => void move(index - 1, answer ?? (attempt.answers[question.id] ? { status: 'skipped', value: null } : undefined))}>Назад</button><button type="button" disabled={busy} onClick={() => void move(Math.min(index + 1, questions.length - 1), { status: 'skipped', value: null })}>Пропустить</button><button type="button" disabled={busy || !answer} onClick={() => answer && void move(Math.min(index + 1, questions.length - 1), answer)}>{index === questions.length - 1 ? 'Завершить' : 'Дальше'}</button></>}<button type="button" disabled={busy} onClick={() => void saveAndClose()}>{attempt ? 'Сохранить и выйти' : 'Вернуться в кампус'}</button></footer>
  </section></div>
}
