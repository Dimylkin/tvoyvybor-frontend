import type { ActivityProfile } from '../api'

const labels: Record<string, string> = {
  investigation: 'Искать причины', coding: 'Работать над кодом', verification: 'Проверять результат',
  interface: 'Менять интерфейс', users: 'Разбираться в действиях пользователя',
  requirements: 'Формулировать требования', data: 'Исследовать данные',
}
export function activityLabel(code: string): string { return labels[code] ?? 'Ранее выбранное действие' }
export function insightStatusText(status: ActivityProfile['insights'][number]['status']): string {
  if (status === 'repeated') return 'Этот интерес повторился в разных ситуациях.'
  if (status === 'mixed') return 'В разных ситуациях впечатления различались.'
  return 'Возможно, тебе интересно попробовать это снова.'
}
export function questStatus(status: string): string {
  return ({ completed: 'Завершено', abandoned: 'Отложено', active: 'В работе', available: 'Доступно', locked: 'Закрыто' } as Record<string, string>)[status] ?? status
}

export const careerTraitLabels: Record<string, string> = { code: 'Код', systems: 'Системы', data: 'Данные', interfaces: 'Интерфейсы', people: 'Люди', requirements: 'Требования', creation: 'Создание', analysis: 'Анализ', investigation: 'Поиск причин', fixing: 'Исправление', testing: 'Проверка', improvement: 'Улучшение', structuring: 'Структурирование', needs: 'Выявление потребностей', logical: 'Логический подход', systemic: 'Системный подход', creative: 'Творческий подход', details: 'Внимание к деталям', patterns: 'Закономерности', experiment: 'Эксперимент', independent: 'Самостоятельность', collaboration: 'Совместная работа' }
