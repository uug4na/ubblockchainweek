import Phaser from 'phaser'

import { Bird } from '../prefabs/BirdPrefab'
import { GameConfig } from './GameConfig'

type BirdMotionOptions = {
  scene: Phaser.Scene
  bird: Bird
}

export class BirdMotion {
  private readonly scene: Phaser.Scene
  private readonly bird: Bird
  private isDead = false

  constructor({ scene, bird }: BirdMotionOptions) {
    this.scene = scene
    this.bird = bird
  }

  get x() {
    return this.bird.sprite.x
  }

  update(deltaSeconds: number) {
    if (this.isDead) return

    this.bird.sprite.x += GameConfig.Bird.ForwardSpeed * deltaSeconds
    this.bird.sprite.rotation = Phaser.Math.Clamp(
      this.bird.body.velocity.y / GameConfig.Bird.Rotation.VelocityDivider,
      GameConfig.Bird.Rotation.Min,
      GameConfig.Bird.Rotation.Max,
    )
  }

  flap() {
    if (this.isDead) return
    this.bird.sprite.setVelocityY(GameConfig.Bird.FlapVelocityY)
  }

  isOutOfBounds() {
    const padding = GameConfig.Bird.OutOfBoundsPadding

    return (
      this.bird.sprite.y > this.scene.scale.height + padding ||
      this.bird.sprite.y < -padding
    )
  }

  freeze() {
    this.bird.sprite.setVelocity(0, 0)
    this.bird.body.setEnable(false)
    this.bird.body.setAllowGravity(false)
  }

  resume() {
    this.bird.body.setEnable(true)
    this.bird.body.setAllowGravity(true)
    this.bird.sprite.setGravityY(GameConfig.Bird.GravityY)
    this.bird.sprite.setVelocity(0, 0)
  }

  kill() {
    if (this.isDead) return

    this.isDead = true
    this.bird.setDeadFrame()
    this.bird.sprite.setVelocity(0, GameConfig.Bird.DeadVelocityY)
    this.bird.sprite.setGravityY(GameConfig.Bird.DeadGravityY)
    this.bird.body.setEnable(true)
    this.bird.body.setAllowGravity(true)
  }

  updateDeadFall() {
    this.bird.sprite.rotation += GameConfig.Bird.Rotation.DeadSpinSpeed
  }

  hasFallenBelowScreen() {
    return this.bird.sprite.y > this.scene.scale.height + GameConfig.Bird.DeadFallExtraY
  }
}
