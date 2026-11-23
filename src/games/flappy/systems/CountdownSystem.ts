import Phaser from 'phaser'

import { GameConfig } from '../core/GameConfig'

type CountdownSystemOptions = {
  scene: Phaser.Scene
  onComplete: () => void
}

const COUNTDOWN = {
  Steps: ['3', '2', '1', 'GO'] as const,
  StepMs: 720,
  FontSize: '96px',
  StrokeThickness: 8,
  PopScale: 1.25,
  FadeMs: 180,
} as const

export class CountdownSystem {
  private readonly scene: Phaser.Scene
  private readonly onComplete: () => void
  private text: Phaser.GameObjects.Text | null = null
  private currentStep = 0
  private timer: Phaser.Time.TimerEvent | null = null

  constructor(options: CountdownSystemOptions) {
    this.scene = options.scene
    this.onComplete = options.onComplete
  }

  start() {
    this.text = this.scene.add.text(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2,
      '',
      {
        fontSize: COUNTDOWN.FontSize,
        color: '#ffffff',
        fontFamily: GameConfig.Font.Primary,
        stroke: '#000000',
        strokeThickness: COUNTDOWN.StrokeThickness,
      },
    )

    this.text.setOrigin(0.5)
    this.text.setDepth(GameConfig.Depth.UI + 30)
    this.text.setScrollFactor(0)

    this.showCurrentStep()
  }

  destroy() {
    if (this.timer !== null) {
      this.timer.remove(false)
      this.timer = null
    }

    if (this.text !== null) {
      this.text.destroy()
      this.text = null
    }
  }

  private showCurrentStep() {
    if (this.text === null) return

    const value = COUNTDOWN.Steps[this.currentStep]

    if (value === undefined) {
      this.text.destroy()
      this.text = null
      this.onComplete()
      return
    }

    this.text.setText(value)
    this.text.setAlpha(1)
    this.text.setScale(COUNTDOWN.PopScale)

    this.scene.tweens.add({
      targets: this.text,
      scale: 1,
      duration: COUNTDOWN.FadeMs,
      ease: 'Back.easeOut',
    })

    this.timer = this.scene.time.delayedCall(COUNTDOWN.StepMs, () => {
      this.currentStep += 1
      this.showCurrentStep()
    })
  }
}
