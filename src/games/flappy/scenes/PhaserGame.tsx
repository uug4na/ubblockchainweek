import { useEffect, useRef, useState, type ReactNode } from 'react'
import Phaser from 'phaser'

import { GameConfig } from '../core/GameConfig'
import { ASSETS } from '../core/Paths'
import type { FlappyStats } from '../types'
import { GameScene } from './GameScene'
import { GameOverScene } from './GameOverScene'

// UBBW: the page hears when a run starts and ends, so it can save the run for the crew dashboard.
type Props = {
  onRunStart?: () => void
  onRunOver?: (stats: FlappyStats) => void
  children?: ReactNode
}

export function PhaserGame({ onRunStart, onRunOver, children }: Props = {}) {
  const callbacks = useRef({ onRunStart, onRunOver })
  callbacks.current = { onRunStart, onRunOver }
  const gameContainerRef = useRef<HTMLDivElement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gameContainerRef.current) return

    const handleLoading = () => {
      setIsLoading(true)
      setError(null)
    }
    const handleReady = () => setIsLoading(false)
    const handleRunStart = () => callbacks.current.onRunStart?.()
    const handleRunOver = (stats: FlappyStats) => callbacks.current.onRunOver?.(stats)
    const handleError = (message: string) => {
      setIsLoading(false)
      setError(message)
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: gameContainerRef.current,
      width: GameConfig.Canvas.Width,
      height: GameConfig.Canvas.Height,
      transparent: true,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: GameConfig.Canvas.GravityY, x: 0 },
          debug: false,
        },
      },
      scene: [GameScene, GameOverScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      callbacks: {
        preBoot: (instance) => {
          instance.events.on('game-loading', handleLoading)
          instance.events.on('game-ready', handleReady)
          instance.events.on('game-error', handleError)
          instance.events.on('run-start', handleRunStart)
          instance.events.on('run-over', handleRunOver)
        },
      },
    })

    return () => {
      game.events.off('game-loading', handleLoading)
      game.events.off('game-ready', handleReady)
      game.events.off('game-error', handleError)
      game.events.off('run-start', handleRunStart)
      game.events.off('run-over', handleRunOver)
      game.destroy(true)
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100dvh',
        background: '#000000',
        touchAction: 'none',
        overscrollBehavior: 'none',
        overflow: 'hidden',
        zIndex: 1000,
      }}
    >
      <div ref={gameContainerRef} style={{ width: '100%', height: '100%' }} />
      {(isLoading || error !== null) && (
        <div
          role={error ? 'alert' : 'status'}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            background: '#1a2638',
            backgroundImage: `url('${ASSETS}/loadingbackground.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: '#ffffff',
            fontFamily: "'Shantel', sans-serif",
            fontSize: error ? 'clamp(18px, 4vw, 28px)' : 'clamp(44px, 12vw, 100px)',
            textAlign: 'center',
            textShadow: '0 3px 8px rgba(0,0,0,0.9)',
          }}
        >
          {error || 'Loading...'}
        </div>
      )}
      {children}
    </div>
  )
}
