import { useEffect, useRef, useState } from 'react'
import type { Achievement, ApiClient, GameActionResult, Quest } from '../api'
import { Dialogue } from '../Dialogue'
import type { WorldLocation } from '../world'
import { codeAnswers, debriefs, finalReactions, introductions, interestQuestions, reminders } from './questContent'
import { BackendGame } from './games/BackendGame'
import { FrontendGame } from './games/FrontendGame'
import { AnalyticsGame } from './games/AnalyticsGame'
import { QuestCompleteBanner, TaskStatus } from './TaskStatus'
import type { ActivityHistory } from '../api'
import './task-ui.css'

export interface GameProps { userId?: number, quest: Quest, send: (action: string, payload?: Record<string, unknown>) => Promise<void>, busy: boolean }

const pendingQuestRequestIds = new Map<string, string>()

function storedRequestId(key: string): string | null {
  try { return sessionStorage.getItem(key) } catch { return null }
}

function storeRequestId(key: string, requestId: string) {
  try { sessionStorage.setItem(key, requestId) } catch { /* keep the retry id in memory */ }
}

function clearRequestId(key: string) {
  pendingQuestRequestIds.delete(key)
  try { sessionStorage.removeItem(key) } catch { /* storage may be disabled */ }
}

function useQuestAction(api: ApiClient, quest: Quest | undefined, reload: () => Promise<void>, onAwards: (awards: Achievement[]) => void, userId: number) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  async function send(action: string, payload: Record<string, unknown> = {}) {
    if (!quest || lock.current) return
    lock.current = true; setBusy(true); setError('')
    const key = `minigame:${userId}:${quest.id}:${quest.accepted_at ?? "new"}:${JSON.stringify([action, payload])}`
    try {
      const requestId = pendingQuestRequestIds.get(key) ?? storedRequestId(key) ?? crypto.randomUUID()
      pendingQuestRequestIds.set(key, requestId)
      storeRequestId(key, requestId)
      const result: GameActionResult = await api.questAction(quest.id, requestId, action, payload)
      await reload()
      clearRequestId(key)
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

const smallTalk = {
  analytics: {
    prompt: 'Привет. Осваиваешься?',
    replies: ['Да, понемногу.', 'Пока разбираюсь.', 'Да. Тут гораздо больше всего, чем я ожидал.'],
    reactions: ['Хорошо. Если цифры начнут вести себя подозрительно — зови.', 'Понимаю. Я обычно начинаю с уточнения: что именно пока непонятно?', 'Это наблюдение или уже гипотеза? Ладно, пока просто освоимся.'],
  },
  backend: {
    prompt: 'Привет. Уже успел заглянуть в серверную?',
    replies: ['Пока только осматриваюсь.', 'Да. Логи выглядят почти дружелюбно.', 'Ещё нет. С чего тут обычно начинают?'],
    reactions: ['Нормальный порядок. Сначала понять, где стоишь, потом трогать прод.', '«Почти» — хорошая оценка для логов. Рад, что познакомились.', 'С простого вопроса и спокойного взгляда на систему. Пойдём без героизма.'],
  },
  frontend: {
    prompt: 'Привет! Как тебе кампус — уже нашёл что-нибудь красивое?',
    replies: ['Пока осматриваюсь.', 'Нашёл. Теперь хочется поправить пару отступов.', 'Пока больше смотрю, чем трогаю.'],
    reactions: ['Отличный первый шаг. Сначала композиция, потом пиксели.', 'Вот так и начинается: «пара отступов» — и внезапно новый макет.', 'Тоже хороший режим. Интерфейс сначала стоит рассмотреть целиком.'],
  },
} as const

const hintsByKind: Record<string, string[]> = {
  diagnosis: ['Сверь время деплоя с первой ошибкой в журнале.', 'База отвечает; найди сервис, который обращается к полю total.', 'Сначала исправь причину ошибки, затем проверь соседние запросы.'],
  responsive: ['Сравни ширину карточки с узким экраном.', 'Проверь, не расположены ли товары в один ряд без переноса.', 'Проверь, не закреплена ли кнопка поверх содержимого.'],
  ux: ['Попроси виртуального пользователя пройти форму без подсказки.', 'Проверь подпись кнопки и сообщения после ошибки.', 'Посмотри, хватает ли человеку подсказки к паролю и контроля видимости.'],
  interview: ['Сначала выясни, кто ждёт результат и к какому сроку.', 'Уточни, как сейчас собирают отчёт и какие поля нужны.', 'Сверь решение с повторяющейся ручной работой клиента.'],
  data: ['Сравни число заказов со средним чеком.', 'Открой источник самой крупной операции.', 'Проверь, не попал ли внутренний платёж в обычный отчёт.'],
  default: ['Проверь, что именно показывает результат действия.', 'Меняй по одному условию и сравнивай результат.', 'Используй журнал и документацию, чтобы проверить гипотезу.'],
}

function HintPanel({ kind, count, expanded, onToggle, onAsk, busy }: { kind: string, count: number, expanded: boolean, onToggle: () => void, onAsk: () => void, busy: boolean }) {
  const hints = hintsByKind[kind] ?? hintsByKind.default
  const shown = Math.min(count, hints.length)
  return <section className={`hint-panel${expanded ? ' is-expanded' : ''}`} aria-label="Подсказки">
    <button className="hint-panel-toggle" type="button" aria-expanded={expanded} onClick={onToggle}>Подсказки <span>{expanded ? '−' : '+'}</span></button>
    {expanded && <div className="hint-panel-content">
      {shown > 0 ? <><p className="hint-panel-count">Подсказка {shown} из {hints.length}</p><p>{hints[shown - 1]}</p>{shown > 1 && <details><summary>Предыдущие подсказки</summary><ol>{hints.slice(0, shown - 1).map((hint, index) => <li key={hint}>Подсказка {index + 1}: {hint}</li>)}</ol></details>}</> : <p>Сравни наблюдения и меняй по одной вещи. Подсказки не снижают оценку интереса.</p>}
      {shown < hints.length && <button disabled={busy} type="button" onClick={onAsk}>{busy ? 'Сохраняем…' : 'Попросить подсказку'}</button>}
    </div>}
  </section>
}

export function QuestConversation({ api, quests, location, close, reload, onAwards, userId }: Common & { quests: Quest[], location: WorldLocation }) {
  const active = quests.filter(q => q.status === 'active')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [topics, setTopics] = useState(false)
  const [greeted, setGreeted] = useState(false)
  const [greetingReply, setGreetingReply] = useState<string | null>(null)
  const [greetingReplyIndex, setGreetingReplyIndex] = useState<number | null>(null)
  const [deferred, setDeferred] = useState(false)
  const [farewell, setFarewell] = useState<{ text: string, emotion: 'friendly' | 'thinking' | 'sad' } | null>(null)
  const [reflectionQuest, setReflectionQuest] = useState<number | null>(null)
  const [reflectionItem, setReflectionItem] = useState<ActivityHistory | null>(null)
  const [reflectionDone, setReflectionDone] = useState(false)
  const [reflectionLoading, setReflectionLoading] = useState(false)
  const [reflectionError, setReflectionError] = useState('')
  const [reflectionBusy, setReflectionBusy] = useState(false)
  const reflectionLock = useRef(false)
  const [reflectionLoadError, setReflectionLoadError] = useState(false)
  const [reflectionRevision, setReflectionRevision] = useState(0)
  useEffect(() => {
    if (reflectionQuest === null || typeof api.activityProfile !== 'function') return
    let active = true
    setReflectionLoading(true); setReflectionError(''); setReflectionLoadError(false)
    api.activityProfile().then(p => { if (active) setReflectionItem(p.history.find(h => h.quest_id === reflectionQuest) ?? null) }).catch(() => { if (active) { setReflectionError('Не удалось загрузить вопрос.'); setReflectionLoadError(true) } }).finally(() => { if (active) setReflectionLoading(false) })
    return () => { active = false }
  }, [api, reflectionQuest, reflectionRevision])
  const [reactionLine, setReactionLine] = useState<{ value: string, text: string } | null>(null)
  const quest = active.find(q => q.id === selectedId) ?? active.find(q => q.tracked) ?? active[0]
  const { send, busy, error } = useQuestAction(api, quest, reload, onAwards, userId)
  if (topics) return <Dialogue location={location} onClose={close} onBack={quest?.gameplay ? () => setTopics(false) : undefined} />
  const invoke = (action: string, payload?: Record<string, unknown>) => { void send(action, payload).catch(() => {}) }
  const alternatives = active.length > 1 ? active.filter(q => q.id !== quest?.id).map(q => ({ text: `Продолжить «${q.title}»`, select: () => setSelectedId(q.id) })) : []
  const saveReflection = (response: 'repeat' | 'unsure', activityCode: string | null) => {
    if (reflectionQuest === null || reflectionLock.current) return
    const payload = { response, activity_code: activityCode, barrier: null }
    const key = `reflection:${userId}:${reflectionQuest}:${JSON.stringify(payload)}`
    const requestId = pendingQuestRequestIds.get(key) ?? storedRequestId(key) ?? crypto.randomUUID()
    pendingQuestRequestIds.set(key, requestId); storeRequestId(key, requestId)
    reflectionLock.current = true; setReflectionBusy(true); setReflectionError('')
    void api.reflectQuest(reflectionQuest, requestId, payload).then(() => {
      clearRequestId(key); setReflectionDone(true)
    }).catch(() => setReflectionError('Не удалось сохранить впечатление. Попробуй ещё раз.')).finally(() => { reflectionLock.current = false; setReflectionBusy(false) })
  }
  if (farewell && !reflectionDone && reflectionQuest !== null) {
    if (reflectionLoading) return <Dialogue location={location} onClose={close} scene={{ text: 'Подожди, загружаю вопрос о твоём впечатлении…', choices: [{ text: 'Пропустить вопрос', select: () => setReflectionDone(true) }] }} />
    if (reflectionLoadError) return <Dialogue location={location} onClose={close} scene={{ text: 'Не удалось загрузить вопрос о впечатлении.', error: reflectionError, choices: [{ text: 'Повторить', select: () => setReflectionRevision(v => v + 1) }, { text: 'Пропустить вопрос', select: () => setReflectionDone(true) }] }} />
    if (reflectionItem?.activities.length) return <Dialogue location={location} onClose={close} scene={{ text: 'Какое действие тебе хотелось бы попробовать ещё раз?', emotion: 'thinking', busy: reflectionBusy, error: reflectionError, choices: [...reflectionItem.activities.map(activity => ({ text: activity.label, select: () => saveReflection('repeat', activity.code) })), { text: 'Пока не знаю', select: () => saveReflection('unsure', null) }, { text: 'Пропустить вопрос', select: () => setReflectionDone(true) }] }} />
  }
  if (farewell) return <Dialogue location={location} onClose={close} scene={{ ...farewell, choices: [{ text: 'До встречи!', select: close }], advance: close }} />
  if (deferred) return <Dialogue location={location} onClose={close} scene={{ text: 'Эх… ладно. Если передумаешь — я здесь.', emotion: 'sad', choices: [{ text: 'До встречи!', select: close }], advance: close }} />
  if (!greeted && (!quest?.gameplay || quest.gameplay.state.stage === 'intro' && !quest.gameplay.state.intro_line)) {
    const greeting = smallTalk[location.slug as keyof typeof smallTalk] ?? smallTalk.analytics
    if (greetingReply) return <Dialogue location={location} onClose={close} scene={{ text: greetingReply, speaker: 'player', choices: [], advance: () => setGreeted(true) }} />
    return <Dialogue location={location} onClose={close} scene={{ text: greeting.prompt, emotion: 'friendly', canExit: true, choices: greeting.replies.map((text, index) => ({ text, select: () => { setGreetingReply(text); setGreetingReplyIndex(index) } })) }} />
  }
  if (greetingReply && greeted) {
    const greeting = smallTalk[location.slug as keyof typeof smallTalk] ?? smallTalk.analytics
    const reaction = greeting.reactions[greetingReplyIndex ?? 0]
    const next = quest?.gameplay?.state.stage === 'intro' ? 'К делу' : 'Выбрать тему'
    return <Dialogue location={location} onClose={close} scene={{ text: reaction, emotion: 'thinking', canExit: true, choices: [{ text: next, select: () => { setGreetingReply(null); if (!quest?.gameplay) setTopics(true) } }] }} />
  }
  if (!quest?.gameplay) return <Dialogue location={location} onClose={close} />
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
    if (reactionLine) return <Dialogue location={location} onClose={close} scene={{ text: reactionLine.text, speaker: 'player', busy, error, choices: [], advance: () => { void send('react', { value: reactionLine.value }).then(() => { if (reactionLine.value !== 'not-mine' && typeof api.activityProfile === 'function') { setReflectionLoading(true); setReflectionQuest(quest.id) } setFarewell({ text: finalReactions[kind][reactionLine.value === 'not-mine' ? 'negative' : reactionLine.value === 'enough' ? 'neutral' : 'positive'], emotion: reactionLine.value === 'not-mine' ? 'sad' : reactionLine.value === 'enough' ? 'thinking' : 'friendly' }) }).catch(() => {}) } }} />
    return <Dialogue location={location} onClose={close} scene={{ text: interestQuestions[kind], emotion: 'thinking', busy, error, choices: interestChoices.map(([value, text]) => ({ text, select: () => setReactionLine({ value, text }) })) }} />
  }
  return <Dialogue location={location} onClose={close} scene={{ text: 'Ну как, есть новости? Я пока здесь.', emotion: 'thinking', canExit: true, choices: [{ text: 'Пойду пробовать', select: close }, { text: 'Поговорим о профессии', select: () => setTopics(true) }, ...alternatives] }} />
}

export function QuestInteraction({ api, quest, close, reload, onAwards, userId, target, alternatives = [], selectQuest }: Common & { quest: Quest | undefined, target: 'server' | 'terminal', alternatives?: Quest[], selectQuest?: (id: number) => void }) {
  const { send, busy, error } = useQuestAction(api, quest, reload, onAwards, userId)
  const [help, setHelp] = useState(false)
  useEffect(() => { setHelp(false) }, [quest?.id])
  const state = quest?.gameplay?.state
  const invoke = (action: string, payload?: Record<string, unknown>) => { void send(action, payload).catch(() => {}) }
  return <div className="modal-backdrop task-backdrop" role="dialog" aria-modal="true" aria-label={quest?.title ?? 'Рабочая станция'}><section className={`panel task-window${target === 'server' ? ' task-server-window' : ''}`}>
    <header className="task-header"><div><span className="eyebrow">CAMPUS LAB / {quest?.location_slug.toUpperCase()}</span><h2>{target === 'server' ? 'Серверная стойка' : quest?.title ?? 'Рабочая станция'}</h2></div><div className="task-header-actions">{target === 'terminal' && state?.stage === 'mini-game' && quest?.gameplay?.kind !== 'code' && <HintPanel kind={quest?.gameplay?.kind ?? ''} count={state.hints} expanded={help} onToggle={() => setHelp(value => !value)} onAsk={() => invoke('hint')} busy={busy} />}<button type="button" onClick={close}>Закрыть станцию</button></div></header>
    <div className="task-body">
    {alternatives.length > 1 && <nav className="task-tabs" aria-label="Открыть задание">{alternatives.map(q => <button key={q.id} type="button" aria-pressed={q.id === quest?.id} onClick={() => selectQuest?.(q.id)}>{q.title}</button>)}</nav>}
    {!quest || !state ? <p>Выберите дело в телефоне → «Задачи» → «Начать задание».</p> : state.stage === 'intro' ? <p>Сначала поговорите с наставником: {quest.giver_npc_id === 'boris' ? 'Борисом' : quest.giver_npc_id === 'frontina' ? 'Фронтиной' : 'Анной'}.</p> : target === 'server' && quest.gameplay?.kind !== 'diagnosis' ? <><h3 className="task-success">API ● ONLINE</h3><p>Сервисы работают. Задача с функцией открывается на терминале за центральным столом.</p></> : target === 'server' ? <><h3 className={state.success ? 'task-success' : 'error'}>API {state.success ? '● ONLINE' : '● ERROR'}</h3><p>DATABASE ● ONLINE · CACHE ● ONLINE</p><p>{state.success ? 'Запросы снова проходят, индикатор зелёный.' : 'Красный индикатор только у API. За центральным столом терминал: там можно сравнить состояние сервисов и журнал.'}</p></> : state.stage === 'interaction' ? <><p>Инструменты готовы. Можно возвращаться к исследованию позже.</p><button type="button" disabled={busy} onClick={() => invoke('open')}>Начать работу на станции</button></> : <>
      {state.stage === 'return' ? <QuestCompleteBanner npc={quest.giver_npc_id === 'boris' ? 'Борису Бэкендовичу' : quest.giver_npc_id === 'frontina' ? 'Фронтине Пиксельевне' : 'Анне Литиковой'} /> : <div className="task-stage"><span>Исследование → гипотеза → проверка</span></div>}
      {(state.stage === 'mini-game' || state.stage === 'return') && <fieldset className="task-workspace">{quest.gameplay?.kind === 'diagnosis' || quest.gameplay?.kind === 'code' ? <BackendGame userId={userId} quest={quest} send={send} busy={busy} /> : quest.gameplay?.kind === 'responsive' || quest.gameplay?.kind === 'ux' ? <FrontendGame userId={userId} quest={quest} send={send} busy={busy} /> : <AnalyticsGame quest={quest} send={send} busy={busy} />}</fieldset>}
      {state.stage === 'result' && <p>Наставник ждёт ваше впечатление. Вернитесь к нему.</p>}
    </>}
    </div>
    <TaskStatus state={state} kind={quest?.gameplay?.kind} busy={busy} error={error} />
  </section></div>
}
