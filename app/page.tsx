import { verifySession } from '@/app/lib/dal'
import { logout } from '@/app/actions/auth'
import { createGame } from '@/app/actions/game'
import { prisma } from '@/src/lib/prisma'
import LobbyList from './LobbyList'

export default async function HomePage() {
  const session = await verifySession()

  const user = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: { name: true, email: true, player: { select: { id: true } } },
  })

  const games = await prisma.game.findMany({
    include: { players: { include: { player: { include: { user: { select: { name: true } } } } } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lobby</h1>
          <p className="text-sm text-foreground/60">Welkom, {user?.name}</p>
        </div>
        <div className="flex gap-2">
          <form action={createGame}>
            <button type="submit" className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-80">Nieuw spel</button>
          </form>
          <form action={logout}>
            <button type="submit" className="rounded-lg border border-foreground/20 px-4 py-2 text-sm font-medium transition hover:bg-foreground/5">Uitloggen</button>
          </form>
        </div>
      </div>

      <LobbyList initialGames={games} myPlayerId={user?.player?.id ?? null} />
    </div>
  )
}