import { useEffect, useRef } from 'react'
import { moveToward, type Point } from './clickMovement'
import type { Direction } from './api'
import { CAMERA, CAMPUS, cameraPosition } from './campusCamera'
import type { CampusPosition } from './campusReturn'
import { devOpsSpot, locationFor, mainBuilding } from './world'

export function CampusCanvas({ directions, onEnter, initialPosition, onActionReady, onActionChange = () => {}, blocked = false, onReady = () => {} }: { directions: Direction[], onEnter: (direction: Direction, position: CampusPosition) => void, initialPosition?: CampusPosition, onActionReady?: (action: () => void) => void, onActionChange?: (label: string | null) => void, blocked?: boolean, onReady?: () => void }) {
  const host = useRef<HTMLDivElement>(null); const enterRef = useRef(onEnter); const actionRef = useRef(onActionChange); const blockedRef = useRef(blocked); const readyRef = useRef(onReady); const actionReadyRef = useRef(onActionReady)
  useEffect(() => { enterRef.current = onEnter }, [onEnter]); useEffect(() => { actionRef.current = onActionChange }, [onActionChange]); useEffect(() => { blockedRef.current = blocked }, [blocked]); useEffect(() => { readyRef.current = onReady }, [onReady]); useEffect(() => { actionReadyRef.current = onActionReady }, [onActionReady])
  useEffect(() => {
    if (typeof Element === 'undefined') return
    let game: { destroy: (removeCanvas: boolean) => void } | undefined; let cancelled = false
    void import('phaser').then(({ default: Phaser }) => {
      if (cancelled || !host.current) return
      const renderScale = 3
      const spawn = initialPosition ?? { x: 400, y: 330 }
      const portals = [mainBuilding, ...directions].flatMap((direction) => { const location = locationFor(direction.slug); return location ? [{ direction, ...location.campusPortal }] : [] })
      class CampusScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Image; private cursors?: Phaser.Types.Input.Keyboard.CursorKeys; private current?: typeof portals[number]; private facing = 'front'
        private target?: Point
        private cameraCenter = cameraPosition({ x: 400, y: 314 }, spawn, Infinity)
        constructor() { super('campus') }
        preload() { for (const tile of ['top_left', 'top_right', 'bottom_left', 'bottom_right']) this.load.image(`campus-${tile}`, `/content/backgrounds/campus_main_${tile}.png`); for (const face of ['front', 'back', 'left', 'right']) this.load.image(`player-${face}`, `/content/characters/player/player_robot_${face}.png`) }
        create() {
          for (const [index, tile] of ['top_left', 'top_right', 'bottom_left', 'bottom_right'].entries()) {
            this.add.image((index % 2) * CAMPUS.width / 2, Math.floor(index / 2) * CAMPUS.height / 2, `campus-${tile}`).setOrigin(0).setDisplaySize(CAMPUS.width / 2, CAMPUS.height / 2)
          }
          this.add.text(devOpsSpot.x, devOpsSpot.y, devOpsSpot.label, { align: 'center', fontFamily: 'system-ui', fontSize: '12px', color: '#d5dce9', stroke: '#172238', strokeThickness: 4 }).setOrigin(.5)
          this.player = this.add.image(spawn.x, spawn.y, 'player-front').setOrigin(.5, 1).setDisplaySize(38 / 1.5, 32).setDepth(spawn.y)
          this.cameras.main.setZoom(CAMERA.zoom * renderScale).setBounds(0, 0, CAMPUS.width, CAMPUS.height).centerOn(this.cameraCenter.x, this.cameraCenter.y)
          this.cursors = this.input.keyboard?.createCursorKeys()
          const interact = () => { if (this.current && !blockedRef.current) { this.target = undefined; enterRef.current(this.current.direction, { x: this.player.x, y: this.player.y }) } }
          actionReadyRef.current?.(interact)
          this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (!blockedRef.current) { const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y); this.target = { x: Phaser.Math.Clamp(point.x, 38 / 3, CAMPUS.width - 38 / 3), y: Phaser.Math.Clamp(point.y, 32, CAMPUS.height) } } })
          readyRef.current()
        }
        update(_time: number, delta: number) {
          const keyboard = this.input.keyboard
          if (this.cursors && keyboard && !blockedRef.current) {
            const speed = .1 * delta; let x = this.player.x; let y = this.player.y; let facing = this.facing
            if (this.cursors.left.isDown || keyboard.addKey('A').isDown) { x -= speed; facing = 'left' }
            if (this.cursors.right.isDown || keyboard.addKey('D').isDown) { x += speed; facing = 'right' }
            if (this.cursors.up.isDown || keyboard.addKey('W').isDown) { y -= speed; facing = 'back' }
            if (this.cursors.down.isDown || keyboard.addKey('S').isDown) { y += speed; facing = 'front' }
            if (x !== this.player.x || y !== this.player.y) this.target = undefined
            else if (this.target) { const point = moveToward(this.player, this.target, speed); const dx = point.x - x, dy = point.y - y; x = point.x; y = point.y; if (dx || dy) facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'back' : 'front'); if (x === this.target.x && y === this.target.y) this.target = undefined }
            this.player.setPosition(Phaser.Math.Clamp(x, 38 / 3, CAMPUS.width - 38 / 3), Phaser.Math.Clamp(y, 32, CAMPUS.height))
            if (facing !== this.facing) { this.facing = facing; this.player.setTexture(`player-${facing}`) }
            this.player.setDepth(this.player.y)
            this.current = portals.find((portal) => Phaser.Math.Distance.Between(this.player.x, this.player.y, portal.x, portal.y) < portal.radius)
            actionRef.current(this.current ? ({ narrator: 'Войти в главный корпус', backend: 'Войти в Backend-корпус', frontend: 'Войти в Frontend-корпус', analytics: 'Войти в корпус аналитики' }[this.current.direction.slug] ?? `Войти в ${this.current.direction.title}`) : null)
          }
          this.cameraCenter = cameraPosition(this.cameraCenter, this.player, delta)
          this.cameras.main.centerOn(this.cameraCenter.x, this.cameraCenter.y)
        }
      }
      game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current, width: CAMPUS.viewportWidth * renderScale, height: CAMPUS.viewportHeight * renderScale, render: { antialias: true, pixelArt: false }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: CAMPUS.viewportWidth * renderScale, height: CAMPUS.viewportHeight * renderScale }, scene: CampusScene })
    })
    return () => { cancelled = true; game?.destroy(true) }
  }, [directions, initialPosition])
  return <div className="game-canvas campus-canvas" ref={host} aria-label="Игровой кампус" />
}
