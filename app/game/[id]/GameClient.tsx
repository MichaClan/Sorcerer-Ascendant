'use client'

import { useState } from 'react'
import { characters } from '@/app/lib/characters'
import { useChannel } from '@/src/hooks/use-channel'
import { chooseCharacter } from '@/app/actions/game'
import BattleView from './BattleView'

type GamePlayer = {
  id: string
  playerId: string
  character: string | null
  ready: boolean
  hp: number
  status: string | null
  cooldowns: Record<string, number>
}

type Game = {
  id: string
  phase: string
  turn: string | null
  winner: string | null
  players: GamePlayer[]
}

export default function GameClient({
  game,
  myPlayerId,
}: {
  game: Game
  myPlayerId: string
}) {
  const [phase, setPhase] = useState(game.phase)
  const [players, setPlayers] = useState(game.players)
  const [turn, setTurn] = useState(game.turn)
  const [winner, setWinner] = useState(game.winner)
  const [selected, setSelected] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<{ move: string; attackerId: string; attackerStatus: string | null; missed: boolean; glitchCorrupted: boolean } | null>(null)

  useChannel(
    process.env.NEXT_PUBLIC_GOPUSHER_CLIENT_KEY!,
    `game-${game.id}`,
    'phase-changed',
    (data: { phase: string; turn?: string | null; players: GamePlayer[] }) => {
      setPhase(data.phase)
      setPlayers(data.players)
      if (data.turn !== undefined) setTurn(data.turn)
    }
  )

  // fired by makeMove() in move.ts
  useChannel(
    process.env.NEXT_PUBLIC_GOPUSHER_CLIENT_KEY!,
    `game-${game.id}`,
    'move-made',
    (data: { move: string; missed: boolean; glitchCorrupted: boolean; myHp: number; myStatus: string | null; myCooldowns: Record<string, number>; opponentHp: number; opponentStatus: string | null; nextTurn: string }) => {
      // attacker is whoever is NOT nextTurn
      const attacker = players.find((p) => p.playerId !== data.nextTurn)
      const attackerId = attacker?.playerId ?? ''
      const attackerStatus = attacker?.status ?? null
      setLastMove({ move: data.move, attackerId, attackerStatus, missed: data.missed, glitchCorrupted: data.glitchCorrupted })
      setPlayers((prev) =>
        prev.map((p) =>
          p.playerId === data.nextTurn
            ? { ...p, hp: data.opponentHp, status: data.opponentStatus }
            : { ...p, hp: data.myHp, status: data.myStatus, cooldowns: data.myCooldowns }
        )
      )
      setTurn(data.nextTurn)
    }
  )

  // fired by makeMove() in move.ts when a hit brings hp to 0
  useChannel(
    process.env.NEXT_PUBLIC_GOPUSHER_CLIENT_KEY!,
    `game-${game.id}`,
    'game-ended',
    (data: { winner: string }) => {
      setPhase('ended')
      setWinner(data.winner)
    }
  )

  const me = players.find((p) => p.playerId === myPlayerId)
  const opponent = players.find((p) => p.playerId !== myPlayerId)

  if (phase === 'lobby') return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Wachten voor tegenstander</div>

  if (phase === 'build') {
    if (me?.ready) return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Wachten voor tegenstander</div>
    if (!selected) {
      return (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <h1>Kies character</h1>
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginTop: '1rem' }}>
            {characters.map((c) => (
              <button key={c.id} onClick={() => setSelected(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <p>Je koos: {selected}</p>
        <button onClick={() => chooseCharacter(game.id, selected)}>
          READY
        </button>
      </div>
    )
  }

  if (phase === 'battle' && me && opponent) {
    return (
      <BattleView
        gameId={game.id}
        me={me}
        opponent={opponent}
        turn={turn}
        lastMove={lastMove}
        myPlayerId={myPlayerId}
      />
    )
  }

  if (phase === 'ended') {
    return (
      <div>
        <h1>{winner === myPlayerId ? 'Je hebt gewonnen!' : 'Je hebt verloren!'}</h1>
      </div>
    )
  }

  return <div>Onbekende fase: {phase}</div>
}
