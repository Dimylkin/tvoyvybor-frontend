import { locationFor } from './world'

export type CampusPosition = { x: number, y: number }
export type CampusEntry = { slug: string, position: CampusPosition }

export function returnPosition(slug: string, entry: CampusEntry | null): CampusPosition | undefined {
  if (entry?.slug === slug) return entry.position
  const portal = locationFor(slug)?.campusPortal
  return portal ? { x: portal.x, y: portal.y } : undefined
}
