import { useEffect, useRef, useState } from 'react'
import { Dialogue } from '../../Dialogue'
import { locationFor } from '../../world'
import type { GameProps } from '../QuestInteraction'
import { interviewQuestions } from '../questContent'
import './casual-games.css'

const blocks = [
  ['problem', 'Что мешает клиенту?', [['', 'Выберите проблему'], ['button', 'Не хватает большой кнопки'], ['manual', 'Два часа собирает и отправляет отчёт вручную'], ['design', 'Надоел внешний вид страницы']]],
  ['automation', 'Что изменим?', [['', 'Выберите действие'], ['export', 'Выгружать все данные по нажатию'], ['dashboard', 'Добавить экран с графиками'], ['weekly-report', 'Автоматически собирать недельный отчёт']]],
  ['data', 'Что попадёт в файл?', [['', 'Выберите данные'], ['all', 'Все заказы и контакты клиентов'], ['paid-csv', 'Оплаченные за неделю, CSV без личных данных'], ['total', 'Только общая сумма за всё время']]],
  ['delivery', 'Как доставим результат?', [['', 'Выберите доставку'], ['manual', 'Клиент сам скачает и перешлёт'], ['friday-director', 'Директору по пятницам к 16:00'], ['everyone', 'Всем сотрудникам каждый день']]],
] as const
export function CustomerChat({ quest, send, busy }: GameProps) {
  const state = quest.gameplay!.state
  const [tab, setTab] = useState('chat')
  const [submittedAt, setSubmittedAt] = useState<number | null>(null)
  const [reply, setReply] = useState<string | null>(null)
  const [mentorReply, setMentorReply] = useState(false)
  useEffect(() => {
    if (submittedAt !== null && state.attempts > submittedAt) {
      setMentorReply(!state.success); setReply(state.success ? state.feedback : 'Смотри: заказчику всё ещё придётся собирать отчёт руками или ждать его. Давай ещё раз сверимся с перепиской.'); setSubmittedAt(null)
    }
  }, [submittedAt, state.attempts, state.feedback, state.success])
  const [draft, setDraft] = useState<Record<string, string>>(state.proposal_draft ?? {})
  const [pending, setPending] = useState<string | null>(null)
  const [localHistory, setLocalHistory] = useState<string[]>(state.interview_history ?? (state.choices ?? []).filter(key => interviewQuestions.some(q => q[0] === key)))
  const history = useRef<HTMLDivElement>(null)
  useEffect(() => { if (history.current) history.current.scrollTop = history.current.scrollHeight }, [localHistory, pending, tab])
  async function ask(key: string) {
    if (busy || pending) return
    setPending(key)
    try { await send('question', { value: key }); setLocalHistory(rows => [...rows, key]) } catch { /* Shared action panel displays the error. */ }
    finally { setPending(null) }
  }
  return <div className="customer-workspace">
    <nav className="task-tabs"><button type="button" aria-pressed={tab === 'chat'} onClick={() => setTab('chat')}>Переписка</button><button type="button" aria-pressed={tab === 'solution'} onClick={() => setTab('solution')}>Собрать решение</button></nav>
    {tab === 'chat' ? <section className="game-chat" aria-label="Переписка с заказчиком"><header><span className="chat-avatar">М</span><div><strong>Михаил · заказчик</strong><small>Руководитель отдела</small></div></header><div ref={history} className="chat-history" role="log" aria-label="История переписки">
      <p className="chat-bubble">Здравствуйте! Нам нужна кнопка «Экспортировать всё».</p>
      {localHistory.map((key, i) => { const row = interviewQuestions.find(q => q[0] === key); return row && <div key={i}><p className="chat-bubble chat-outgoing">{row[1]}</p><p className="chat-bubble">{row[2]}</p></div> })}
      {pending && <p role="status" className="chat-bubble">Михаил отвечает…</p>}
    </div><details open className="chat-questions"><summary>Задать вопрос</summary><div>{interviewQuestions.map(([key, text]) => <button type="button" key={key} disabled={busy || !!pending} onClick={() => { void ask(key) }}>{text}{localHistory.includes(key) ? ' ↺' : ''}</button>)}</div></details></section> : <article className="task-card solution-builder"><h3>Предложение клиенту</h3><p>Соберите свой вариант из того, что выяснили. Ответы остаются в переписке.</p>{blocks.map(([key, title, options]) => <label key={key}>{title}<select value={draft[key] ?? ''} onChange={event => setDraft(values => ({ ...values, [key]: event.target.value }))}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}<p className="solution-preview">{blocks.map(([key, , options]) => options.find(option => option[0] === draft[key])?.[1]).filter(Boolean).join(' → ') || 'Ваше решение появится здесь.'}</p><button type="button" disabled={busy || blocks.some(([key]) => !draft[key])} onClick={() => { setSubmittedAt(state.attempts); void send('compose', { value: JSON.stringify(draft) }).catch(() => setSubmittedAt(null)) }}>Обсудить решение</button></article>}
    {reply && <div className="client-dialogue-backdrop"><Dialogue location={mentorReply ? locationFor('analytics')! : { ...locationFor('analytics')!, name: 'Михаил · заказчик' }} onClose={() => setReply(null)} scene={{ text: reply, ...(!mentorReply ? { avatarLabel: 'М' as const } : {}), choices: [{ text: mentorReply ? 'Хорошо, пересмотрю решение.' : 'Договорились.', select: () => { setReply(null); if (mentorReply) setTab('chat') } }] }} /></div>}
  </div>
}
