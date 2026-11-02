# GDD — Sorcerer Ascendant

## 1. Concept

1v1 turn-based combat game waar spelers hun character kiezen met unieke movesets en de tegenstander proberen te verslaan met verschillende combo's.


## 2. Data-model

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String?
  createdAt DateTime @default(now())
  player    Player?
}

model Player {
  id        String   @id @default(uuid())
  name      String
  wins      Int          @default(0)
  losses    Int          @default(0)
  createdAt DateTime     @default(now())
  user      User         @relation(fields: [userId], references: [id])
  userId    String       @unique
  games     GamePlayer[]
}

model Game {
  id        String   @id @default(uuid())
  phase     String       @default("lobby")  
  turn      String?                          
  winner    String?                          
  createdAt DateTime     @default(now())
  players   GamePlayer[]
  }

model GamePlayer {
  id        String   @id @default(uuid())
  character String?  
  ready     Boolean @default(false)
  hp            Int     @default(100)
  status    String?
  cooldowns String?  @default("{}")
  game          Game    @relation(fields: [gameId], references: [id])
  gameId        String
  player        Player  @relation(fields: [playerId], references: [id])
  playerId      String
}
```

## 3. Server actions

### Action 1 — `createGame()`

- validatie: gebruiker is ingelogd en heeft een gekoppelde Player
- DB: `prisma.game.create(...)` met phase `"lobby"`. `prisma.gamePlayer.create(...)` als eerste speler
- broadcast: geen

### Action 2 — `joinGame(gameId)`

- validatie: gebruiker is ingelogd, heeft een Player, game bestaat en hheeft minder dan 2 spelers, not niet in battle game
- DB: `prisma.gamePlayer.create(...)` voor de tweede speler; `prisma.game.update(...)` naar phase "build"
- broadcast: kanaal `game-${gameId}`, event `phase-changed`, payload `{ phase, players }`

### Action 3 — `chooseCharacter(gameId, characterId)`

- validatie: gebruiker is ingelogd, heeft een Player, character bestaat in de characters lijst, speler zit in deze game
- DB: `prisma.gamePlayer.update(...)` met character, hp `100` en ready `true`; als beide spelers ready zijn: prisma.game.update(...) naar phase "battle" en eerste beurt ingesteld
- broadcast: kanaal `game-${gameId}`, event `game-started`, payload `{ phase: "build" }`

### Action 4 — `makeMove(gameId, move)`

- validatie: gebruiker is ingelogd, game bestaat, game zit in battle-phase, het is de beurt van de speler, character is gekozen, move is geldig en niet op cooldown
- DB: prisma.gamePlayer.update(...) voor HP, status en cooldowns van beide spelers; als game eindigt: prisma.game.update(...) naar phase "ended" met winner, prisma.player.update(...) voor wins en losses
broadcast
- broadcast: bij normale beurt → event move-made, payload { move, missed, glitchCorrupted, damage, effect, myHp, myStatus, myCooldowns, opponentHp, opponentStatus, nextTurn }; bij game over → event game-ended, payload { winner, move, damage }


## 4. Realtime — kanalen en events

| Kanaal | `game-${gameId}` 
| Wie luistert | beide spelers in die game
| Events | `game-started`, `build-submitted` `move-made`, `game-ended`, `rematch-started` 

## 5. End-state

Na elke `makeMove()` controleert de server of de tegenstander nog HP heeft. Als de HP van de tegenstander 0 bereikt, eindigt de game.

In de DB: 
game.phase = "ended"
game.winner = winnaarPlayerId
game.turn = null
player.wins van de winnaar wordt met 1 verhoogd
player.losses van de verliezer wordt met verhoogd

Realtime:
Het event game-ended wordt verstuurd naar beide spelers

In de interface: 
De winnaar wordt getoond 
Nieuwe moves zijn niet mogelijk omdat de game in "ended" phase zit


---

## Klaar?

- [x] Concept is in maximaal 2 zinnen samen te vatten.
- [x] Voor elk model weet ik welke velden erin zitten en waarom.
- [x] Voor elke server action weet ik wat 'ie valideert, wat 'ie in de DB doet, en of 'ie broadcastet.
- [x] Mijn kanaal-namen zijn uniek per context (`game-${gameId}`).
- [x] Ik weet hoe het spel afgelopen is en wat er dan in de DB staat.
