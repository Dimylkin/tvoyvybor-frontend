import { useEffect, useRef } from 'react'

interface CanvasProps { directionSlug?: string, onReady?: () => void }

declare global {
  var __testCanvasReadyEnabled: boolean | undefined
  var __testCanvasReadyCallbacks: Set<() => void> | undefined
}

function ReadyCanvas({ directionSlug, onReady, label }: CanvasProps & { label: string }) {
  const ready = useRef(false)
  useEffect(() => {
    if (ready.current) return
    const notifyReady = () => {
      if (ready.current) return
      ready.current = true
      onReady?.()
    }
    const pendingReadyCallbacks = globalThis.__testCanvasReadyCallbacks ??= new Set()
    if (globalThis.__testCanvasReadyEnabled !== false) notifyReady()
    else pendingReadyCallbacks.add(notifyReady)
    return () => { pendingReadyCallbacks.delete(notifyReady) }
  }, [onReady])
  return <div aria-label={label} data-direction={directionSlug} />
}

export function GameCanvas(props: CanvasProps) {
  return <ReadyCanvas {...props} label="Игровая сцена" />
}

export function CampusCanvas(props: CanvasProps) {
  return <ReadyCanvas {...props} label="Игровой кампус" />
}
