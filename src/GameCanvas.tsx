import { useEffect, useRef } from 'react'
import { locationFor } from './world'

interface GameCanvasProps { directionSlug: string, onInteract: () => void, onExit: () => void, blocked?: boolean }

export function GameCanvas({ directionSlug, onInteract, onExit, blocked = false }: GameCanvasProps) {
  const host = useRef<HTMLDivElement>(null)
  const onInteractRef = useRef(onInteract)
  const onExitRef = useRef(onExit)
  const blockedRef = useRef(blocked)

  useEffect(() => { onInteractRef.current = onInteract }, [onInteract])
  useEffect(() => { onExitRef.current = onExit }, [onExit])
  useEffect(() => { blockedRef.current = blocked }, [blocked])

  useEffect(() => {
    let game: { destroy: (removeCanvas: boolean) => void } | undefined
    let cancelled = false

    const location = locationFor(directionSlug)
    void import('phaser').then(({ default: Phaser }) => {
      if (cancelled || !host.current) return

      class SliceScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Image
        private npc!: Phaser.GameObjects.Image
        private interaction!: Phaser.GameObjects.Image
        private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
        private action: 'npc' | 'exit' | undefined
        private facing = 'front'

        constructor() { super('slice') }

        preload() {
          if (location) { this.load.image('interior', location.interior); this.load.image('npc', location.npcBase) }
          this.load.image('interact', '/content/ui/ui_interact_e.png')
          for (const face of ['front', 'back', 'left', 'right']) this.load.image(`player-${face}`, `/content/characters/player/player_robot_${face}.png`)
        }

        create() {
          if (!location) return
          this.add.image(400, 250, 'interior').setDisplaySize(800, 500)
          this.player = this.add.image(180, 380, 'player-front').setOrigin(.5, 1)
          this.npc = this.add.image(location.npc.x, location.npc.y, 'npc').setOrigin(.5, 1)
          this.interaction = this.add.image(400, 300, 'interact').setDisplaySize(31, 31).setVisible(false).setDepth(1000)
          this.cursors = this.input.keyboard?.createCursorKeys()
          this.input.keyboard?.on('keydown-E', () => { if (blockedRef.current) return; if (this.action === 'npc') onInteractRef.current(); if (this.action === 'exit') onExitRef.current() })
        }

        update(_time: number, delta: number) {
          const keyboard = this.input.keyboard
          if (!keyboard || !this.cursors || !location || blockedRef.current) return
          const speed = .19 * delta
          let facing = this.facing
          if (this.cursors.left.isDown || keyboard.addKey('A').isDown) { this.player.x -= speed; facing = 'left' }
          if (this.cursors.right.isDown || keyboard.addKey('D').isDown) { this.player.x += speed; facing = 'right' }
          if (this.cursors.up.isDown || keyboard.addKey('W').isDown) { this.player.y -= speed; facing = 'back' }
          if (this.cursors.down.isDown || keyboard.addKey('S').isDown) { this.player.y += speed; facing = 'front' }
          if (facing !== this.facing) { this.facing = facing; this.player.setTexture(`player-${facing}`) }
          this.player.x = Phaser.Math.Clamp(this.player.x, 82, 718)
          this.player.y = Phaser.Math.Clamp(this.player.y, location.floor.top, location.floor.bottom)
          const scaleAt = (y: number) => location.scale.min + ((y - location.floor.top) / (location.floor.bottom - location.floor.top)) * (location.scale.max - location.scale.min)
          this.player.setScale(scaleAt(this.player.y)).setDepth(this.player.y)
          this.npc.setScale(scaleAt(this.npc.y)).setDepth(this.npc.y)
          const nearNpc = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npc.x, this.npc.y) < 86
          const nearExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, location.exit.x, location.exit.y) < 68
          this.action = nearNpc ? 'npc' : nearExit ? 'exit' : undefined
          this.interaction.setPosition(nearNpc ? this.npc.x : this.player.x, (nearNpc ? this.npc.y : this.player.y) - 65).setVisible(Boolean(this.action))
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        width: 800,
        height: 500,
        render: { antialias: true, pixelArt: false },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 800, height: 500 },
        backgroundColor: '#101829',
        scene: SliceScene,
      })
    })

    return () => { cancelled = true; game?.destroy(true) }
  }, [directionSlug])

  return <div className="game-canvas" ref={host} aria-label="Игровая сцена" />
}
