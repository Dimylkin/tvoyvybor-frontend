import { useEffect, useRef } from 'react'
import { locationFor } from './world'

interface GameCanvasProps {
  scenarioTitle: string
  directionSlug?: string
  onInteract: () => void
}

export function GameCanvas({ scenarioTitle, directionSlug, onInteract }: GameCanvasProps) {
  const host = useRef<HTMLDivElement>(null)
  const onInteractRef = useRef(onInteract)

  useEffect(() => { onInteractRef.current = onInteract }, [onInteract])

  useEffect(() => {
    let game: { destroy: (removeCanvas: boolean) => void } | undefined
    let cancelled = false

    const location = directionSlug ? locationFor(directionSlug) : undefined
    void import('phaser').then(({ default: Phaser }) => {
      if (cancelled || !host.current) return

      class SliceScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Image
        private npc!: Phaser.GameObjects.Image | Phaser.GameObjects.Arc
        private hint!: Phaser.GameObjects.Text
        private interaction!: Phaser.GameObjects.Image
        private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
        private wasNear = false
        private facing = 'front'

        constructor() { super('slice') }

        preload() {
          if (location) { this.load.image('interior', location.interior); this.load.image('npc', location.npcBase) }
          this.load.image('interact', '/content/ui/ui_interact_e.png')
          for (const face of ['front', 'back', 'left', 'right']) this.load.image(`player-${face}`, `/content/characters/player/player_robot_${face}.png`)
        }

        create() {
          if (location) this.add.image(400, 250, 'interior').setDisplaySize(800, 500)
          else this.add.rectangle(400, 250, 800, 500, 0x13213a)
          this.add.text(28, 25, scenarioTitle, { fontFamily: 'system-ui', fontSize: '21px', color: '#ffffff', stroke: '#172238', strokeThickness: 5 })
          this.player = this.add.image(150, 340, 'player-front').setDisplaySize(176, 216)
          this.npc = location ? this.add.image(location.npc.x, 270, 'npc').setDisplaySize(328, 416) : this.add.circle(620, 340, 96, 0xfbc977)
          this.interaction = this.add.image(620, 80, 'interact').setDisplaySize(52, 52).setVisible(false)
          this.hint = this.add.text(400, 465, '', { fontFamily: 'system-ui', fontSize: '16px', color: '#ffffff', stroke: '#172238', strokeThickness: 5 }).setOrigin(.5)
          this.cursors = this.input.keyboard?.createCursorKeys()
          this.input.keyboard?.on('keydown-E', () => { if (this.wasNear) onInteractRef.current() })
        }

        update(_time: number, delta: number) {
          const keyboard = this.input.keyboard
          if (!keyboard || !this.cursors) return
          const speed = .19 * delta
          let facing = this.facing
          if (this.cursors.left.isDown || keyboard.addKey('A').isDown) { this.player.x -= speed; facing = 'left' }
          if (this.cursors.right.isDown || keyboard.addKey('D').isDown) { this.player.x += speed; facing = 'right' }
          if (this.cursors.up.isDown || keyboard.addKey('W').isDown) { this.player.y -= speed; facing = 'back' }
          if (this.cursors.down.isDown || keyboard.addKey('S').isDown) { this.player.y += speed; facing = 'front' }
          if (facing !== this.facing) { this.facing = facing; this.player.setTexture(`player-${facing}`) }
          this.player.x = Phaser.Math.Clamp(this.player.x, 88, 712)
          this.player.y = Phaser.Math.Clamp(this.player.y, 108, 392)
          this.wasNear = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npc.x, this.npc.y) < 220
          this.interaction.setPosition(this.npc.x, this.npc.y - 210).setVisible(this.wasNear)
          this.hint.setText(this.wasNear ? 'E — поговорить с мастером и открыть задание' : '')
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
  }, [scenarioTitle, directionSlug])

  return <div className="game-canvas" ref={host} aria-label="Игровая сцена" />
}
