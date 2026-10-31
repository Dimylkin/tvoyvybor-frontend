export const CAMPUS = { width: 800, height: 600, viewportWidth: 800, viewportHeight: 500 }
export const CAMERA = { zoom: 2.2, followSpeed: 4 }

type Point = { x: number, y: number }

export function cameraPosition(current: Point, player: Point, delta: number, world: { width: number, height: number } = CAMPUS, zoom = CAMERA.zoom): Point {
  const halfWidth = CAMPUS.viewportWidth / (2 * zoom)
  const halfHeight = CAMPUS.viewportHeight / (2 * zoom)
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
  const targetX = clamp(player.x, halfWidth, world.width - halfWidth)
  const targetY = clamp(player.y - 16, halfHeight, world.height - halfHeight)
  const blend = 1 - Math.exp(-CAMERA.followSpeed * Math.max(0, delta) / 1000)
  return { x: current.x + (targetX - current.x) * blend, y: current.y + (targetY - current.y) * blend }
}
