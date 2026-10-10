import { useEffect, useRef } from 'react'

interface GameCanvasProps {
  scenarioTitle: string
  onInteract: () => void
}

export function GameCanvas({ scenarioTitle, onInteract }: GameCanvasProps) {
  const host = useRef<HTMLDivElement>(null)
  const onInteractRef = useRef(onInteract)

  useEffect(() => { onInteractRef.current = onInteract }, [onInteract])

  useEffect(() => {
    let game: { destroy: (removeCanvas: boolean) => void } | undefined
    let cancelled = false

    void import('phaser').then(({ default: Phaser }) => {
      if (cancelled || !host.current) return

      class SliceScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Rectangle
        private npc!: Phaser.GameObjects.Arc
        private hint!: Phaser.GameObjects.Text
        private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
        private wasNear = false

        constructor() { super('slice') }

        create() {
          this.add.rectangle(400, 250, 800, 500, 0x13213a)
          this.add.rectangle(400, 420, 800, 160, 0x1e3551)
          this.add.text(34, 30, scenarioTitle, { fontFamily: 'system-ui', fontSize: '22px', color: '#e8eef9' })
          this.add.text(34, 65, 'Исследуйте локацию: стрелки или WASD', { fontFamily: 'system-ui', fontSize: '15px', color: '#afc0dc' })
          this.player = this.add.rectangle(150, 340, 28, 36, 0x7cd9db).setStrokeStyle(2, 0xe8eef9)
          this.npc = this.add.circle(620, 340, 32, 0xfbc977).setStrokeStyle(3, 0x402d12)
          this.add.text(580, 390, 'NPC: дежурный API', { fontFamily: 'system-ui', fontSize: '14px', color: '#fbe1a9' })
          this.hint = this.add.text(400, 465, '', { fontFamily: 'system-ui', fontSize: '16px', color: '#e8eef9' }).setOrigin(.5)
          this.cursors = this.input.keyboard?.createCursorKeys()
          this.input.keyboard?.on('keydown-E', () => { if (this.wasNear) onInteractRef.current() })
        }

        update(_time: number, delta: number) {
          const keyboard = this.input.keyboard
          if (!keyboard || !this.cursors) return
          const speed = .19 * delta
          const left = this.cursors.left.isDown || keyboard.addKey('A').isDown
          const right = this.cursors.right.isDown || keyboard.addKey('D').isDown
          const up = this.cursors.up.isDown || keyboard.addKey('W').isDown
          const down = this.cursors.down.isDown || keyboard.addKey('S').isDown
          if (left) this.player.x -= speed
          if (right) this.player.x += speed
          if (up) this.player.y -= speed
          if (down) this.player.y += speed
          this.player.x = Phaser.Math.Clamp(this.player.x, 25, 775)
          this.player.y = Phaser.Math.Clamp(this.player.y, 115, 425)
          this.wasNear = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npc.x, this.npc.y) < 88
          this.hint.setText(this.wasNear ? 'Нажмите E, чтобы поговорить и открыть задание' : '')
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        width: 800,
        height: 500,
        backgroundColor: '#101829',
        scene: SliceScene,
      })
    })

    return () => { cancelled = true; game?.destroy(true) }
  }, [scenarioTitle])

  return <div className="game-canvas" ref={host} aria-label="Игровая сцена" />
}
