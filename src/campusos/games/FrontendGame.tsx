import { useEffect, useRef, useState } from 'react'
import type { GameProps } from '../QuestInteraction'
import './frontend-workbench.css'
import { RegistrationGame } from './RegistrationGame'

const defaults: Record<string, string> = { width: '600px', layout: 'row', position: 'absolute', gap: '16', fontSize: '16', button: 'EXECUTE', error: 'ERROR CODE 0x01F42', hint: 'none', reveal: 'hide', order: 'password-first', emailLabel: 'EMAIL', passwordLabel: 'PASSWORD' }
const viewports: Record<string, number> = { Desktop: 960, Tablet: 600, Mobile: 320, 'Узкий экран': 280 }
export function FrontendGame(props: GameProps) { return props.quest.gameplay!.kind === 'ux' ? <RegistrationGame key={props.quest.id} {...props} /> : <Workbench key={props.quest.id} {...props} /> }
function Workbench({ quest, send, userId = 0 }: GameProps) {
  const state = quest.gameplay!.state
  const responsive = quest.gameplay!.kind === 'responsive'
  const draftKey = `quest-draft:${userId}:${quest.id}:${quest.accepted_at ?? "new"}:properties`
  const draft = useRef<Record<string, string>>(JSON.parse(localStorage.getItem(draftKey) ?? '{}'))
  const [properties, setProperties] = useState({ ...defaults, ...state.properties, ...draft.current })
  const [device, setDevice] = useState('Desktop')
  const [element, setElement] = useState(responsive ? 'card' : 'button')
  const [mode, setMode] = useState<'edit' | 'use'>('edit')
  const [email, setEmail] = useState('student.campus')
  const [password, setPassword] = useState('campus!2')
  const [visible, setVisible] = useState(false)
  const [sawPassword, setSawPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [hadTypo, setHadTypo] = useState(false)
  const [playback, setPlayback] = useState<number | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const checkingRef = useRef(false)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout) }, [])
  const saved = useRef({ ...defaults, ...state.properties })
  const pending = useRef(Promise.resolve())
  const queue = (operation: () => Promise<void>) => {
    pending.current = pending.current.catch(() => {}).then(operation)
    void pending.current.catch(() => {})
    return pending.current
  }
  const saveProperty = (key: string, value: string) => queue(async () => {
    if (saved.current[key] === value) return
    setSaving(true); setSaveError('')
    try { await send('property', { key, value }); saved.current[key] = value; if (draft.current[key] === value) { delete draft.current[key]; localStorage.setItem(draftKey, JSON.stringify(draft.current)) } }
    catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Не удалось сохранить правку'); throw cause }
    finally { setSaving(false) }
  })
  const edit = (key: string, value: string) => {
    setPlayback(null)
    draft.current[key] = value; localStorage.setItem(draftKey, JSON.stringify(draft.current))
    setProperties(p => ({ ...p, [key]: value }))
    clearTimeout(timers.current[key])
    if (value.trim() && (key !== 'width' || /^\d+$/.test(value) && Number(value) >= 40 && Number(value) <= 100)) {
      timers.current[key] = setTimeout(() => { void saveProperty(key, value).catch(() => {}) }, 500)
    }
  }
  const change = (key: string, value: string) => { edit(key, value); void saveProperty(key, value).catch(() => {}) }
  const flush = async () => {
    Object.values(timers.current).forEach(clearTimeout)
    for (const [key, value] of Object.entries(properties)) if ((responsive ? ['width', 'layout', 'position', 'gap', 'fontSize'] : ['button', 'error', 'hint', 'reveal', 'order', 'emailLabel', 'passwordLabel']).includes(key)) await saveProperty(key, value)
  }
  const action = (name: string, payload?: Record<string, unknown>) => { if (checkingRef.current) return; checkingRef.current = true; setChecking(true); void (async () => { await flush(); await queue(() => send(name, payload)) })().catch(() => {}).finally(() => { checkingRef.current = false; setChecking(false) }) }
  const chooseDevice = (name: string) => { setDevice(name); if (name !== 'Узкий экран') action('device', { value: name }) }
  const p = properties
  const width = viewports[device]
  const cardWidth = p.width === '600px' ? 600 : p.width === 'auto' ? '100%' : `${Number.parseFloat(p.width)}%`
  const textField = (key: string, title: string) => <label>{title}<input maxLength={100} value={p[key]} onChange={e => edit(key, e.target.value)} onBlur={() => { void saveProperty(key, p[key]).catch(() => {}) }} /></label>
  const numericField = (key: string, title: string, min: number, max: number) => <label>{title}<span className="workbench-range"><input type="range" min={min} max={max} value={p[key]} onChange={e => edit(key, e.target.value)} onPointerUp={() => { void saveProperty(key, p[key]).catch(() => {}) }} onKeyUp={() => { void saveProperty(key, p[key]).catch(() => {}) }} /><input type="number" aria-label={title} min={min} max={max} value={p[key]} onChange={e => edit(key, e.target.value)} onBlur={() => { const n = Math.max(min, Math.min(max, Number(p[key]) || min)); change(key, String(n)) }} /></span></label>
  const selector = (key: string, title: string, options: [string, string][]) => <label>{title}<select value={p[key]} onChange={e => change(key, e.target.value)}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const registrationValid = validEmail && password.length >= 8
  const playStep = (index: number) => {
    setPlayback(index)
    setMode('use')
    if (index === 0) {
      setEmail(''); setPassword(''); setSubmitted(false); setVisible(false)
      formRef.current?.querySelector<HTMLInputElement>('[aria-label="Проверочный email"]')?.focus()
    } else if (index === 1) {
      formRef.current?.querySelector<HTMLButtonElement>('.mock-cta')?.focus()
    } else if (index === 2) {
      setEmail('student.campus'); setPassword('campus!234'); setSubmitted(true)
      formRef.current?.querySelector<HTMLInputElement>('[aria-label="Проверочный email"]')?.focus()
    } else if (index === 3) {
      setEmail('student@campus.ru'); setPassword('1234'); setSubmitted(true)
      formRef.current?.querySelector<HTMLInputElement>('[aria-label="Проверочный пароль"]')?.focus()
    } else {
      setEmail('student@campus.ru'); setPassword('campus!234')
      setVisible(properties.reveal === 'show'); setSubmitted(properties.reveal === 'show')
    }
  }
  const runUser = () => {
    if (checkingRef.current) return
    checkingRef.current = true; setChecking(true); setPlayback(null)
    void (async () => {
      await flush()
      await queue(() => send('simulate'))
      setHadTypo(false); setSawPassword(false)
      playStep(0)
    })().catch(() => {}).finally(() => { checkingRef.current = false; setChecking(false) })
  }
  const currentUserStep = playback === null ? undefined : state.user_trace?.[playback]
  const playbackMessages: Record<string, string> = {
    order: 'Пользователь ищет поле адреса перед паролем.',
    button: `Пользователь читает действие «${properties.button}».`,
    error: 'Пользователь отправил student.campus. Смотрите ошибку у формы.',
    hint: 'Адрес исправлен. Пароль 1234 слишком короткий: пользователь ищет подсказку.',
    reveal: 'Пользователь исправляет пароль и показывает символы перед регистрацией.',
  }
  const submit = () => {
    if (mode === 'edit') { setElement('button'); return }
    setSubmitted(true)
    if (!registrationValid) setHadTypo(true)
    if (state.success && hadTypo && sawPassword && registrationValid && p.reveal === 'show') action('explore', { key: 'form', value: 'typo-corrected' })
  }
  return <div className="frontend-workbench">
    {!responsive && currentUserStep && <section className="task-card" aria-label="Прогон виртуального пользователя"><p role="status">Шаг {(playback ?? 0) + 1}: {playbackMessages[currentUserStep.step]}</p>{!currentUserStep.passed ? <p className="error">Пользователь остановился: {currentUserStep.message} Исправьте прототип и повторите прогон.</p> : playback! < state.user_trace!.length - 1 ? <button type="button" onClick={() => playStep(playback! + 1)}>Следующее действие пользователя</button> : <p className="task-success">Пользователь заполнил форму и создал аккаунт.</p>}</section>}
    <nav className="task-tabs" aria-label={responsive ? 'Размер экрана' : 'Режим прототипа'}>{responsive ? Object.keys(viewports).filter(d => state.success || d !== 'Узкий экран').map(d => <button type="button" key={d} aria-pressed={device === d} onClick={() => chooseDevice(d)}>{d}{state.checked?.includes(d) ? ' ✓' : ''}</button>) : <><button type="button" aria-pressed={mode === 'edit'} onClick={() => { setMode('edit'); setPlayback(null) }}>Редактировать</button><button type="button" aria-pressed={mode === 'use'} onClick={() => setMode('use')}>Использовать форму</button></>}</nav>
    <div className="frontend-workspace"><section className="workbench-preview" aria-label="Предпросмотр">
      {responsive ? <><p className="eyebrow">{device} · {width}px · выберите карточку, список или кнопку</p><div className="workbench-scroll"><div className="workbench-device" style={{ width }}><div className="device-browser">● ● ● campus.shop</div><div className="workbench-viewport"><article className={`workbench-card ${element === 'card' ? 'workbench-selected' : ''}`} style={{ width: cardWidth, fontSize: Number(p.fontSize), position: 'relative' }} onClick={() => setElement('card')}><h3>Кампус-маркет</h3><p>Всё для нового семестра. Выберите товары и оформите заказ.</p><div role="button" tabIndex={0} aria-label="Выбрать список карточек" className={`workbench-products ${element === 'list' ? 'workbench-selected' : ''}`} onClick={e => { e.stopPropagation(); setElement('list') }} onKeyDown={e => { if (e.key === 'Enter') setElement('list') }} style={{ flexDirection: p.layout === 'column' ? 'column' : 'row', flexWrap: p.layout === 'wrap' ? 'wrap' : 'nowrap', gap: Number(p.gap) }}>{['☕ Кружка · 450 ₽', '▤ Блокнот · 250 ₽'].map(text => <div className="workbench-product" key={text}>{text}</div>)}</div><button type="button" className={`mock-cta ${element === 'cta' ? 'workbench-selected' : ''}`} style={{ position: p.position as 'absolute' | 'static' | 'relative', bottom: p.position === 'absolute' ? 24 : undefined, right: p.position === 'absolute' ? 12 : undefined }} onClick={e => { e.stopPropagation(); setElement('cta') }}>Оформить заказ</button></article></div></div></div></> : <><p className="eyebrow">{mode === 'edit' ? 'Выберите элемент для настройки' : 'Проверьте ввод и отправку формы'}</p><div ref={formRef} className="workbench-form"><div className="device-browser">campus.id / регистрация</div><h3>Создать аккаунт</h3><div className="workbench-fields" style={{ flexDirection: p.order === 'email-first' ? 'column' : 'column-reverse' }}><label onClick={() => { if (mode === 'edit') setElement('emailLabel') }}>{p.emailLabel}<input readOnly={mode === 'edit'} value={email} onChange={e => { setPlayback(null); setEmail(e.target.value); setSubmitted(false) }} aria-label="Проверочный email" /></label><label onClick={() => { if (mode === 'edit') setElement('passwordLabel') }}>{p.passwordLabel}<input readOnly={mode === 'edit'} value={password} onChange={e => { setPlayback(null); setPassword(e.target.value); setSubmitted(false) }} type={visible ? 'text' : 'password'} aria-label="Проверочный пароль" /></label></div>{!(submitted && validEmail && password.length < 8) && <p className={element === 'hint' && mode === 'edit' ? 'workbench-selected' : ''} onClick={() => { if (mode === 'edit') setElement('hint') }}>{p.hint === 'none' ? (mode === 'edit' ? 'Место для подсказки к паролю' : '') : p.hint}</p>}{p.reveal === 'show' && <button type="button" onClick={() => mode === 'edit' ? setElement('reveal') : (() => { setVisible(!visible); if (!visible) setSawPassword(true) })()}>{visible ? 'Скрыть пароль' : 'Показать пароль'}</button>}{submitted && <p role="status" className={registrationValid ? 'task-success' : 'error'}>{!validEmail ? p.error : password.length < 8 ? p.hint === 'none' ? 'ERROR CODE 0x02' : p.hint : 'Аккаунт создан в прототипе'}</p>}<button type="button" className={`mock-cta ${element === 'button' && mode === 'edit' ? 'workbench-selected' : ''}`} onClick={submit}>{p.button}</button></div></>}
    </section><aside className="workbench-inspector"><h3>Инспектор</h3>{responsive ? <><nav className="task-tabs">{[['card', 'Карточка'], ['list', 'Список'], ['cta', 'Кнопка']].map(([key, label]) => <button type="button" key={key} aria-pressed={element === key} onClick={() => setElement(key)}>{label}</button>)}</nav>{element === 'card' && <><label>Ширина карточки, %<input type="number" min={40} max={100} placeholder="600px · фиксированная" value={p.width === '600px' ? '' : Number.parseFloat(p.width) || 100} onChange={e => edit('width', e.target.value)} onBlur={() => change('width', String(Math.max(40, Math.min(100, Number.parseFloat(p.width) || 100))))} /></label><small>Текущая ширина: {p.width === '600px' ? '600px' : p.width === 'auto' ? 'auto' : `${p.width}%`}</small>{numericField('fontSize', 'Размер текста, px', 12, 24)}</>}{element === 'list' && <>{selector('layout', 'Расположение', [['row', 'В ряд'], ['column', 'В колонку'], ['wrap', 'С переносом']])}{numericField('gap', 'Интервал, px', 0, 40)}</>}{element === 'cta' && selector('position', 'Расположение кнопки', [['absolute', 'Поверх содержимого'], ['static', 'После содержимого'], ['relative', 'В потоке с отступом']])}<p>Проверьте выход за край экрана, читаемость и перекрытия. Каждый размер проверяется с текущими настройками.</p></> : <><nav className="task-tabs">{[['button', 'Действие'], ['error', 'Ошибка'], ['hint', 'Пароль'], ['order', 'Поля']].map(([key, label]) => <button type="button" key={key} aria-pressed={element === key} onClick={() => setElement(key)}>{label}</button>)}</nav>{element === 'button' && textField('button', 'Подпись кнопки')}{element === 'error' && <>{textField('error', 'Сообщение при неверном email')}<small>Укажите, что исправить в адресе: например, символ @ или формат email.</small></>}{(element === 'hint' || element === 'reveal') && <>{textField('hint', 'Требования к паролю')}{selector('reveal', 'Видимость пароля', [['hide', 'Всегда скрыт'], ['show', 'Добавить переключатель']])}</>}{['order', 'emailLabel', 'passwordLabel'].includes(element) && <>{textField('emailLabel', 'Название поля адреса')}{textField('passwordLabel', 'Название поля пароля')}<p>Порядок сверху вниз: {p.order === 'email-first' ? 'адрес → пароль' : 'пароль → адрес'}</p><button type="button" onClick={() => change('order', p.order === 'email-first' ? 'password-first' : 'email-first')}>↕ Переставить поля</button></>}<small>Проверка принимает понятные формулировки. Кнопка описывает создание аккаунта; подсказка — минимальную длину пароля.</small></>}<button type="button" disabled={checking} onClick={() => { void flush().catch(() => {}) }}>{saving ? 'Сохраняем…' : 'Сохранить изменения'}</button>{saveError && <p role="alert" className="error">{saveError}</p>}</aside></div>
    <div className="task-actions"><button type="button" disabled={checking} onClick={() => !responsive ? runUser() : device === 'Узкий экран' ? action('explore', { key: 'viewport', value: '280' }) : action('verify')}>{responsive ? device === 'Узкий экран' ? 'Проверить ширину 280px' : 'Проверить макет' : 'Запустить виртуального пользователя'}</button></div>
    {!responsive && state.user_trace && <details><summary>Путь виртуального пользователя</summary><ol className="workbench-user-flow">{state.user_trace.map(row => <li key={row.step} className={row.passed ? 'task-success' : 'error'}>{row.passed ? '✓' : '○'} {row.message}</li>)}</ol></details>}
    {!responsive && state.success && <p>Можно продолжить: в режиме использования отправьте форму с опечаткой, покажите пароль, исправьте данные и отправьте ещё раз.</p>}
  </div>
}
