import { notFound } from 'next/navigation'
import { verifySession } from '@/app/lib/dal'
import { prisma } from '@/src/lib/prisma'
import GameClient from './GameClient'

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await verifySession()

  const user = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: { player: { select: { id: true } } },
  })

  const game = await prisma.game.findUnique({
    where: { id },
    include: { players: true },
  })

  if (!game || !user?.player) notFound()

  const parsedGame = {
    ...game,
    players: game.players.map((p) => ({
      ...p,
      cooldowns: JSON.parse(p.cooldowns ?? '{}') as Record<string, number>,
    })),
  }

  return <GameClient game={parsedGame} myPlayerId={user.player.id} />
}