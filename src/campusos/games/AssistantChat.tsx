import { useEffect, useRef, useState } from 'react'
import { assistantQuestions } from './assistantContent'
import './casual-games.css'

interface Message { role: 'player' | 'assistant', text: string }
export function AssistantChat({ questions, exampleShown, busy, ask, useExample }: { questions: string[], exampleShown: boolean, busy: boolean, ask: (key: string) => Promise<void>, useExample: () => void }) {
  const [messages, setMessages] = useState<Message[]>(() => questions.flatMap(key => {
    const item = assistantQuestions.find(row => row[0] === key)
    return item ? [{ role: 'player', text: item[1] }, { role: 'assistant', text: item[2] }] : []
  }))
  const [typing, setTyping] = useState(false)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const history = useRef<HTMLDivElement>(null)
  const locked = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { if (history.current) history.current.scrollTop = history.current.scrollHeight }, [messages])
  useEffect(() => {
    if (!answer) return
    let index = 0
    const timer = window.setInterval(() => {
      index = Math.min(index + 8, answer.length)
      setMessages(rows => [...rows.slice(0, -1), { role: 'assistant', text: answer.slice(0, index) }])
      if (index >= answer.length) { window.clearInterval(timer); setTyping(false); setAnswer(''); locked.current = false }
    }, 24)
    return () => window.clearInterval(timer)
  }, [answer])
  async function submit(item: typeof assistantQuestions[number]) {
    if (busy || locked.current) return
    locked.current = true; setError(''); setTyping(true)
    setMessages(rows => [...rows, { role: 'player', text: item[1] }])
    try {
      await ask(item[0])
      if (!mounted.current) return
      setMessages(rows => [...rows, { role: 'assistant', text: '' }]); setAnswer(item[2])
    } catch {
      if (mounted.current) { setMessages(rows => rows.slice(0, -1)); setTyping(false); setError('Не удалось получить ответ. Выберите вопрос ещё раз.'); locked.current = false }
    }
  }
  return <section className="game-chat assistant-chat" aria-label="Чат с AI-помощником">
    <header><span className="chat-avatar">✦</span><div><strong>Помощник</strong><small>Разбираемся с функцией среднего балла</small></div></header>
    <div className="chat-history" ref={history} role="log" aria-label="История AI-чата" aria-live="polite" aria-busy={typing}>
      <p className="chat-bubble">Привет! Выбери, что разберём. Подсказки без штрафов.</p>
      {messages.map((message, i) => <p key={i} className={`chat-bubble ${message.role === 'player' ? 'chat-outgoing' : ''}`}>{message.text || '…'}</p>)}
      {typing && !answer && <p className="chat-bubble chat-typing">Помощник печатает…</p>}
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    <details open className="chat-questions"><summary>Выбрать вопрос</summary><div>{assistantQuestions.map(item => <button key={item[0]} type="button" disabled={busy || typing} onClick={() => { void submit(item) }}>{item[1]}</button>)}</div></details>
    {exampleShown && <div className="chat-example-action"><button type="button" disabled={busy || typing} onClick={useExample}>Взять пример в редактор и проверить</button></div>}
  </section>
}
