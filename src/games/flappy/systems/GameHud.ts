import Phaser from 'phaser'

import { AssetKeys } from '../core/AssetKeys'
import { GameConfig } from '../core/GameConfig'

type GameHudOptions = {
  scene: Phaser.Scene
}

const HUD = {
  Score: {
    RightOffsetX: 60,
    Y: 80,
    FontSize: '48px',
    StrokeThickness: 6,
  },
  Health: {
    StartX: 20,
    Y: 20,
    Spacing: 70,
    Size: 70,
    PulseScale: 1.15,
    PulseDuration: 120,
  },
} as const

export class GameHud {
  private readonly scene: Phaser.Scene
  private scoreText!: Phaser.GameObjects.Text
  private healthIcons: Phaser.GameObjects.Sprite[] = []
  private healthIconBaseScaleX = 1
  private healthIconBaseScaleY = 1

  constructor({ scene }: GameHudOptions) {
    this.scene = scene
  }

  create() {
    this.scoreText = this.scene.add.text(
      this.scene.scale.width - HUD.Score.RightOffsetX,
      HUD.Score.Y,
      '0',
      {
        fontSize: HUD.Score.FontSize,
        color: '#ffffff',
        fontFamily: GameConfig.Font.Primary,
        stroke: '#000000',
        strokeThickness: HUD.Score.StrokeThickness,
      },
    )
    this.scoreText.setOrigin(0.5).setDepth(GameConfig.Depth.UI).setScrollFactor(0)

    this.healthIcons = Array.from({ length: GameConfig.Health.Max }, (_, index) => {
      const icon = this.scene.add.sprite(
        HUD.Health.StartX + index * HUD.Health.Spacing,
        HUD.Health.Y,
        AssetKeys.Sprite.Health,
        0,
      )
      icon.setOrigin(0, 0)
        .setDisplaySize(HUD.Health.Size, HUD.Health.Size)
        .setDepth(GameConfig.Depth.UI)
        .setScrollFactor(0)

      if (index === 0) {
        this.healthIconBaseScaleX = icon.scaleX
        this.healthIconBaseScaleY = icon.scaleY
      }
      return icon
    })
    this.setHealth(GameConfig.Health.Max)
  }

  setScore(score: number) {
    this.scoreText.setText(String(score))
  }

  setHealth(value: number) {
    const health = Phaser.Math.Clamp(value, 0, GameConfig.Health.Max)
    this.healthIcons.forEach((icon, index) => {
      icon.setFrame(index >= health ? 2 : health === 1 && index === 0 ? 1 : 0)
    })
  }

  pulseHealth() {
    this.healthIcons.forEach((icon) => {
      this.scene.tweens.add({
        targets: icon,
        scaleX: this.healthIconBaseScaleX * HUD.Health.PulseScale,
        scaleY: this.healthIconBaseScaleY * HUD.Health.PulseScale,
        duration: HUD.Health.PulseDuration,
        yoyo: true,
        ease: 'Sine.easeInOut',
        onComplete: () => icon.setScale(this.healthIconBaseScaleX, this.healthIconBaseScaleY),
      })
    })
  }

  destroy() {
    this.scoreText?.destroy()
    this.healthIcons.forEach((icon) => icon.destroy())
    this.healthIcons = []
  }
}