const labels: Record<string, string> = {
  investigation: 'Искать причины', coding: 'Работать над кодом', verification: 'Проверять результат',
  interface: 'Менять интерфейс', users: 'Разбираться в действиях пользователя',
  requirements: 'Формулировать требования', data: 'Исследовать данные',
}
export function activityLabel(code: string): string { return labels[code] ?? 'Ранее выбранное действие' }
export function questStatus(status: string): string {
  return ({ completed: 'Завершено', abandoned: 'Отложено', active: 'В работе', available: 'Доступно', locked: 'Закрыто' } as Record<string, string>)[status] ?? status
}
