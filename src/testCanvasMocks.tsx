import { useEffect, useRef } from 'react'

interface CanvasProps { directionSlug?: string, onReady?: () => void }

function ReadyCanvas({ directionSlug, onReady, label }: CanvasProps & { label: string }) {
  const ready = useRef(false)
  useEffect(() => {
    if (ready.current) return
    ready.current = true
    onReady?.()
  }, [onReady])
  return <div aria-label={label} data-direction={directionSlug} />
}

export function GameCanvas(props: CanvasProps) {
  return <ReadyCanvas {...props} label="Игровая сцена" />
}

export function CampusCanvas(props: CanvasProps) {
  return <ReadyCanvas {...props} label="Игровой кампус" />
}
