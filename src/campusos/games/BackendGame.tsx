import { useEffect, useRef, useState } from 'react'
import type { GameProps } from '../QuestInteraction'
import { sampleCode } from '../questContent'
import './Investigation.css'
import { AssistantChat } from './AssistantChat'

const logs = [
  ['ok', '20:14:31 GET /api/users 200'], ['ok', '20:14:32 GET /api/profile 200'],
  ['ok', '20:14:32 POST /api/orders 201'], ['syntax', '20:14:34 ERROR OrderService · SyntaxError: unterminated string · orders/service.py:247'],
  ['error', '20:14:35 GET /api/orders 500'], ['ok', '20:14:36 GET /health/database 200'],
]
export function BackendGame({ quest, send, busy, userId = 0 }: GameProps) {
  const state = quest.gameplay!.state
  const draftKey = `quest-draft:${userId}:${quest.id}:${quest.accepted_at ?? "new"}`
  const [tab, setTab] = useState('Код')
  const [code, setCode] = useState(localStorage.getItem(`${draftKey}:code`) ?? state.code ?? 'def calculate_average(grades):\n    # напишите логику здесь\n    return 0')
  const [stream, setStream] = useState(0)
  const [tool, setTool] = useState('services')
  const [follow, setFollow] = useState(true)
  const [selectedLog, setSelectedLog] = useState<number | null>(null)
  const history = useRef<HTMLDivElement>(null)
  const [repair, setRepair] = useState(localStorage.getItem(`${draftKey}:repair`) ?? quest.gameplay!.state.repair_code ?? 'def order_status():\n    message = "Order created\n    return message')
  const editCode = (value: string) => { localStorage.setItem(`${draftKey}:code`, value); setCode(value) }
  const editRepair = (value: string) => { localStorage.setItem(`${draftKey}:repair`, value); setRepair(value) }
  useEffect(() => {
    if (code === state.code) localStorage.removeItem(`${draftKey}:code`)
    if (repair === state.repair_code) localStorage.removeItem(`${draftKey}:repair`)
  }, [code, repair, state.code, state.repair_code, draftKey])
  const [extraInput, setExtraInput] = useState('[0, null, 8]')
  const [paused, setPaused] = useState(false)
  const invoke = (action: string, payload?: Record<string, unknown>) => { void send(action, payload).catch(() => {}) }
  const logging = quest.gameplay!.kind === 'diagnosis' && state.seen.includes('logs')
  useEffect(() => { if (!logging || paused) return; const timer = window.setInterval(() => setStream(s => s + 1), 1100); return () => window.clearInterval(timer) }, [logging, paused])
  useEffect(() => { if (follow && history.current) history.current.scrollTop = history.current.scrollHeight }, [stream, follow, tool])
  useEffect(() => {
    if (busy) return
    const kind = quest.gameplay!.kind
    const action = kind === 'code' ? 'draft' : 'draft-repair'
    const value = kind === 'code' ? code : repair
    const saved = kind === 'code' ? state.code : state.repair_code
    if (value === saved || (kind === 'diagnosis' && !state.seen.includes('cause'))) return
    const timer = window.setTimeout(() => { void send(action, { value }).catch(() => {}) }, 800)
    return () => window.clearTimeout(timer)
  }, [code, repair, state.code, state.repair_code, state.seen, quest.gameplay, send, busy])
  if (quest.gameplay!.kind === 'code') return <>
    <nav className="task-tabs">{['Код', 'Документация', 'AI-помощник'].map(t => <button type="button" aria-pressed={t === tab} onClick={() => setTab(t)} key={t}>{t}</button>)}</nav>
    {tab === 'Код' && <div className={`code-workspace${state.tests || state.success ? ' code-workspace-with-results' : ''}`}><div className="code-editor-pane"><p>Среднее чисел без None. Пустой список → 0. Оценка 0 учитывается.</p><label className="task-editor"><textarea spellCheck={false} value={code} onChange={e => editCode(e.target.value)} onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); const start = e.currentTarget.selectionStart, end = e.currentTarget.selectionEnd; editCode(code.slice(0, start) + '    ' + code.slice(end)); const area = e.currentTarget; requestAnimationFrame(() => { area.selectionStart = area.selectionEnd = start + 4 }) } }} aria-label="Код Python" /></label><div className="task-actions"><button type="button" disabled={busy} onClick={() => invoke('run', { value: code })}>Запустить тесты</button><button type="button" disabled={busy} onClick={() => invoke('draft', { value: code })}>Сохранить черновик</button></div><p>Черновик сохраняется автоматически. Тесты тоже сохраняют код.</p></div><aside className="code-tools-pane">{state.success && <div className="task-card"><label>Другой набор оценок (JSON)<input aria-label="Дополнительные оценки" value={extraInput} onChange={e => setExtraInput(e.target.value)} /></label><button type="button" disabled={busy} onClick={() => invoke('explore', { key: 'input', value: extraInput })}>Проверить свой набор</button>{state.extra_result && <p className="inline-result" role="status">{state.extra_result}</p>}</div>}{state.tests && <details className="code-tests" open={!state.success}><summary>Проверки: {state.tests?.filter(test => test.passed).length ?? 0} из {state.tests?.length ?? 0} пройдены</summary><div className="code-test-results">{state.tests?.map((test, i) => <article key={i} className={`task-card ${test.passed ? 'task-success' : 'error'}`}>Test {i + 1} · {test.passed ? 'passed' : 'failed'}<pre>{JSON.stringify(test.input)} → {test.detail}</pre></article>)}</div></details>}</aside></div>}
    {tab === 'Документация' && <article className="task-card"><h3>Учебный Python</h3><p>Доступны числа, списки, присваивания, + − * /, if, for, return, sum, len, append и списковое включение. Отступ внутри функции — четыре пробела. Это ограниченный учебный редактор.</p><pre>{'values = []\nfor value in grades:\n    if value is not None:\n        values.append(value)'}</pre><p>sum(values) складывает оценки; len(values) считает их. Делить на ноль нельзя. Проверяйте пустые входные данные до деления.</p></article>}
    {<div className="chat-pane" hidden={tab !== 'AI-помощник'}><AssistantChat questions={state.assistant_questions ?? []} exampleShown={Boolean(state.example_shown)} busy={busy} ask={key => send('assistant-question', { key })} useExample={() => { void send('use-example').then(() => { editCode(sampleCode); setTab('Код') }).catch(() => {}) }} /></div>}
  </>
  const diagnosticTabs = [['services', 'Сервисы'], ['deploy', 'Деплой'], ['logs', 'Логи'], ...(state.seen.includes('anomaly') ? [['hypothesis', 'Гипотеза']] : []), ...(state.seen.includes('cause') ? [['repair', 'Исправление']] : []), ...(state.seen.includes('patched') ? [['verify', 'Проверка API']] : [])]
  const selectedEntry = selectedLog === null ? null : logs[selectedLog % logs.length]
  return <>
    <nav className="task-tabs" aria-label="Инструменты диагностики">{diagnosticTabs.map(([value, text]) => <button key={value} type="button" aria-pressed={tool === value} onClick={() => { setTool(value); if (['services', 'deploy', 'logs'].includes(value)) invoke('inspect', { value }) }}>{text}</button>)}</nav>
    {tool === 'services' && <div className="task-metrics"><article className={`task-card ${state.success ? 'task-success' : 'error'}`}>API<br />{state.success ? 'ONLINE · 200' : 'ERROR · 500'}</article><article className="task-card task-success">DATABASE<br />ONLINE</article><article className="task-card task-success">CACHE<br />ONLINE</article><button type="button" disabled={busy} onClick={() => invoke('inspect', { value: 'services' })}>Обновить состояние сервисов</button></div>}
    {tool === 'deploy' && <article className="task-card"><h3>История релизов</h3><table className="task-table"><thead><tr><th>Релиз</th><th>Время</th><th>Изменение</th></tr></thead><tbody><tr><td>orders-1.8</td><td>20:14:33</td><td>OrderService · текст ответа</td></tr><tr><td>orders-1.7</td><td>18:02:11</td><td>Обработка заказов</td></tr></tbody></table></article>}
    {tool === 'logs' && <section className="terminal-panel"><header><span>LIVE LOGS · {paused ? 'ПАУЗА' : 'В ЭФИРЕ'}</span><button type="button" onClick={() => setPaused(!paused)}>{paused ? 'Продолжить поток' : 'Пауза потока'}</button></header><div ref={history} className="investigation-log-history" aria-label="История логов" onScroll={e => { const el = e.currentTarget; setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24) }}>{Array.from({ length: Math.min(stream + 1, 180) }, (_, i) => { const index = Math.max(0, stream - 179) + i; const [id, text] = logs[index % logs.length]; return <button aria-pressed={selectedLog === index} className={id === 'syntax' || id === 'error' ? 'log-error' : ''} type="button" key={index} onClick={() => { setSelectedLog(index); invoke('log', { value: id }) }}>{text}</button> })}</div><footer><small>{follow ? 'Автоследование включено' : 'Вы изучаете историю · новые записи поступают'}</small>{!follow && <button type="button" onClick={() => setFollow(true)}>К новым сообщениям ↓</button>}</footer><div className="investigation-log-detail"><strong>Выбранная запись</strong>{selectedEntry ? <pre>{selectedEntry[1]}</pre> : <p>Нажмите на запись, чтобы закрепить её здесь.</p>}</div></section>}
    {tool === 'hypothesis' && <article className="task-card"><h3>Что проверим?</h3><p>Сопоставьте выбранную запись, время релиза и состояние сервисов.</p><div className="task-actions">{[['database', 'База данных'], ['release', 'Изменение OrderService'], ['auth', 'Авторизация'], ['network', 'Сеть']].map(([value, text]) => <button disabled={busy} key={value} type="button" onClick={() => { void send('hypothesis', { value }).then(() => { if (value === 'release') setTool('repair') }).catch(() => {}) }}>{text}</button>)}</div></article>}
    {tool === 'repair' && <article className="task-card"><label className="task-editor">orders/service.py · строки 246–248<textarea aria-label="Исправление OrderService" spellCheck={false} value={repair} onChange={e => editRepair(e.target.value)} /></label><button type="button" disabled={busy} onClick={() => invoke('repair', { value: repair })}>Применить изменение</button><p>Черновик сохраняется после остановки ввода. Применение проверит синтаксис; затем проверьте API.</p></article>}
    {tool === 'verify' && <article className="task-card"><h3>Проверить работу API</h3><p>Отправим тестовый заказ и посмотрим, отвечает ли сервер.</p><button type="button" disabled={busy} onClick={() => invoke('verify')}>Проверить API</button>{state.success && <div className="task-actions"><span>Можно проверить соседний endpoint:</span>{['/api/profile', '/api/users'].map(value => <button key={value} type="button" disabled={busy} onClick={() => invoke('explore', { key: 'endpoint', value })}>GET {value}</button>)}</div>}</article>}
  </>
}
