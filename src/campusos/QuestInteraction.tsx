import { useEffect, useRef, useState } from 'react'
import type { Achievement, ApiClient, GameActionResult, Quest } from '../api'
import { Dialogue } from '../Dialogue'
import type { WorldLocation } from '../world'
import { codeAnswers, debriefs, finalReactions, introductions, interestQuestions, reminders } from './questContent'
import { BackendGame } from './games/BackendGame'
import { FrontendGame } from './games/FrontendGame'
import { AnalyticsGame } from './games/AnalyticsGame'
import { TaskStatus } from './TaskStatus'
import './task-ui.css'

export interface GameProps { userId?: number, quest: Quest, send: (action: string, payload?: Record<string, unknown>) => Promise<void>, busy: boolean }

function useQuestAction(api: ApiClient, quest: Quest | undefined, reload: () => Promise<void>, onAwards: (awards: Achievement[]) => void, userId: number) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  async function send(action: string, payload: Record<string, unknown> = {}) {
    if (!quest || lock.current) return
    lock.current = true; setBusy(true); setError('')
    const key = `minigame:${userId}:${quest.id}:${quest.accepted_at ?? "new"}:${JSON.stringify([action, payload])}`
    const requestId = sessionStorage.getItem(key) ?? crypto.randomUUID()
    sessionStorage.setItem(key, requestId)
    try {
      const result: GameActionResult = await api.questAction(quest.id, requestId, action, payload)
      await reload()
      sessionStorage.removeItem(key)
      onAwards(result.awards)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить действие. Повторите его.')
      throw cause
    } finally { setBusy(false); lock.current = false }
  }
  const questId = quest?.id
  const questStatus = quest?.status
  useEffect(() => {
    if (!questId || questStatus !== 'active') return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !lock.current) {
        void api.questAction(questId, crypto.randomUUID(), 'engage').catch(() => {})
      }
    }, 30000)
    return () => window.clearInterval(timer)
  }, [api, questId, questStatus])
  return { send, busy, error, setError }
}

interface Common { api: ApiClient, close: () => void, reload: () => Promise<void>, onAwards: (awards: Achievement[]) => void, userId: number }

const interestChoices = [['more', 'Я бы ещё покопался в этом.'], ['interesting', 'Неплохо, было интересно.'], ['not-mine', 'Идею понял, но это не моё.'], ['enough', 'Нормально, но пока не уверен.']] as const

export function QuestConversation({ api, quests, location, close, reload, onAwards, userId }: Common & { quests: Quest[], location: WorldLocation }) {
  const active = quests.filter(q => q.status === 'active')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [topics, setTopics] = useState(false)
  const [greeted, setGreeted] = useState(false)
  const [greetingReply, setGreetingReply] = useState<string | null>(null)
  const [deferred, setDeferred] = useState(false)
  const [farewell, setFarewell] = useState<{ text: string, emotion: 'friendly' | 'thinking' | 'sad' } | null>(null)
  const [reactionLine, setReactionLine] = useState<{ value: string, text: string } | null>(null)
  const quest = active.find(q => q.id === selectedId) ?? active.find(q => q.tracked) ?? active[0]
  const { send, busy, error } = useQuestAction(api, quest, reload, onAwards, userId)
  if (topics) return <Dialogue location={location} onClose={close} onBack={() => setTopics(false)} />
  const invoke = (action: string, payload?: Record<string, unknown>) => { void send(action, payload).catch(() => {}) }
  const alternatives = active.length > 1 ? active.filter(q => q.id !== quest?.id).map(q => ({ text: `Продолжить «${q.title}»`, select: () => setSelectedId(q.id) })) : []
  if (farewell) return <Dialogue location={location} onClose={close} scene={{ ...farewell, choices: [{ text: 'До встречи!', select: close }], advance: close }} />
  if (deferred) return <Dialogue location={location} onClose={close} scene={{ text: 'Эх… ладно. Если передумаешь — я здесь.', emotion: 'sad', choices: [{ text: 'До встречи!', select: close }], advance: close }} />
  if (!greeted && (!quest?.gameplay || quest.gameplay.state.stage === 'intro' && !quest.gameplay.state.intro_line)) {
    if (greetingReply) return <Dialogue location={location} onClose={close} scene={{ text: greetingReply, speaker: 'player', choices: [], advance: () => setGreeted(true) }} />
    return <Dialogue location={location} onClose={close} scene={{ text: location.slug === 'analytics' ? 'Привет. Осваиваешься?' : 'О, привет! Как дела?', emotion: 'friendly', canExit: true, choices: ['Привет! Нормально.', 'Нормально. Что случилось?'].map(text => ({ text, select: () => setGreetingReply(text) })) }} />
  }
  if (!quest?.gameplay) return <Dialogue location={location} onClose={close} scene={{ text: 'Есть минутка поболтать?', emotion: 'friendly', canExit: true, choices: [{ text: 'Как тебе здесь работается?', select: () => setTopics(true) }] }} />
  const state = quest.gameplay.state
  const kind = quest.gameplay.kind
  if (state.stage === 'intro' || state.stage === 'return') {
    const intro = state.stage === 'intro'
    const lines = intro ? introductions[kind] : debriefs[kind]
    const line = Math.min(intro ? state.intro_line ?? 0 : state.debrief_line ?? 0, lines.length - 1)
    let current = { ...lines[line], emotion: lines.slice(0, line + 1).reverse().find(l => l.emotion)?.emotion }
    if (!intro && kind === 'code') {
      const answer = codeAnswers.find(row => row[0] === state.code_answer)
      if (line === 0) return <Dialogue location={location} onClose={close} scene={{ ...current, busy, error, choices: codeAnswers.map(([value, text]) => ({ text, select: () => invoke('debrief-answer', { value }) })) }} />
      if (answer) current = { ...current, text: answer[line === 1 ? 1 : 2] }
    }
    if (intro && (line === 4 || state.intro_deferred)) {
      const select = () => invoke(state.intro_deferred ? 'intro-resume' : 'intro-line', { value: '5' })
      return <Dialogue location={location} onClose={close} scene={{ text: state.intro_deferred ? reminders[kind] : current.text, emotion: 'thinking', busy, error, choices: [
        { text: lines[5].text, select },
        { text: 'Не, давай потом.', select: () => { void send('intro-defer').then(() => setDeferred(true)).catch(() => {}) } },
      ] }} />
    }
    if (!intro && line === lines.length - 1) return <Dialogue location={location} onClose={close} scene={{ ...current, text: `${current.text} ${interestQuestions[kind]}`, busy, error, choices: interestChoices.map(([value, text]) => ({ text, select: () => { void send('report').then(() => setReactionLine({ value, text })).catch(() => {}) } })) }} />
    if (intro && line === lines.length - 1) return <Dialogue location={location} onClose={close} scene={{ ...current, busy, error, choices: [{ text: 'Пойду посмотрю.', select: () => { void send('intro-complete').then(close).catch(() => {}) } }] }} />
    const next = lines[line + 1]
    const advance = () => invoke(next ? intro ? 'intro-line' : 'dialogue-line' : intro ? 'intro-complete' : 'report', next ? { value: String(line + 1), ...(!intro ? { key: 'debrief' } : {}) } : {})
    return <Dialogue location={location} onClose={close} scene={{ ...current, busy, error, advance: next?.speaker === 'player' && current.speaker !== 'player' ? undefined : advance, choices: next?.speaker === 'player' && current.speaker !== 'player' ? [{ text: next.text, select: advance }] : [], canExit: line === 0 }} />
  }
  if (state.stage === 'result') {
    if (reactionLine) return <Dialogue location={location} onClose={close} scene={{ text: reactionLine.text, speaker: 'player', busy, error, choices: [], advance: () => { void send('react', { value: reactionLine.value }).then(() => setFarewell({ text: finalReactions[kind][reactionLine.value === 'not-mine' ? 'negative' : reactionLine.value === 'enough' ? 'neutral' : 'positive'], emotion: reactionLine.value === 'not-mine' ? 'sad' : reactionLine.value === 'enough' ? 'thinking' : 'friendly' })).catch(() => {}) } }} />
    return <Dialogue location={location} onClose={close} scene={{ text: interestQuestions[kind], emotion: 'thinking', busy, error, choices: interestChoices.map(([value, text]) => ({ text, select: () => setReactionLine({ value, text }) })) }} />
  }
  return <Dialogue location={location} onClose={close} scene={{ text: 'Ну как, есть новости? Я пока здесь.', emotion: 'thinking', canExit: true, choices: [{ text: 'Пойду пробовать', select: close }, { text: 'Поговорим о профессии', select: () => setTopics(true) }, ...alternatives] }} />
}

export function QuestInteraction({ api, quest, close, reload, onAwards, userId, target, alternatives = [], selectQuest }: Common & { quest: Quest | undefined, target: 'server' | 'terminal', alternatives?: Quest[], selectQuest?: (id: number) => void }) {
  const { send, busy, error } = useQuestAction(api, quest, reload, onAwards, userId)
  const [help, setHelp] = useState(false)
  const state = quest?.gameplay?.state
  const invoke = (action: string, payload?: Record<string, unknown>) => { void send(action, payload).catch(() => {}) }
  return <div className="modal-backdrop task-backdrop" role="dialog" aria-modal="true" aria-label={quest?.title ?? 'Рабочая станция'}><section className={`panel task-window${target === 'server' ? ' task-server-window' : ''}`}>
    <header className="task-header"><div><span className="eyebrow">CAMPUS LAB / {quest?.location_slug.toUpperCase()}</span><h2>{target === 'server' ? 'Серверная стойка' : quest?.title ?? 'Рабочая станция'}</h2></div><button type="button" onClick={close}>Закрыть станцию</button></header>
    <div className="task-body">
    {alternatives.length > 1 && <nav className="task-tabs" aria-label="Открыть задание">{alternatives.map(q => <button key={q.id} type="button" aria-pressed={q.id === quest?.id} onClick={() => selectQuest?.(q.id)}>{q.title}</button>)}</nav>}
    {!quest || !state ? <p>Выберите дело в телефоне → «Задачи» → «Начать задание».</p> : state.stage === 'intro' ? <p>Сначала поговорите с наставником: {quest.giver_npc_id === 'boris' ? 'Борисом' : quest.giver_npc_id === 'frontina' ? 'Фронтиной' : 'Анной'}.</p> : target === 'server' && quest.gameplay?.kind !== 'diagnosis' ? <><h3 className="task-success">API ● ONLINE</h3><p>Сервисы работают. Задача с функцией открывается на терминале за центральным столом.</p></> : target === 'server' ? <><h3 className={state.success ? 'task-success' : 'error'}>API {state.success ? '● ONLINE' : '● ERROR'}</h3><p>DATABASE ● ONLINE · CACHE ● ONLINE</p><p>{state.success ? 'Запросы снова проходят, индикатор зелёный.' : 'Красный индикатор только у API. За центральным столом терминал: там можно сравнить состояние сервисов и журнал.'}</p></> : state.stage === 'interaction' ? <><p>Инструменты готовы. Можно возвращаться к исследованию позже.</p><button type="button" disabled={busy} onClick={() => invoke('open')}>Начать работу на станции</button></> : <>
      <div className="task-stage"><span>{state.stage === 'return' ? '✓ Проверка пройдена · вернитесь к NPC' : 'Исследование → гипотеза → проверка'}</span></div>
      {(state.stage === 'mini-game' || state.stage === 'return') && <fieldset className="task-workspace">{quest.gameplay?.kind === 'diagnosis' || quest.gameplay?.kind === 'code' ? <BackendGame userId={userId} quest={quest} send={send} busy={busy} /> : quest.gameplay?.kind === 'responsive' || quest.gameplay?.kind === 'ux' ? <FrontendGame userId={userId} quest={quest} send={send} busy={busy} /> : <AnalyticsGame quest={quest} send={send} busy={busy} />}</fieldset>}
      {state.stage === 'result' && <p>Наставник ждёт ваше впечатление. Вернитесь к нему.</p>}
      <button type="button" hidden={state.stage !== 'mini-game' || quest.gameplay?.kind === 'code'} onClick={() => setHelp(!help)}>Подсказки {help ? '−' : '+'}</button>{help && quest.gameplay?.kind !== 'code' && <div className="task-card"><p>Наблюдайте, сравнивайте, меняйте по одной вещи и проверяйте результат. Подсказки не снижают оценку интереса.</p><button disabled={busy} type="button" onClick={() => invoke('hint')}>Попросить подсказку</button>{state.hints > 0 && <p>{quest.gameplay?.kind === 'diagnosis' ? 'Проверьте время деплоя и красную запись SyntaxError. База отвечает, поэтому начните с OrderService.' : quest.gameplay?.kind === 'responsive' ? 'Фиксированная ширина не помещается на мобильном экране. Проверьте также row и absolute.' : quest.gameplay?.kind === 'interview' ? 'Кто, зачем, какие данные, формат, боль и расписание — выясните их до предложения решения.' : quest.gameplay?.kind === 'data' ? 'Сравните число заказов и средний чек. В операциях ищите крупный внутренний источник.' : 'Запустите проверку и посмотрите, на каком шаге проблема. Документация и AI доступны в редакторе.'}</p>}</div>}
    </>}
    </div>
    <TaskStatus state={state} kind={quest?.gameplay?.kind} busy={busy} error={error} />
  </section></div>
}
