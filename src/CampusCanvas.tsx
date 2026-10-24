import { useEffect, useRef } from 'react'
import type { Direction } from './api'
import { locationFor } from './world'

export function CampusCanvas({ directions, onEnter }: { directions: Direction[], onEnter: (direction: Direction) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const enterRef = useRef(onEnter)
  useEffect(() => { enterRef.current = onEnter }, [onEnter])
  useEffect(() => {
    if (typeof Element === 'undefined') return
    let game: { destroy: (removeCanvas: boolean) => void } | undefined
    let cancelled = false
    void import('phaser').then(({ default: Phaser }) => {
      if (cancelled || !host.current) return
      const portals = directions.flatMap((direction) => {
        const location = locationFor(direction.slug)
        return location ? [{ direction, ...location.campusPortal }] : []
      })
      class CampusScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Image
        private prompt!: Phaser.GameObjects.Text
        private interaction!: Phaser.GameObjects.Image
        private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
        private current?: typeof portals[number]
        private facing = 'front'
        constructor() { super('campus') }
        preload() {
          this.load.image('campus', '/content/backgrounds/campus_main.png')
          for (const face of ['front', 'back', 'left', 'right']) this.load.image(`player-${face}`, `/content/characters/player/player_robot_${face}.png`)
          this.load.image('interact', '/content/ui/ui_interact_e.png')
          this.load.image('marker', '/content/ui/ui_quest_marker.png')
        }
        create() {
          this.add.image(400, 250, 'campus').setDisplaySize(800, 500)
          this.add.text(28, 25, 'Кампус ТвойВыбор.exe', { fontFamily: 'system-ui', fontSize: '21px', color: '#ffffff', stroke: '#172238', strokeThickness: 5 })
          this.add.text(28, 52, 'Стрелки / WASD — движение. E — войти в корпус.', { fontFamily: 'system-ui', fontSize: '14px', color: '#ffffff', stroke: '#172238', strokeThickness: 4 })
          portals.forEach((portal) => { this.add.image(portal.x, portal.y - 52, 'marker').setDisplaySize(34, 42) })
          this.add.text(682, 468, 'DevOps\nскоро', { align: 'center', fontFamily: 'system-ui', fontSize: '13px', color: '#d5dce9', stroke: '#172238', strokeThickness: 4 }).setOrigin(.5)
          this.player = this.add.image(400, 410, 'player-front').setDisplaySize(44, 54)
          this.interaction = this.add.image(400, 390, 'interact').setDisplaySize(34, 34).setVisible(false)
          this.prompt = this.add.text(400, 466, '', { fontFamily: 'system-ui', fontSize: '16px', color: '#fff', stroke: '#172238', strokeThickness: 5 }).setOrigin(.5)
          this.cursors = this.input.keyboard?.createCursorKeys()
          this.input.keyboard?.on('keydown-E', () => { if (this.current) enterRef.current(this.current.direction) })
        }
        update(_time: number, delta: number) {
          const keyboard = this.input.keyboard
          if (!keyboard || !this.cursors) return
          const speed = .18 * delta
          let nextFacing = this.facing
          if (this.cursors.left.isDown || keyboard.addKey('A').isDown) { this.player.x -= speed; nextFacing = 'left' }
          if (this.cursors.right.isDown || keyboard.addKey('D').isDown) { this.player.x += speed; nextFacing = 'right' }
          if (this.cursors.up.isDown || keyboard.addKey('W').isDown) { this.player.y -= speed; nextFacing = 'back' }
          if (this.cursors.down.isDown || keyboard.addKey('S').isDown) { this.player.y += speed; nextFacing = 'front' }
          if (nextFacing !== this.facing) { this.facing = nextFacing; this.player.setTexture(`player-${nextFacing}`) }
          this.player.x = Phaser.Math.Clamp(this.player.x, 25, 775); this.player.y = Phaser.Math.Clamp(this.player.y, 90, 455)
          this.current = portals.find((portal) => Phaser.Math.Distance.Between(this.player.x, this.player.y, portal.x, portal.y) < 70)
          this.interaction.setPosition(this.player.x, this.player.y - 48).setVisible(Boolean(this.current))
          this.prompt.setText(this.current ? `E — войти в корпус «${this.current.direction.title}»` : '')
        }
      }
      game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current, width: 800, height: 500, scene: CampusScene })
    })
    return () => { cancelled = true; game?.destroy(true) }
  }, [directions])
  return <div className="game-canvas campus-canvas" ref={host} aria-label="Игровой кампус" />
}
