import { useEffect, useRef, useState } from 'react'
import type { WorldLocation } from './world'
import { playerAppearance } from './playerAppearance'

export interface DialogueScene { text: string, avatarLabel?: string, speaker?: 'npc' | 'player', emotion?: 'friendly' | 'thinking' | 'confused' | 'surprised' | 'sad', choices: { text: string, select: () => void }[], busy?: boolean, error?: string, advance?: () => void, canExit?: boolean }

export function Dialogue({ location, onClose, scene, onBack }: { location: WorldLocation, onClose: () => void, scene?: DialogueScene, onBack?: () => void }) {
  const [choice, setChoice] = useState<number | null>(null)
  const [speaker, setSpeaker] = useState<'npc' | 'player'>('npc')
  const panelRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    dialogRef.current?.focus()
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  const selected = choice === null ? undefined : location.choices[choice]
  const playerSpeaking = scene ? scene.speaker === 'player' : speaker === 'player' && selected !== undefined
  const name = playerSpeaking ? 'Стажёр Ноль' : location.name
  const text = scene?.text ?? (playerSpeaking ? selected?.text : selected?.reaction ?? location.greeting)
  const portrait = playerSpeaking ? playerAppearance.front : scene?.emotion ? `/content/characters/npcs/emotions/${location.slug}/${scene.emotion}.png` : selected ? `/content/characters/npcs/emotions/${location.slug}/${selected.emotion}.png` : location.portrait
  const advance = scene?.advance ?? (!scene && playerSpeaking ? () => setSpeaker('npc') : undefined)
  const current = useRef({ advance, busy: scene?.busy, close: onClose, back: onBack })
  useEffect(() => { current.current = { advance, busy: scene?.busy, close: onClose, back: onBack } })
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        event.preventDefault()
        if (buttons.length) buttons[index < 0 ? event.shiftKey ? buttons.length - 1 : 0 : (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus()
        else dialogRef.current?.focus()
        return
      }
      if (event.repeat || current.current.busy || (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]'))) return
      if ((event.code === 'Space' || event.key === 'Enter') && event.target instanceof HTMLElement && event.target.closest('button,a')) return
      if ((event.code === 'Space' || event.key === 'Enter') && current.current.advance) { event.preventDefault(); current.current.advance(); return }
      if (event.key === 'Escape') { event.preventDefault(); current.current.close(); return }
      if ((event.code === 'Space' || event.key === 'Enter') && current.current.back) { event.preventDefault(); current.current.back(); return }
      if (/^[1-9]$/.test(event.key)) { const button = panelRef.current?.querySelector<HTMLButtonElement>(`button[data-shortcut="${event.key}"]`); if (button) { event.preventDefault(); button.click() } }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])
  const choices = scene ? scene.choices : choice === null ? location.choices.map((item, index) => ({ text: item.text, select: () => { setChoice(index); setSpeaker('player') } })) : playerSpeaking ? [] : [{ text: 'Выбрать другую тему', select: () => setChoice(null) }]
  return <div ref={dialogRef} tabIndex={-1} className="dialogue-interface" role="dialog" aria-busy={Boolean(scene?.busy)} aria-modal="true" aria-label={`Разговор: ${location.name}`}>
    {!playerSpeaking && (choices.length > 0 || !scene || scene.canExit) && <div ref={panelRef} className="dialogue-choices" aria-label="Действия в диалоге">
      {choices.map((item, index) => <button key={item.text} disabled={scene?.busy} data-shortcut={String(index + 1)} type="button" onClick={item.select}><kbd>{index + 1}</kbd><span>{item.text}</span></button>)}
      {onBack && <button type="button" onClick={onBack}>К основному разговору</button>}
      {(!scene || scene.canExit) && <button className="dialogue-end" type="button" onClick={onClose}><kbd>Esc</kbd><span>До встречи</span></button>}
    </div>}
    <div onClick={() => { if (!scene?.busy) advance?.() }} className={`dialogue-overlay${playerSpeaking ? ' player-line' : ''}`}>
      {!playerSpeaking && (scene?.avatarLabel ? <span className="dialogue-avatar" role="img" aria-label={`Аватар ${name}`}>{scene.avatarLabel}</span> : <img src={portrait} alt={`Портрет ${name}`} />)}
      <div className="dialogue-copy"><strong>{name}</strong><p>{text}</p>{scene?.error && <p role="alert" className="error">{scene.error}</p>}</div>
      {playerSpeaking && <img src={portrait} alt={`Портрет ${name}`} />}
    </div>
  </div>
}
