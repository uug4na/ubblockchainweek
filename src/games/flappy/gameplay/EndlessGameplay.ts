import Phaser from 'phaser'

import { GameConfig } from '../core/GameConfig'
import { Bird } from '../prefabs/BirdPrefab'
import type { CollectibleType } from '../prefabs/CollectibleItem'
import { CountdownSystem } from '../systems/CountdownSystem'
import { GameAudio } from '../systems/GameAudio'
import { GameBackground } from '../systems/GameBackground'
import { GameHud } from '../systems/GameHud'
import { InputSystem } from '../systems/InputSystem'
import { PlayerSystem } from '../systems/PlayerSystem'
import { WorldSystem } from '../systems/WorldSystem'

type EndlessGameplayOptions = {
  scene: Phaser.Scene
  seed: string
}

type GameStatus = 'countdown' | 'playing' | 'dead' | 'gameOver'

export class EndlessGameplay {
  private readonly scene: Phaser.Scene
  private readonly seed: string
  private status: GameStatus = 'countdown'
  private score = 0
  private pipesPassedSinceLastItem = 0
  // UBBW: what the run looked like, sent to the page when the bird dies (see FlappyStats).
  private stats = { hits: 0, hearts: 0, stars: 0, cause: 'pipe' as 'pipe' | 'fall' }

  private bird!: Bird
  private background!: GameBackground
  private audio!: GameAudio
  private hud!: GameHud
  private input!: InputSystem
  private player!: PlayerSystem
  private world!: WorldSystem
  private countdown!: CountdownSystem

  constructor({ scene, seed }: EndlessGameplayOptions) {
    this.scene = scene
    this.seed = seed
  }

  create() {
    this.background = new GameBackground({ scene: this.scene })
    this.background.create()

    this.bird = new Bird({
      scene: this.scene,
      x: this.scene.scale.width * GameConfig.Bird.SpawnXMultiplier,
      y: this.scene.scale.height / 2,
    })

    this.hud = new GameHud({ scene: this.scene })
    this.hud.create()
    this.audio = new GameAudio({ scene: this.scene })
    this.audio.create()

    this.player = new PlayerSystem({
      scene: this.scene,
      bird: this.bird,
      hud: this.hud,
      audio: this.audio,
    })

    this.world = new WorldSystem({
      scene: this.scene,
      seed: this.seed,
      isRunning: () => this.status === 'playing',
      getPlayerX: () => this.player.x,
      canScorePlayer: () => this.status === 'playing',
      getCollectibleType: (): CollectibleType => Phaser.Math.Between(0, 1) === 0 ? 'heart' : 'star',
      onPlayerHitPipe: () => {
        if (this.status !== 'playing') return
        const before = this.player.currentHealth
        const dead = this.player.damageFromObstacle()
        if (this.player.currentHealth < before) this.stats.hits += 1
        if (dead) this.die()
      },
      onCollectible: (type) => {
        if (this.status !== 'playing') return
        this.player.collect(type)
        if (type === 'heart') this.stats.hearts += 1
        else this.stats.stars += 1
      },
      onPlayerPassedPipe: () => this.passPipe(),
    })
    this.world.create(this.player.sprite)

    this.input = new InputSystem({
      scene: this.scene,
      canFlap: () => this.status === 'playing',
      flap: () => this.player.flap(),
    })
    this.input.create()
    this.audio.playMusic()
    this.player.freeze()

    this.countdown = new CountdownSystem({
      scene: this.scene,
      onComplete: () => {
        this.status = 'playing'
        this.player.resume()
        this.scene.game.events.emit('run-start')
      },
    })
    this.countdown.start()
  }

  update(_time: number, delta: number) {
    if (this.status === 'gameOver') return

    if (this.status === 'dead') {
      this.player.updateDeadFall()
      this.updateCameraAndBackground()

      if (this.player.hasFallenBelowScreen()) {
        this.status = 'gameOver'
        this.scene.scene.launch('GameOverScene', { score: this.score })
        this.scene.scene.pause()
      }
      return
    }

    this.updateCameraAndBackground()
    if (this.status !== 'playing') return

    if (this.player.isOutOfBounds()) {
      this.stats.cause = 'fall'
      this.die()
      return
    }

    this.player.updatePlaying(delta / 1000)
    this.updateCameraAndBackground()
    this.world.update()
  }

  destroy() {
    this.countdown?.destroy()
    this.input?.destroy()
    this.player?.destroy()
    this.world?.destroy()
    this.hud?.destroy()
    this.audio?.destroy()
    this.background?.destroy()
    this.bird?.destroy()
  }

  private die() {
    if (this.status !== 'playing') return

    this.status = 'dead'
    this.audio.playSfx('gameOver')
    this.player.kill()
    this.world.stopObjects()
    this.audio.setMusicVolume(GameAudio.Music.LowVolume)
    this.scene.game.events.emit('run-over', { score: this.score, ...this.stats })
  }

  private passPipe() {
    this.score += 1
    this.hud.setScore(this.score)
    this.audio.playSfx('pipeScore')
    this.background.updateByScore(this.score)
    this.pipesPassedSinceLastItem += 1

    if (this.pipesPassedSinceLastItem < 8) return
    this.pipesPassedSinceLastItem = 0
    this.world.requestCollectibleOnNextPipe()
  }

  private updateCameraAndBackground() {
    this.scene.cameras.main.scrollX = this.player.x - this.scene.scale.width * 0.32
    this.background.update(this.scene.cameras.main.scrollX)
  }
}
