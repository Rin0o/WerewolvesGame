# Werewolves of Miller's Hollow — Claude Context

## Project Overview
A React Native (Expo) mobile app for the social deduction game "The Werewolves of Miller's Hollow". All game logic runs client-side coordinated via Firebase Firestore. No backend server.

## Tech Stack
- **Expo ~51** (React Native)
- **Firebase 10** — Firestore (real-time game state) + Anonymous Auth
- **React Navigation 6** — Native Stack
- **AsyncStorage** — local per-player notes/suspicions only

## Folder Structure
```
/App.js                      — Root: NavigationContainer + Stack
/app/
  /screens/
    HomeScreen.js            — Nickname input, create/join room
    LobbyScreen.js           — Room code display, player list, start game
    RoleRevealScreen.js      — Private role card shown to each player
    NightPhaseScreen.js      — Night actions (wolf kill, seer reveal, witch)
    DayPhaseScreen.js        — Day discussion, accusation, voting, lynch
    GameOverScreen.js        — Winner reveal, full role dump, event log
  /components/
    PlayerCard.js            — Reusable player row with suspicion/role display
    VotePanel.js             — Lynch/Spare buttons + revealed vote counts
    NotesPanel.js            — Slide-up modal: player board, notepad, clue log
    WerewolfChat.js          — Real-time Firestore chat (wolves only, night only)
    Timer.js                 — Countdown with urgency styling (red at ≤10s)
    RoleCard.js              — Full role card with emoji, description, goal, ability
    ClueLog.js               — Scrollable event history list
  /game-logic/
    roles.js                 — assignRoles(), checkWinCondition(), getWerewolves()
    gameManager.js           — startGame(), resolveNight(), resolveLynch(), hunterShoot()
    voteManager.js           — allVotesIn(), tallyVotes()
  /firebase/
    config.js                — Firebase app init — FILL IN YOUR CONFIG HERE
    authService.js           — signInAnon(), subscribeToAuth(), getCurrentUser()
    roomService.js           — All Firestore reads/writes for rooms + chat
  /hooks/
    useRoom.js               — Real-time room listener → { room, loading, error }
    useGameState.js          — Derived selectors from room + playerId
    usePlayer.js             — AsyncStorage: notes, suspicions, suspected roles
  /constants/
    roles.js                 — ROLE enum, ROLE_DEFINITIONS, ROLE_COMPOSITIONS
    theme.js                 — DAY and NIGHT theme objects + FONTS, RADIUS, SPACING
```

## Firestore Data Structure

### `rooms/{roomId}`
```
{
  code: string                    // 5-char uppercase join code
  hostId: string                  // Firebase Auth UID of host
  status: "lobby"|"night"|"day"|"ended"
  phase: number                   // Night/day cycle count (starts at 1)
  phaseStartedAt: ISO string      // Client-side timer sync reference
  players: [                      // Array — updated atomically via arrayUnion/Filter
    { id, nickname, isAlive, isHost, isReady }
  ]
  roles: { [playerId]: role }     // NEVER expose raw to other players
  nightActions: {
    werewolf: playerId            // Who wolves picked to kill
    seer: playerId                // Who seer inspected
    witchSave: playerId           // Who witch saved (equals werewolf target if used)
    witchPoison: playerId         // Who witch poisoned
    witchSkip: true               // Witch chose no action
  }
  witchPotions: { [playerId]: { save: bool, poison: bool } }
  eliminatedThisNight: playerId|null
  events: string[]                // Append-only game event log
  votes: { [voterId]: "lynch"|"spare" }
  accusedPlayerId: string|null
  winner: "villagers"|"werewolves"|null
  hunterTriggered: playerId|null  // Set when Hunter dies, cleared after shot
}
```

### `rooms/{roomId}/werewolfChat/{messageId}`
```
{ senderId, senderNickname, text, createdAt: Timestamp }
```

## Role Logic

### Role Compositions (by player count)
| Players | Wolves | Seer | Witch | Hunter | Villagers |
|---------|--------|------|-------|--------|-----------|
| 5       | 1      | 1    | -     | -      | 3         |
| 6       | 1      | 1    | 1     | -      | 3         |
| 7       | 2      | 1    | 1     | -      | 3         |
| 8+      | 2-3    | 1    | 1     | 1      | rest      |

### Win Conditions
- **Villagers win**: all werewolves eliminated
- **Werewolves win**: werewolf count ≥ living villager count

### Night Resolution Order
1. Werewolves pick victim (`nightActions.werewolf`)
2. Witch sees victim, can save OR poison OR skip
3. Seer inspects a player (info only, no state change)
4. Host client calls `resolveNight()` once all actions are submitted

### Hunter Special
- When eliminated (night or day), `hunterTriggered` is set to their playerId
- Hunter's client sees a target picker; on submit calls `hunterShoot()`
- Win condition re-checked after hunter shot

## Key Conventions
- **Roles are private**: `roles` map is written by host on game start. Clients read their own role via `roles[myPlayerId]`. Never render `roles` for other players except on GameOver screen.
- **Host is orchestrator**: The host client is responsible for detecting when all night actions are in and calling `resolveNight()`. On day phase, host detects when all votes are in and calls `resolveLynch()`.
- **Firestore security rules** (to be configured in Firebase Console):
  - Allow read on `rooms/{roomId}` to any authenticated user
  - Allow write on `rooms/{roomId}` only to authenticated users
  - Allow read/write on `werewolfChat` subcollection only during night phase
  - Consider Cloud Functions for server-side validation in production
- **Timers**: Enforced client-side only. `phaseStartedAt` is stored as ISO string for reference. No Cloud Functions enforce timeouts — the host client auto-submits on expire.
- **No comments in code**: Per project convention, code is self-documenting via naming.
- **Theme switching**: Day = warm oranges/cream (`DAY` in theme.js). Night = deep blues/purples (`NIGHT`). Each screen imports the correct theme constant directly.

## Firebase Setup (Required Before Running)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Anonymous Authentication** (Build → Authentication → Sign-in method)
4. Create a **Firestore Database** (Build → Firestore Database)
5. Copy your web app config into `app/firebase/config.js`
6. Set Firestore rules (at minimum):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if request.auth != null;
      match /werewolfChat/{messageId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

## Running the App
```bash
npm install
npx expo start
```
Scan the QR code with Expo Go (iOS/Android) or press `a`/`i` for emulators.

## Known Limitations / Future Work
- Timers are client-side only — drifts possible on slow devices
- No server-side role validation (roles map is readable by determined clients)
- Wolf chat not cleared between games (cosmetic only)
- Hunter shooting during night phase resolves immediately; during day it shows picker on GameOver boundary — review `hunterTriggered` flow if issues arise
- Reconnection: if a player closes and reopens the app mid-game, navigating back to the correct screen requires passing params again (no deep-link/session restore yet)
