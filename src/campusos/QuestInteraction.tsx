import { useRef, useState } from 'react'
import type { ApiClient, Quest } from '../api'

export function QuestInteraction({ api, quest, target, close, reload, dialogue }: { api: ApiClient, quest: Quest | undefined, target: 'npc' | 'server' | 'terminal', close: () => void, reload: () => Promise<void>, dialogue: () => void }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [terminal, setTerminal] = useState<{ log: string, port: number } | null>(null)
  const [port, setPort] = useState(8000)
  const [message, setMessage] = useState('')
  const pending = useRef<{ key: string, id: string } | null>(null)
  async function run(action: () => Promise<unknown>, success: string) { setBusy(true); setError(''); try { await action(); await reload(); if (pending.current) { sessionStorage.removeItem(`quest-event:${pending.current.key}`); pending.current = null } setMessage(success) } catch (e) { setError(e instanceof Error && e.message === 'Configuration check failed' ? 'Проверка не прошла: порт сервера не совпадает с портом прокси.' : e instanceof Error ? e.message : 'Не удалось выполнить действие') } finally { setBusy(false) } }
  async function event(kind: string, targetKey: string, payload: Record<string, unknown> = {}) {
    const key = JSON.stringify([kind, targetKey, payload])
    if (!pending.current || pending.current.key !== key) pending.current = { key, id: sessionStorage.getItem(`quest-event:${key}`) ?? crypto.randomUUID() }
    sessionStorage.setItem(`quest-event:${key}`, pending.current.id)
    await api.interact(pending.current.id, kind, targetKey, payload)
  }
  const current = quest?.objectives.find((o) => !o.completed)
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Взаимодействие"><section className="panel quest-interaction">
    <h2>{target === 'npc' ? 'Борис Бэкендович' : target === 'server' ? 'Сервер' : 'Терминал'}</h2>
    {target === 'npc' && <><p>Сервер перестал отвечать. Я ничего не менял, честное слово! Поможете разобраться?</p><button type="button" onClick={dialogue}>Поговорить на другие темы</button>{quest && (quest.status === 'available' || quest.status === 'abandoned') && <><h3>{quest.title}</h3><p>{quest.description}</p><button disabled={busy} type="button" onClick={() => void run(async () => { await api.offerQuest(quest.id, 'boris'); await api.acceptQuest(quest.id) }, 'Задание принято.')}>Принять задание</button></>}{quest?.status === 'active' && current?.objective_type === 'npc_reported' && <button disabled={busy} type="button" onClick={() => void run(() => event('npc_reported', 'boris'), 'Задание завершено!')}>Доложить о восстановлении</button>}{quest?.status === 'completed' && <p>Спасибо, сервер снова отвечает!</p>}</>}
    {target === 'server' && <><p>Индикатор сервера горит красным. Похоже, запросы не доходят до приложения.</p><button disabled={busy || quest?.status !== 'active'} type="button" onClick={() => void run(() => event('object_inspected', 'backend_server'), 'Состояние сервера осмотрено. Теперь проверьте терминал.')}>Осмотреть</button></>}
    {target === 'terminal' && <>{!terminal ? <button disabled={busy} type="button" onClick={() => void run(async () => { const terminalId = sessionStorage.getItem('quest-terminal-request') ?? crypto.randomUUID(); sessionStorage.setItem('quest-terminal-request', terminalId); const state = await api.terminal(terminalId); sessionStorage.removeItem('quest-terminal-request'); if (current?.objective_type === 'terminal_investigated') await event('terminal_investigated', 'backend_terminal'); setTerminal(state) }, 'Диагностика загружена.')}>Изучить журнал</button> : <><pre>{terminal.log}</pre><label>Порт сервера <input type="number" min="1" max="65535" value={port} onChange={(e) => setPort(Number(e.target.value))} /></label><button disabled={busy} type="button" onClick={() => void run(() => event('terminal_problem_fixed', 'backend_terminal', { port }), 'Проверка прошла: сервер отвечает. Расскажите Борису.')}>Сохранить и проверить</button></>}</>}
    {message && <p role="status">{message}</p>}{error && <p className="error" role="alert">{error} Попробуйте ещё раз.</p>}<button type="button" onClick={close}>Закрыть</button>
  </section></div>
}
