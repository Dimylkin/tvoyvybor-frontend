import { useEffect, useRef } from 'react'
import type { Direction } from './api'
import { devOpsSpot, locationFor } from './world'

export function CampusCanvas({ directions, onEnter, blocked = false }: { directions: Direction[], onEnter: (direction: Direction) => void, blocked?: boolean }) {
  const host = useRef<HTMLDivElement>(null); const enterRef = useRef(onEnter); const blockedRef = useRef(blocked)
  useEffect(() => { enterRef.current = onEnter }, [onEnter]); useEffect(() => { blockedRef.current = blocked }, [blocked])
  useEffect(() => {
    if (typeof Element === 'undefined') return
    let game: { destroy: (removeCanvas: boolean) => void } | undefined; let cancelled = false
    void import('phaser').then(({ default: Phaser }) => {
      if (cancelled || !host.current) return
      const portals = directions.flatMap((direction) => { const location = locationFor(direction.slug); return location ? [{ direction, ...location.campusPortal }] : [] })
      class CampusScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Image; private interaction!: Phaser.GameObjects.Image; private cursors?: Phaser.Types.Input.Keyboard.CursorKeys; private current?: typeof portals[number]; private facing = 'front'
        constructor() { super('campus') }
        preload() { this.load.image('campus', '/content/backgrounds/campus_main.png'); for (const face of ['front', 'back', 'left', 'right']) this.load.image(`player-${face}`, `/content/characters/player/player_robot_${face}.png`); this.load.image('interact', '/content/ui/ui_interact_e.png'); this.load.image('marker', '/content/ui/ui_quest_marker.png') }
        create() { this.add.image(400, 250, 'campus').setDisplaySize(800, 500); portals.forEach((portal) => this.add.image(portal.x, portal.y - 44, 'marker').setDisplaySize(30, 37)); this.add.text(devOpsSpot.x, devOpsSpot.y, devOpsSpot.label, { align: 'center', fontFamily: 'system-ui', fontSize: '12px', color: '#d5dce9', stroke: '#172238', strokeThickness: 4 }).setOrigin(.5); this.player = this.add.image(400, 410, 'player-front').setOrigin(.5, 1).setDisplaySize(38, 48).setDepth(410); this.interaction = this.add.image(400, 360, 'interact').setDisplaySize(31, 31).setVisible(false).setDepth(1000); this.cursors = this.input.keyboard?.createCursorKeys(); this.input.keyboard?.on('keydown-E', () => { if (this.current && !blockedRef.current) enterRef.current(this.current.direction) }) }
        update(_time: number, delta: number) { if (!this.cursors || blockedRef.current) return; const keyboard = this.input.keyboard; if (!keyboard) return; const speed = .18 * delta; let facing = this.facing; if (this.cursors.left.isDown || keyboard.addKey('A').isDown) { this.player.x -= speed; facing = 'left' }; if (this.cursors.right.isDown || keyboard.addKey('D').isDown) { this.player.x += speed; facing = 'right' }; if (this.cursors.up.isDown || keyboard.addKey('W').isDown) { this.player.y -= speed; facing = 'back' }; if (this.cursors.down.isDown || keyboard.addKey('S').isDown) { this.player.y += speed; facing = 'front' }; if (facing !== this.facing) { this.facing = facing; this.player.setTexture(`player-${facing}`) }; this.player.x = Phaser.Math.Clamp(this.player.x, 25, 775); this.player.y = Phaser.Math.Clamp(this.player.y, 90, 455); this.player.setDepth(this.player.y); this.current = portals.find((portal) => Phaser.Math.Distance.Between(this.player.x, this.player.y, portal.x, portal.y) < portal.radius); this.interaction.setPosition(this.player.x, this.player.y - 54).setVisible(Boolean(this.current)) }
      }
      game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current, width: 800, height: 500, render: { antialias: true, pixelArt: false }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 800, height: 500 }, scene: CampusScene })
    })
    return () => { cancelled = true; game?.destroy(true) }
  }, [directions])
  return <div className="game-canvas campus-canvas" ref={host} aria-label="Игровой кампус" />
}
