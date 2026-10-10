import { useRef, useState } from 'react'
import type { ApiClient, AttemptResult, Task } from './api'

interface TaskModalProps {
  api: ApiClient
  task: Task
  onResult: (result: AttemptResult) => void
  onClose: () => void
}

function choiceContent(content: Record<string, unknown>): { prompt: string, options: string[] } | null {
  const prompt = content.prompt
  const options = content.options
  return typeof prompt === 'string' && Array.isArray(options) && options.every((item) => typeof item === 'string')
    ? { prompt, options }
    : null
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (!globalThis.crypto?.getRandomValues) throw new Error('Браузер не поддерживает безопасную отправку попыток.')
  globalThis.crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function TaskModal({ api, task, onResult, onClose }: TaskModalProps) {
  const choice = task.kind === 'choice' ? choiceContent(task.content) : null
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AttemptResult | null>(null)
  const pendingRequestId = useRef<string | null>(null)

  async function submit() {
    if (!answer) return
    setBusy(true); setError('')
    try {
      const response = await api.submitAttempt(task.id, pendingRequestId.current ?? (pendingRequestId.current = createRequestId()), answer)
      pendingRequestId.current = null
      setResult(response)
      onResult(response)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось отправить попытку.')
    } finally { setBusy(false) }
  }

  return <div className="modal-backdrop" role="presentation">
    <section className="task-modal panel" role="dialog" aria-modal="true" aria-labelledby="task-title">
      <span className="eyebrow">Задание из игровой сцены</span><h2 id="task-title">{task.title}</h2>
      {!choice ? <p className="error">Этот тип задания пока не поддержан в игровом срезе.</p> : <>
        <p>{choice.prompt}</p>
        <div className="choice-list">{choice.options.map((option) => <label key={option}><input type="radio" name="answer" value={option} checked={answer === option} onChange={() => { pendingRequestId.current = null; setAnswer(option); setResult(null) }} disabled={busy || Boolean(result?.is_correct)} /> {option}</label>)}</div>
        {result && <p className={result.is_correct ? 'success' : 'error'} role="status">{result.is_correct ? 'Мир реагирует: задача завершена.' : 'Мир реагирует: можно попробовать ещё раз.'}<br />{result.explanation}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {result?.is_correct ? <button className="primary" type="button" onClick={onClose}>Вернуться в локацию</button> : <button className="primary" type="button" onClick={submit} disabled={!answer || busy}>{busy ? 'Отправляем…' : 'Проверить решение'}</button>}
      </>}
      {!result?.is_correct && <button type="button" onClick={onClose}>Закрыть</button>}
    </section>
  </div>
}
