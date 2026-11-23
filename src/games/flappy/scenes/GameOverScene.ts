import Phaser from 'phaser'

import { AssetKeys } from '../core/AssetKeys'
import { GameConfig } from '../core/GameConfig'
import { SPARKY } from '../types'

type GameOverData = {
  score?: number
}

export class GameOverScene extends Phaser.Scene {
  private score = 0

  constructor() {
    super('GameOverScene')
  }

  init({ score = 0 }: GameOverData = {}) {
    this.score = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0
  }

  create() {
    const width = this.scale.width
    const height = this.scale.height

    if (this.textures.exists(AssetKeys.GameOverBackground)) {
      const background = this.add.image(width / 2, height / 2, AssetKeys.GameOverBackground)
      background.setScale(Math.max(width / background.width, height / background.height))
    }

    this.add.rectangle(width / 2, height / 2, width, height, 0x101525, 0.12)
      .setInteractive()

    const panel = this.add.container(width / 2, height / 2)
    panel.setScale(Math.min(1, (width - 56) / 600, (height - 80) / 700))

    const frame = this.add.graphics()
    frame.fillStyle(0x392514, 0.22)
    frame.fillRoundedRect(-298, -342, 600, 700, 20)
    frame.fillStyle(0xffefd7, 1)
    frame.fillRoundedRect(-300, -350, 600, 700, 18)
    frame.lineStyle(5, 0xb18a43, 1)
    frame.strokeRoundedRect(-300, -350, 600, 700, 18)
    frame.lineStyle(2, 0xe4c58f, 1)
    frame.strokeRoundedRect(-293, -343, 586, 686, 13)
    frame.lineStyle(2, 0xd2b276, 1)
    frame.lineBetween(-274, -296, -158, -296)
    frame.lineBetween(158, -296, 274, -296)
    panel.add(frame)

    panel.add(this.makeText(0, -296, 'ТОГЛООМ ДУУСЛАА', 29, '#16120c', true))

    const hasIllustration = this.textures.exists(AssetKeys.GameOverBird)
    const bird = this.add.image(
      0,
      -115,
      hasIllustration ? AssetKeys.GameOverBird : SPARKY.texture,
      hasIllustration ? undefined : 3,
    )
    const birdScale = Math.min(320 / bird.width, 230 / bird.height)
    bird.setScale(birdScale)
    panel.add(bird)

    this.addScore(panel, 0, 'АВСАН ОНОО', this.score)

    const button = this.add.container(0, 253)
    let drawButton: (color: number) => void

    if (this.textures.exists(AssetKeys.GameOverButton)) {
      const buttonBackground = this.add.image(0, 0, AssetKeys.GameOverButton)
      buttonBackground.setDisplaySize(250, 68)
      button.add(buttonBackground)
      drawButton = (color) => buttonBackground.setTint(color)
      drawButton(0xffffff)
    } else {
      const buttonBackground = this.add.graphics()
      button.add(buttonBackground)
      drawButton = (color) => {
        buttonBackground.clear()
        buttonBackground.fillStyle(color, 1)
        buttonBackground.fillRoundedRect(-125, -34, 250, 68, 10)
        buttonBackground.lineStyle(3, 0xaf3422, 1)
        buttonBackground.strokeRoundedRect(-125, -34, 250, 68, 10)
      }
      drawButton(0xef5034)
    }

    const hasButtonImage = this.textures.exists(AssetKeys.GameOverButton)
    button.add(this.makeText(0, -2, 'БУЦАХ', 29, '#ffffff', true))
    button.setSize(250, 68).setInteractive({ useHandCursor: true })
    button.on('pointerover', () => drawButton(hasButtonImage ? 0xffebd9 : 0xff6746))
    button.on('pointerout', () => drawButton(hasButtonImage ? 0xffffff : 0xef5034))
    button.on('pointerdown', () => drawButton(hasButtonImage ? 0xd4b3a0 : 0xd94129))
    button.on('pointerup', () => {
      // UBBW: the page decides where "back" goes (Devee's start screen, with this run's stars)
      if (this.game.events.listenerCount('exit')) this.game.events.emit('exit')
      else window.history.back()
    })
    panel.add(button)
  }

  private addScore(panel: Phaser.GameObjects.Container, x: number, label: string, score: number) {
    panel.add(this.makeText(x, 63, label, 22, '#4c4b47'))
    const box = this.add.graphics()
    box.fillStyle(0xfff3e0, 1)
    box.fillRoundedRect(x - 126, 86, 252, 72, 12)
    box.lineStyle(3, 0xd1b47d, 1)
    box.strokeRoundedRect(x - 126, 86, 252, 72, 12)
    panel.add([box, this.makeText(x, 122, String(score), 36, '#14100b', true)])
  }

  private makeText(x: number, y: number, value: string, size: number, color: string, bold = false) {
    return this.add.text(x, y, value, {
      fontFamily: GameConfig.Font.Primary,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      align: 'center',
    }).setOrigin(0.5)
  }
}
