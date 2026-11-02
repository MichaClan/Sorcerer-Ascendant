'use client'

import { useEffect, useState } from 'react'
import { characters } from '@/app/lib/characters'
import { makeMove } from '@/app/actions/move'

type GamePlayer = {
  playerId: string
  character: string | null
  hp: number
  status: string | null
  cooldowns: Record<string, number>
}

const FRAME_MS = 600 // time per animation frame

const PROJECTILE_MOVES: Record<string, string> = {
  'divine-dogs': '/sprites/Sorcerer Ascendant-16.png.png',
  'nue': '/sprites/Sorcerer Ascendant-17.png.png',
  'rabbit-escape': '/sprites/Rabbit-Escape.png',
  'glitch': '/Glitch.png',
}

function useAnimation(character: ReturnType<typeof characters.find>) {
  const [sprite, setSprite] = useState(character?.sprite)
  const [flipOverride, setFlipOverride] = useState<'always' | 'never' | null>(null)

  useEffect(() => {
    setSprite(character?.sprite)
  }, [character])

  function play(move: string, keepSprite?: boolean) {
    const def = character?.moveSprites[move]
    if (!def) return
    def.frames.forEach((frame, i) => {
      setTimeout(() => {
        setSprite(frame)
        setFlipOverride(def.flip === 'always' || def.flip === 'never' ? def.flip : null)
      }, i * FRAME_MS)
    })
    setTimeout(() => {
      // if keepSprite is set, don't reset — getSprite will handle the status sprite
      if (!keepSprite) setSprite(character?.sprite)
      setFlipOverride(null)
    }, def.frames.length * FRAME_MS)
  }

  return { sprite, flipOverride, play }
}

// isRight = this player is rendered on the right side
function shouldFlip(character: ReturnType<typeof characters.find>, isRight: boolean, flipOverride: 'always' | 'never' | null) {
  if (flipOverride === 'never') return false
  if (flipOverride === 'always') return !character?.facesRight ? true : isRight // always face opponent
  // default: flip if the natural facing doesn't match the side
  const naturallyFacesRight = character?.facesRight ?? true
  return isRight ? naturallyFacesRight : !naturallyFacesRight
}

export default function BattleView({
  gameId,
  me,
  opponent,
  turn,
  lastMove,
  myPlayerId,
}: {
  gameId: string
  me: GamePlayer
  opponent: GamePlayer
  turn: string | null
  lastMove: { move: string; attackerId: string; attackerStatus: string | null; missed: boolean; glitchCorrupted: boolean } | null
  myPlayerId: string
}) {
  const myCharacter = characters.find((c) => c.id === me.character)
  const opponentCharacter = characters.find((c) => c.id === opponent.character)
  const isMyTurn = turn === myPlayerId

  const myAnim = useAnimation(myCharacter)
  const opponentAnim = useAnimation(opponentCharacter)
  const [projectile, setProjectile] = useState<{ sprite: string; direction: 'fly-left' | 'fly-right' } | null>(null)
  const [showMissed, setShowMissed] = useState(false)

  // play animation on whoever attacked last
  useEffect(() => {
    if (!lastMove) return

    setShowMissed(lastMove.attackerId === myPlayerId && lastMove.missed)

    if (!lastMove.missed) {
      // only keep the buff sprite if the move actually landed its buff (not glitch-corrupted)
      const keepSprite = lastMove.move === 'ai-assist' && !lastMove.glitchCorrupted
      if (lastMove.attackerId === myPlayerId) {
        myAnim.play(lastMove.move, keepSprite)
      } else {
        opponentAnim.play(lastMove.move, keepSprite)
      }

      const projectileSprite = PROJECTILE_MOVES[lastMove.move]
      if (projectileSprite) {
        setProjectile({
          sprite: projectileSprite,
          direction: lastMove.attackerId === myPlayerId ? 'fly-left' : 'fly-right',
        })
      }
    }
  }, [lastMove])

  const getSprite = (
    character: ReturnType<typeof characters.find>,
    status: string | null,
    animSprite: string | undefined
  ) => {
    if (status?.startsWith('glitched')) return '/Glitch.png'
    if (status === 'shielded' && character?.shieldedSprite) return character.shieldedSprite
    if (status === 'buffed' && character?.buffedSprite) return character.buffedSprite
    if (status === 'ai-assisted' && character?.buffedSprite) return character.buffedSprite
    return animSprite ?? character?.sprite
  }

  const imgStyle = (flipped: boolean): React.CSSProperties => ({
    width: 220,
    height: 'auto',
    imageRendering: 'pixelated',
    transform: flipped ? 'scaleX(-1)' : undefined,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* arena */}
<div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 32,
    position: 'relative',
  }}
>
  <style jsx>{`
    .fly-left {
      animation: flyLeft 0.6s ease-in forwards;
    }

    .fly-right {
      animation: flyRight 0.6s ease-in forwards;
    }

    @keyframes flyLeft {
      from { left: 75%; }
      to { left: 10%; }
    }

    @keyframes flyRight {
      from { left: 10%; }
      to { left: 75%; }
    }
  `}</style>

        {/* opponent — left */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <img
            src={getSprite(opponentCharacter, opponent.status, opponentAnim.sprite)}
            alt={opponentCharacter?.name}
            style={imgStyle(shouldFlip(opponentCharacter, false, opponentAnim.flipOverride))}
          />
          <p>{opponentCharacter?.name} — {opponent.hp} HP</p>
          {opponent.status && <p style={{ fontSize: 12 }}>[{opponent.status}]</p>}
        </div>

        {/* me — right */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <img
            src={getSprite(myCharacter, me.status, myAnim.sprite)}
            alt={myCharacter?.name}
            style={imgStyle(shouldFlip(myCharacter, true, myAnim.flipOverride))}
          />
          <p>{myCharacter?.name} (Jij) — {me.hp} HP</p>
          {me.status && <p style={{ fontSize: 12 }}>[{me.status}]</p>}
        </div>
  {projectile && (
    <img
      src={projectile.sprite}
      alt="projectile"
      onAnimationEnd={() => setProjectile(null)}
      className={projectile.direction}
      style={{
        position: 'absolute',
        top: '50%',
        width: 80,
        transform: 'translateY(-50%)',
      }}
    />
  )}
      </div>

      {/* turn + moves */}
      {showMissed && <p style={{ textAlign: 'center', color: 'red' }}>you missed lol</p>}
      {lastMove?.attackerId === myPlayerId && lastMove?.glitchCorrupted && (
        <p style={{ textAlign: 'center', color: 'purple' }}>glitch corrupted jouw move! status cleared, geen buff</p>
      )}
      <p style={{ textAlign: 'center' }}>{isMyTurn ? 'Jouw beurt' : "Beurt van tegenstander"}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {myCharacter?.moves.map((move) => {
          const cd = me.cooldowns[move] ?? 0
          const onCooldown = cd > 0
          return (
            <button
              key={move}
              disabled={!isMyTurn || onCooldown}
              onClick={() => makeMove(gameId, move)}
            >
              {move}{onCooldown ? ` (${cd})` : ''}
            </button>
          )
        })}
      </div>

    </div>
  )
}
