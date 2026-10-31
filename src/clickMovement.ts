export type Point = { x: number, y: number }

export function moveToward(position: Point, target: Point, distance: number): Point {
  const dx = target.x - position.x, dy = target.y - position.y
  const remaining = Math.hypot(dx, dy)
  if (remaining <= distance || remaining === 0) return target
  return { x: position.x + dx / remaining * distance, y: position.y + dy / remaining * distance }
}
