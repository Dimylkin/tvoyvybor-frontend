import { useState } from 'react'
import type { GameProps } from '../QuestInteraction'
import './frontend-workbench.css'
import './casual-games.css'

const defaults = { button: 'EXECUTE', error: 'ERROR 0xF14', hint: 'none', reveal: 'hide', order: 'password-first' }
const improvements = {
  button: { title: 'Что написано на кнопке?', choices: [['Зарегистрироваться', 'Зарегистрироваться'], ['Продолжить', 'Продолжить'], ['Выполнить', 'Выполнить'], ['EXECUTE', 'Оставить EXECUTE']] },
  error: { title: 'Как помочь после ошибки в адресе?', choices: [['Проверьте адрес: нужен символ @', 'Проверьте адрес: нужен символ @'], ['Что-то пошло не так', 'Что-то пошло не так'], ['ERROR 0xF14', 'Оставить технический код']] },
  hint: { title: 'Что нужно знать о пароле?', choices: [['Не менее 8 символов', 'Не менее 8 символов'], ['Надёжный пароль', 'Придумайте надёжный пароль'], ['none', 'Оставить без подсказки']] },
  reveal: { title: 'Как проверить опечатку в пароле?', choices: [['show', 'Добавить «Показать пароль»'], ['hide', 'Всегда скрывать символы']] },
  order: { title: 'В каком порядке заполнять?', choices: [['email-first', 'Сначала почта, затем пароль'], ['password-first', 'Сначала пароль, затем почта']] },
} as const
export function RegistrationGame({ quest, send, busy }: GameProps) {
  const state = quest.gameplay!.state
  const [properties, setProperties] = useState<Record<string, string>>({ ...defaults, ...state.properties })
  const [selected, setSelected] = useState<keyof typeof improvements>('button')
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const p = properties
  async function choose(value: string) {
    if (saving || busy) return
    setSaving(true); setError('')
    try { await send('property', { key: selected, value }); setProperties(rows => ({ ...rows, [selected]: value })) }
    catch { setError('Не удалось сохранить правку. Попробуйте ещё раз.') }
    finally { setSaving(false) }
  }
  return <div className="registration-game"><p>Человек застрял на регистрации. Нажимайте на элементы формы и пробуйте сделать их понятнее.</p>
    <div className="registration-workspace"><section className="workbench-form casual-form" aria-label="Форма регистрации"><div className="device-browser">campus.id / регистрация</div><h3>Создать аккаунт</h3>
      <button type="button" className="form-hotspot order-hotspot" aria-pressed={selected === 'order'} onClick={() => setSelected('order')}>↕ Порядок полей</button>
      <div className="workbench-fields" style={{ flexDirection: p.order === 'email-first' ? 'column' : 'column-reverse' }}><label>Почта<input readOnly value="student.campus" /></label><label>Пароль<input readOnly type={visible ? 'text' : 'password'} value="campus!234" /></label></div>
      <button type="button" className="form-hotspot" aria-pressed={selected === 'hint'} onClick={() => setSelected('hint')}>{p.hint === 'none' ? 'Пароль: никаких подсказок' : p.hint}</button>
      <button type="button" className="form-hotspot" aria-pressed={selected === 'reveal'} onClick={() => { setSelected('reveal'); if (p.reveal === 'show') setVisible(!visible) }}>{p.reveal === 'show' ? visible ? 'Скрыть пароль' : 'Показать пароль' : 'Пароль скрыт навсегда ●●●'}</button>
      <button type="button" className="form-hotspot error" aria-pressed={selected === 'error'} onClick={() => setSelected('error')}>{p.error}</button>
      <button type="button" className="mock-cta" aria-pressed={selected === 'button'} onClick={() => setSelected('button')}>{p.button}</button>
    </section><aside className="task-card improvement-picker"><h3>{improvements[selected].title}</h3><div className="task-question-list">{improvements[selected].choices.map(([value, text]) => <button type="button" key={value} disabled={saving || busy} aria-pressed={p[selected] === value} onClick={() => { void choose(value) }}>{text}</button>)}</div><p>Изменение сразу появится в форме. Не уверены? Можно попробовать другой вариант.</p>{error && <p role="alert" className="error">{error}</p>}
    <button type="button" disabled={saving || busy} onClick={() => { void send('simulate').catch(() => {}) }}>Попросить пользователя попробовать</button>
    {state.user_trace && <section className="task-card" aria-label="Результат проверки формы"><h3>{state.success ? 'Получилось зарегистрироваться!' : 'Где человек застрял'}</h3><ol>{state.user_trace.map(row => <li key={row.step} className={row.passed ? 'task-success' : 'error'}>{row.passed ? '✓' : '○'} {row.message}</li>)}</ol>{!state.success && <button type="button" onClick={() => setSelected(state.user_trace!.at(-1)!.step as keyof typeof improvements)}>Показать этот элемент</button>}</section>}
    </aside></div>
  </div>
}
