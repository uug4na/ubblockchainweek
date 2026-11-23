import Phaser from 'phaser'

type InputSystemOptions = {
  scene: Phaser.Scene
  canFlap: () => boolean
  flap: () => void
}

export class InputSystem {
  private readonly scene: Phaser.Scene
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null
  private readonly options: InputSystemOptions

  constructor(options: InputSystemOptions) {
    this.options = options
    this.scene = options.scene
    this.keyboard = options.scene.input.keyboard
  }

  create() {
    this.scene.input.on('pointerdown', this.handleInput, this)
    this.keyboard?.addCapture('SPACE')
    this.keyboard?.on('keydown-SPACE', this.handleInput, this)
  }

  destroy() {
    this.scene.input.off('pointerdown', this.handleInput, this)
    this.keyboard?.off('keydown-SPACE', this.handleInput, this)
    this.keyboard?.removeCapture('SPACE')
  }

  private handleInput(event?: KeyboardEvent | Phaser.Input.Pointer) {
    if (event && 'repeat' in event && event.repeat) return
    if (!this.options.canFlap()) return
    this.options.flap()
  }
}
