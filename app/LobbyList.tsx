// app/LobbyList.tsx
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { joinGame } from '@/app/actions/game'

type Game = {
  id: string
  players: { player: { id: string; user: { name: string | null } } }[]
}

export default function LobbyList({
  initialGames,
  myPlayerId,
}: {
  initialGames: Game[]
  myPlayerId: string | null
}) {
  const [games, setGames] = useState<Game[]>(initialGames)

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch('/api/games')
      setGames(await res.json())
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  if (games.length === 0) {
    return <p className="text-center text-foreground/50 py-20">Nog geen spellen. Maak er een aan!</p>
  }

  return (
    <div className="space-y-3">
      {games.map((game) => {
        const playerNames = game.players.map((gp) => gp.player.user.name ?? 'Onbekend').join(', ')
        const isFull = game.players.length >= 2
        const alreadyJoined = game.players.some((gp) => gp.player.id === myPlayerId)

        return (
          <div key={game.id} className="flex items-center justify-between rounded-xl border border-foreground/10 px-5 py-4">
            <div className="min-w-0">
              <Link href={`/game/${game.id}`} className="font-medium hover:underline">Game</Link>
              <p className="text-sm text-foreground/50 truncate">
                {playerNames || 'Geen spelers'} · {game.players.length}/2 spelers
              </p>
            </div>
            {alreadyJoined ? (
              <Link href={`/game/${game.id}`} className="shrink-0 rounded-lg bg-foreground/10 px-4 py-2 text-sm font-medium transition hover:bg-foreground/20">Bekijken</Link>
            ) : isFull ? (
              <span className="shrink-0 text-sm text-foreground/40">Vol</span>
            ) : (
              <form action={joinGame.bind(null, game.id)}>
                <button type="submit" className="shrink-0 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-80">Deelnemen</button>
              </form>
            )}
          </div>
        )
      })}
    </div>
  )
}