import type { GameState } from '../api'

export function TaskStatus({ state, kind, busy, error }: { state?: GameState, kind?: string, busy: boolean, error: string }) {
  let text = state?.feedback || 'Выберите задание и начните разговор с наставником.'
  let tone = 'info'
  if (kind === 'interview' && state?.proposal_draft) text = state.success ? 'Решение согласовано. Вернитесь к Анне.' : 'Клиенту нужно другое решение. Сверьтесь с перепиской.'
  else if (state?.stage === 'intro') text = 'Сначала обсудите дело с наставником.'
  else if (state?.stage === 'interaction') text = 'Станция готова к работе.'
  else if (state?.success && !state.extra_result) text = 'Проверка пройдена. Можно вернуться к наставнику.'
  else if (/^Рабочая станция готова/.test(text)) text = 'Инструменты готовы. Можно пробовать и проверять.'
  if (/ошиб|не хватает|нельзя|не объясняет|есть непроверенные|остановился|не достигнута|несовпадения|не подтверждают|не прош|невер|не удалось|другое решение|нужна дополнительная/i.test(text)) tone = 'warning'
  else if (state?.success || /согласован|пройдена|сохранён|обновлён/i.test(text)) tone = 'success'
  if (kind === 'code' && state?.assistant_questions?.length && !state.success) text = 'Ответ помощника — в переписке. Пример можно проверить в редакторе.'
  if (busy) { text = 'Сохраняем действие…'; tone = 'info' }
  if (error) { text = error; tone = 'error' }
  const icon = { info: '•', success: '✓', warning: '!', error: '×' }[tone]
  return <footer className="task-status" data-tone={tone} role={error ? 'alert' : 'status'} aria-live="polite" aria-label="Состояние задания"><span className="task-status-icon" aria-hidden="true">{icon}</span><span>{text}</span></footer>
}
