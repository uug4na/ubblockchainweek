import Phaser from 'phaser'

import { BirdMotion } from '../core/BirdMotion'
import { GameConfig } from '../core/GameConfig'
import { Bird } from '../prefabs/BirdPrefab'
import type { CollectibleType } from '../prefabs/CollectibleItem'
import { GameAudio } from './GameAudio'
import { GameHud } from './GameHud'

type PlayerSystemOptions = {
  scene: Phaser.Scene
  bird: Bird
  hud: GameHud
  audio: GameAudio
}

export class PlayerSystem {
  private readonly scene: Phaser.Scene
  private readonly bird: Bird
  private readonly hud: GameHud
  private readonly audio: GameAudio
  private readonly motion: BirdMotion

  private health: number = GameConfig.Health.Max
  private isDamageInvulnerable = false
  private isStarInvincible = false
  private starTimer: Phaser.Time.TimerEvent | null = null

  constructor(options: PlayerSystemOptions) {
    this.scene = options.scene
    this.bird = options.bird
    this.hud = options.hud
    this.audio = options.audio
    this.motion = new BirdMotion({
      scene: options.scene,
      bird: options.bird,
    })
  }

  get sprite() {
    return this.bird.sprite
  }

  get x() {
    return this.motion.x
  }

  get currentHealth() {
    return this.health
  }

  updatePlaying(deltaSeconds: number) {
    this.motion.update(deltaSeconds)
  }

  flap() {
    this.motion.flap()
  }

  isOutOfBounds() {
    return this.motion.isOutOfBounds()
  }

  damageFromObstacle(): boolean {
    if (this.isStarInvincible || this.isDamageInvulnerable) return false

    this.health -= 1
    this.hud.setHealth(this.health)

    if (this.health <= 0) return true

    this.audio.playSfx('birdDamaged')
    this.startDamageRecovery()
    return false
  }

  collect(type: CollectibleType) {
    this.audio.playSfx('itemPickup')

    if (type === 'heart') {
      this.heal()
      return
    }

    this.activateStarInvincibility()
  }

  kill() {
    this.health = 0
    this.hud.setHealth(this.health)
    this.isDamageInvulnerable = false
    this.isStarInvincible = false
    this.clearStarTimer()
    this.scene.tweens.killTweensOf(this.bird.sprite)
    this.bird.sprite.setAlpha(1)
    this.motion.kill()
  }

  freeze() {
    this.isDamageInvulnerable = false
    this.isStarInvincible = false
    this.clearStarTimer()
    this.motion.freeze()
  }

  resume() {
    this.motion.resume()
  }

  updateDeadFall() {
    this.motion.updateDeadFall()
  }

  hasFallenBelowScreen() {
    return this.motion.hasFallenBelowScreen()
  }

  destroy() {
    this.clearStarTimer()
  }

  private heal() {
    if (this.health >= GameConfig.Health.Max) return

    this.health += 1
    this.hud.setHealth(this.health)
    this.hud.pulseHealth()
  }

  private startDamageRecovery() {
    this.isDamageInvulnerable = true

    this.scene.tweens.add({
      targets: this.bird.sprite,
      alpha: GameConfig.Bird.DamageBlink.Alpha,
      duration: GameConfig.Bird.DamageBlink.Duration,
      yoyo: true,
      repeat: GameConfig.Bird.DamageBlink.Repeat,
      onComplete: () => {
        this.bird.sprite.setAlpha(1)
        this.isDamageInvulnerable = false
      },
    })
  }

  private activateStarInvincibility() {
    this.isStarInvincible = true
    this.isDamageInvulnerable = false
    this.clearStarTimer()
    this.bird.sprite.setAlpha(1)
    this.scene.tweens.killTweensOf(this.bird.sprite)

    this.scene.tweens.add({
      targets: this.bird.sprite,
      alpha: GameConfig.Bird.StarBlink.Alpha,
      duration: GameConfig.Bird.StarBlink.Duration,
      yoyo: true,
      repeat: GameConfig.Bird.StarBlink.Repeat,
      onComplete: () => this.bird.sprite.setAlpha(1),
    })

    this.starTimer = this.scene.time.delayedCall(
      GameConfig.Bird.StarInvincibilityDuration,
      () => {
        this.isStarInvincible = false
        this.bird.sprite.setAlpha(1)
      },
    )
  }

  private clearStarTimer() {
    if (this.starTimer === null) return

    this.starTimer.remove(false)
    this.starTimer = null
  }

}
