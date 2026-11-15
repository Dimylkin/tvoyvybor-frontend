import { useEffect, useRef, useState, type ReactNode } from 'react'

function ControlArea({ position, children }: { position: 'top' | 'bottom', children: ReactNode }) {
  const [visible, setVisible] = useState(true)
  const timer = useRef<number | undefined>(undefined)
  function cancelHide() { if (timer.current !== undefined) window.clearTimeout(timer.current); timer.current = undefined }
  function scheduleHide() { cancelHide(); timer.current = window.setTimeout(() => { setVisible(false); timer.current = undefined }, 2500) }
  useEffect(() => { timer.current = window.setTimeout(() => { setVisible(false); timer.current = undefined }, 2500); return () => { if (timer.current !== undefined) window.clearTimeout(timer.current) } }, [])
  return <div className={`world-control-area world-control-${position}${visible ? ' is-visible' : ''}`} onPointerEnter={() => { cancelHide(); setVisible(true) }} onPointerLeave={scheduleHide} onFocus={() => { cancelHide(); setVisible(true) }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) scheduleHide() }}>{children}</div>
}

export function WorldControls({ fullscreen, toggleFullscreen, openPhone, isAdmin }: { fullscreen: boolean, toggleFullscreen: () => void, openPhone: () => void, isAdmin: boolean }) {
  return <>
    <ControlArea position="top">{isAdmin && <a href="#/admin">Администрирование</a>}<button type="button" onClick={toggleFullscreen}>{fullscreen ? 'Свернуть' : 'На весь экран'}</button></ControlArea>
    <ControlArea position="bottom"><button type="button" onClick={openPhone}>Телефон · Tab</button></ControlArea>
  </>
}
