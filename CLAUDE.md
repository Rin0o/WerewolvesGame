# Werewolves of Miller's Hollow — Claude Context

## Project Overview
A React Native (Expo) mobile app for the social deduction game "The Werewolves of Miller's Hollow". All game logic runs client-side coordinated via Firebase Firestore. No backend server.

## Tech Stack
- **Expo ~57** (React Native 0.86, React 19.2) — New Architecture only
- **expo-audio** — sound effects (`useSoundEffect`); replaced `expo-av`, which was removed in SDK 55
- `android/` is committed; after changing `app.json` or native deps, rerun `npx expo prebuild --platform android` (clears and regenerates by default)
- **Firebase 10** — Firestore (real-time game state) + Anonymous Auth
- **React Navigation 6** — Native Stack (`createNativeStackNavigator`)
- **AsyncStorage** — local per-player notes/suspicions only

## Folder Structure
```
/App.js                      — Root: NavigationContainer + Stack (initial route: Launch)
/app/
  /screens/
    LaunchScreen.js          — Full-screen background + play button; entry point
    HomeScreen.js            — Nickname input, create/join room
    LobbyScreen.js           — Room code, game mode selector, role config, player list
    RoleRevealScreen.js      — Private role card shown to each player
    NightPhaseScreen.js      — Night actions (wolf kill, seer reveal, witch, cupid, thief)
    DayPhaseScreen.js        — Day discussion, accusation, voting, lynch result
    GameOverScreen.js        — Winner reveal, full role dump, event log
  /components/
    PlayerCard.js            — Reusable player row with suspicion/role chip display;
                               props: avatarIcon (overrides letter avatar), avatarIconSize (default 40),
                               noDeadOpacity (suppresses opacity:0.45 on dead rows)
    NotesPanel.js            — Slide-up modal: player board (card-per-player with suspicion
                               strip + role picker), notepad, clue log; does NOT receive
                               roles prop (role reveal is day-screen-only); uses setSuspicion
                               (direct level set) from usePlayer rather than cycleSuspicion
    WerewolfChat.js          — Real-time Firestore chat (wolves only + narrator); accepts
                               isNarrator prop to show observer label instead of input
    Timer.js                 — Countdown with urgency styling (red at ≤10s)
    RoleCard.js              — Role card with PNG image (assets/roles/), description,
                               goal, ability; falls back to emoji if no image
    ClueLog.js               — Scrollable event history list
    PhaseTransition.js       — Animated day/night transition overlay
  /components/narrator/
    NarratorNightDashboard.js — Night view for narrator: active sub-phase, submitted
                               actions summary, full player+role roster, wolf chat
                               button, and Next/Skip button to drive the sequence
    NarratorDayDashboard.js  — Day view for narrator: per-voter live breakdown (pending
                               vs confirmed), tally bar chart with role labels, and
                               Close Votes button
  /game-logic/
    roles.js                 — assignRoles(players, composition?), checkWinCondition(),
                               getWerewolves(), getLoversPartner(), getAvailableRolesForThief()
    gameManager.js           — startGame(roomId, players, customComposition?),
                               resolveNight(), resolveLynch(), startNextNight(), hunterShoot()
    voteManager.js           — allVotesIn(), tallyVotes()
  /firebase/
    config.js                — Firebase app init — FILL IN YOUR CONFIG HERE
    authService.js           — signInAnon(), subscribeToAuth(), getCurrentUser()
    roomService.js           — All Firestore reads/writes for rooms + chat;
                               disconnectPlayer(), reconnectPlayer()
  /hooks/
    useRoom.js               — Real-time room listener → { room, loading, error }
    useGameState.js          — Derived selectors from room + playerId
    usePlayer.js             — AsyncStorage: notes, suspicions, suspected roles;
                               exposes cycleSuspicion (cycle through levels) and
                               setSuspicion(playerId, level) (direct level set)
  /constants/
    roles.js                 — ROLE enum, ROLE_DEFINITIONS, ROLE_COMPOSITIONS,
                               getCompositionForCount(), buildCustomComposition()
    theme.js                 — DAY, NIGHT, DAY_TIMER_THEME, NIGHT_TIMER_THEME theme objects (timer themes kept for reference but not used in headers)
                               + FONTS, RADIUS, SPACING
    devConfig.js             — BOT_CONFIG: enable/disable test bots (roles are random)
/assets/
  game_icon.png              — App icon (set in app.json for iOS + Android)
  home_page.png              — LaunchScreen full-screen background (stained-glass werewolf art)
  play_btn.png               — LaunchScreen play button (stained-glass style)
  day_background.png         — DayPhaseScreen full-screen ImageBackground (warm pink/peach castle)
  night_background.png       — NightPhaseScreen full-screen ImageBackground (deep purple castle)
  dawn_banner.png            — PhaseTransition banner for day transitions (red/gold stained glass)
  night_banner.png           — PhaseTransition banner for night transitions (blue/purple stained glass)
  leave.png                  — Leave/exit button image (DayPhaseScreen)
  exit_game.png              — Leave/exit button image (NightPhaseScreen)
  notes.png                  — Notes button image (DayPhaseScreen toolbar)
  accept.png                 — Confirm button for accusation modal
  cancel.png                 — Cancel button for accusation modal
  play_again.png             — Play Again button (GameOverScreen, host only)
  villagers_win.png          — Winner banner for villager victory (GameOverScreen)
  werewolves_win.png         — Winner banner for werewolf victory (GameOverScreen)
  lovers_win.png             — Winner banner for lovers victory (GameOverScreen)
  /role_actions/
    live_potion.png          — Witch save action button
    death_potion.png         — Witch poison action button
    witch_do_nothing.png     — Witch skip action button
  /role_icons/               — PNG role icons (werewolf, seer, witch, hunter, cupid, thief,
                               villager, bear_tamer, sisters); unknown.png shown as avatar for alive
                               players whose role is not revealed (day screen + NotesPanel)
  /suspicion_level_icons/    — PNG suspicion icons (neutral, innocent, suspicious,
                               very_suspicious, dead); dead.png used as avatar for dead
                               players in day screen and NotesPanel; suspect.png is the
                               default role-picker icon in NotesPanel when no role is set
  /roles/                    — PNG role card images (villager, werewolf, seer, witch,
                               hunter, thief, cupid); shown in RoleCard component
```

## Firestore Data Structure

### `rooms/{roomId}`
```
{
  code: string                    // 5-char uppercase join code
  hostId: string                  // Firebase Auth UID of host
  status: "lobby"|"night"|"day"|"ended"
  phase: number                   // Cycle count (starts at 1, increments each night)
  phaseStartedAt: ISO string      // Client-side timer sync reference
  players: [                      // Array of player objects
    { id, nickname, isAlive, isHost, isReady, isBot?, isNarrator? }
  ]
  roles: { [playerId]: role }     // NEVER expose raw to other players
  nightActions: {
    werewolf: playerId            // Who wolves picked to kill
    seer: playerId                // Who seer inspected
    witchSave: playerId           // Who witch saved (equals werewolf target if used)
    witchPoison: playerId         // Who witch poisoned
    witchSkip: true               // Witch chose no action
    cupid: [playerId, playerId]   // Two lovers chosen (phase 1 only)
    thief: role                   // Role the thief stole (phase 1 only)
  }
  witchPotions: { [playerId]: { save: bool, poison: bool } }
  eliminatedThisNight: playerId|null
  events: string[]                // Append-only game event log (written with arrayUnion)
  votes: { [voterId]: "lynch"|"spare" }
  winner: "villagers"|"werewolves"|"lovers"|null
  hunterTriggered: playerId|null  // Set when Hunter dies, cleared after shot
  lovers: [playerId, playerId]|null  // Set by Cupid on night 1
  disconnectedPlayers: string[]   // Players who clicked Leave; cleared at phase end
  gameMode: "normal"|"custom"|"narrator"  // Set by host in lobby; defaults to "normal" if absent
  customRoles: {                  // Only used when gameMode === "custom"
    playerCount: number           // Target total players (must equal effectiveCount to start)
    werewolf: number              // Count (min 1)
    seer: boolean
    witch: boolean
    hunter: boolean
    cupid: boolean
    thief: boolean
    sister: boolean              // When true, adds 2 Sister slots (counted as 2 in usedSlots)
    // villagers = playerCount − werewolf − sum(enabled specials); auto-filled
  }
}
```

### `rooms/{roomId}/werewolfChat/{messageId}`
```
{ senderId, senderNickname, text, createdAt: Timestamp }
```

## Roles

### Role Compositions (by player count)
| Players | Wolves | Seer | Witch | Hunter | Cupid | Thief | Sisters | Villagers |
|---------|--------|------|-------|--------|-------|-------|---------|-----------|
| 5       | 1      | 1    | -     | -      | -     | -     | -       | 3         |
| 6       | 1      | 1    | 1     | -      | -     | 1     | -       | 2         |
| 7       | 2      | 1    | 1     | -      | -     | 1     | -       | 2         |
| 8       | 2      | 1    | 1     | 1      | 1     | 1     | -       | 1         |
| 9       | 2      | 1    | 1     | 1      | 1     | 1     | -       | 2         |
| 10      | 3      | 1    | 1     | 1      | 1     | 1     | -       | 2         |
| 11      | 3      | 1    | 1     | 1      | 1     | 1     | -       | 3         |
| 12      | 3      | 1    | 1     | 1      | 1     | 1     | 2       | 0         |

### Win Conditions
- **Villagers win**: all werewolves eliminated (and lovers are not the last two alive)
- **Werewolves win**: werewolf count ≥ living villager count
- **Lovers win**: the two lovers are the last two players alive (overrides team allegiance)

### Night Resolution Order
1. **Thief** (phase 1 only): picks an unassigned role and immediately becomes it
2. **Cupid** (phase 1 only): links two players as lovers
3. **Werewolves**: pick a victim (`nightActions.werewolf`)
4. **Witch**: sees the victim, can save OR poison OR skip
5. **Seer**: inspects a player (result shown to seer only, no state change)
6. Host client calls `resolveNight()` once all active roles have acted

### Role Details

**Werewolf** — each night selects a villager to kill. Multiple wolves coordinate via the in-game wolf chat (Firestore subcollection).

**Seer** — each night selects a player and sees whether they are a Werewolf. The result is shown locally and the seer must dismiss it before the day phase begins (navigation deferred via `pendingDay` ref).

**Witch** — has one Save potion (revive that night's victim) and one Poison potion (kill any player). Each potion can only be used once per game. Can skip both.

**Hunter** — when eliminated (night or day), `hunterTriggered` is set to their playerId. Their screen shows a target picker. On confirm, `hunterShoot()` is called and win condition is re-checked.

**Cupid** — on night 1 only, chooses exactly 2 players to become lovers. Lovers are stored in `room.lovers`. If one lover dies, the other immediately dies of heartbreak. If the two lovers are the last alive, they win together regardless of team.

**Thief** — on night 1 only, sees all roles not assigned to any player (`getAvailableRolesForThief`). Must pick one and immediately becomes that role (including team). The swap is recorded silently in the event log ("A shadowy figure stole a role in the dark."). If no roles are available, the Thief sides with the villagers.

**Sisters** — two players who know each other's identity at game start. No night action. Their role key is `sister` (each gets the same key); `getSisters(roleMap)` returns both IDs. `useGameState` exposes `gs.isSister` and `gs.fellowSisters` (the other sister's ID). At `RoleRevealScreen`, the RoleCard shows a "Your Sister" box identical in structure to the wolves' "Fellow Werewolves" box. The custom-mode lobby toggle adds 2 slots (handled by `usedSlots` reduce counting `sister` as 2).

### Lover Chain
`eliminateWithLoverChain()` in gameManager.js handles lover death propagation. When any player is eliminated, their lover (if alive) is also eliminated immediately. This applies to wolf kills, witch poison, lynch, and hunter shot.

## Key Conventions
- **Roles are private**: `roles` map written by host on game start. Clients read `roles[myPlayerId]`. Never render other players' roles except on GameOver.
- **Host is orchestrator**: Host client detects when all night actions are in and calls `resolveNight()`. On day phase, host detects when all votes are in and calls `resolveLynch()`. Disconnected players are skipped in both checks.
- **One lynch per day**: After a successful lynch (lynchCount > spareCount) with no game winner and no Hunter triggered, `resolveLynch()` transitions directly to `status: 'night'` and increments the phase. Spared players leave the day open for another accusation.
- **Events are atomic**: All game events are written using Firestore `arrayUnion(...events)` inside the same `updateRoom()` call that changes `status`. Never use separate `addEvent()` calls from game logic — this caused race conditions where clients saw the status change before events landed.
- **Back navigation blocked**: NightPhaseScreen and DayPhaseScreen block the Android hardware back button (`BackHandler`) and iOS swipe-back gesture (`navigation.setOptions({ gestureEnabled: false })`). Players exit via an explicit "Leave" button that shows a confirmation dialog.
- **Player disconnection**: On confirmed exit, `disconnectPlayer()` adds the player to `disconnectedPlayers` (arrayUnion). On screen focus, `reconnectPlayer()` removes them (arrayRemove). At each phase end (`resolveNight`, `resolveLynch`), disconnected alive players are eliminated and `disconnectedPlayers` is cleared atomically.
- **Bot support**: `devConfig.js` exports `BOT_CONFIG { enabled, bots: [{ nickname }] }`. When enabled, bots are injected at game start. The host auto-submits bot night kills and day votes. Roles are random every game: the composition is shuffled, bots take random `werewolf`/`villager` slots (they can't play special roles), and humans get the rest, so a human can be a wolf even with bots on.
- **Game modes**: Host selects Normal, Custom, or Narrator in the lobby (`room.gameMode`). Normal uses preset `ROLE_COMPOSITIONS` tables. Custom uses `buildCustomComposition(room.customRoles)` — host configures player count, werewolf count, and special role toggles; villagers auto-fill the remainder. `startGame()` accepts an optional `customComposition` array; passing `null` falls back to the preset table.
- **Narrator mode**: Host is flagged `isNarrator: true` on their player object and excluded from role assignment, win-condition checks, vote eligibility, and the night-action bot-target pool. The narrator skips `RoleRevealScreen` and goes straight to `NightPhaseScreen`. At night they see `NarratorNightDashboard` (full role visibility, submitted actions, manual Next/Skip to advance sub-phases — no auto-timer). At day they see `NarratorDayDashboard` (per-voter live breakdown, tally bars, Close Votes button) and see all roles in the player list. `useGameState` exposes `gs.isNarrator`. The day discussion timer is hidden in narrator mode; `closeVoting()` (sets `votesClosed: true`) is the narrator's trigger to end voting, which then flows into the normal `resolveLynch` path.
- **Vote feedback**: DayPhaseScreen snapshots the vote map into local `lastLynchResult` state the moment `allVotesIn` becomes true — before `resolveLynch` wipes `votes: {}` from Firestore. The result card (verdict, tally, per-player votes, role reveal if lynched) persists until the next accusation starts.
- **Role card images**: `RoleCard` component maps role keys to static `require()` calls for PNGs in `assets/roles/`. Roles without an image (none currently) fall back to the emoji defined in `ROLE_DEFINITIONS`.
- **Launch screen**: `LaunchScreen` is the stack's `initialRouteName`. It calls `navigation.replace('Home')` on press so the back button can never return to it.
- **Timers**: Enforced client-side only. `phaseStartedAt` stored as ISO string for reference. Host auto-submits on expire.
- **No comments in code**: Code is self-documenting via naming.
- **Theme switching**: Day = warm oranges/cream (`DAY` in theme.js). Night = deep blues/purples (`NIGHT`). Each screen imports the correct theme constant directly and passes it to the `Timer` component.
- **Full-screen backgrounds**: `DayPhaseScreen` and `NightPhaseScreen` use `<ImageBackground>` as the root element with `resizeMode="cover"` to bleed edge-to-edge. `<SafeAreaView>` is nested inside. The header is a semi-transparent `<View>` (not an ImageBackground).
- **Phase screen header pattern**: Both phase screens use a `flexDirection: 'row'` `<View>` header containing: a pill-shaped phase badge (label + number), a centered flex-1 title, and a fixed-width timer slot. Day header: `rgba(255,245,230,0.95)` bg; night header: `rgba(13,8,32,0.82)` bg.
- **Glass-card pattern**: UI sections (vote panel, hunter box, player list, action boxes) use semi-transparent `rgba(...)` backgrounds so the background image remains visible. Day cards use warm cream `rgba(255,245,230,0.93)`; night action boxes use dark `rgba(10,5,28,0.78)`.
- **PhaseTransition banners**: `PhaseTransition.js` shows `dawn_banner.png` (day) or `night_banner.png` (night) instead of emojis, animated with Reanimated scale + fade via an `Animated.View` wrapper.
- **Image-only buttons**: All interactive buttons in phase screens are `<TouchableOpacity>` wrapping a `<Image>` PNG — no text labels. Text buttons remain only for in-game submit actions (e.g. "Confirm Kill", "Reveal Their Nature").
- **Phase counter 2-line format**: The phase counter in both DayPhaseScreen and NightPhaseScreen is split across two `<Text>` elements — `phaseLabel` (caption style, uppercase, letter-spaced) on line 1, and `phaseNumber` (fontSize: 22, fontWeight: '700') on line 2. Both sit inside the `phaseBadge` pill View in the header row.
- **Dead player row pattern**: In DayPhaseScreen, dead player rows use `backgroundColor: 'rgba(60,30,60,0.72)'` and a purple border. A purple-toned theme override is passed inline to PlayerCard (`text: '#F0ECFF'`, etc.). `noDeadOpacity` is set to prevent the 0.45 opacity from washing out the already-light text.
- **Player row pattern**: Player lists (day screen, night action components, HunterSection) use a plain `<View>` with a themed `backgroundColor` and `borderWidth: 2` `borderColor` that changes on selection. Day alive: `rgba(255,245,230,0.92)`; night: `rgba(20,10,50,0.82)`.
- **PlayerCard avatar slots**: `avatarIcon` prop takes full precedence over the letter-circle and dead-role-icon fallbacks. Day screen passes `unknown.png` for alive players and `dead.png` for dead players (56×56); role is already shown below the name for dead players so the role icon is not used in the avatar slot. NotesPanel follows the same logic. `avatarIconSize` defaults to 40; both screens set it to 56.
- **NotesPanel player board**: Each player gets a card (`boardCard`) with avatar + name on top and a horizontal suspicion strip below (4 level icons: innocent/neutral/suspicious/very_suspicious). Tapping an icon sets that level directly via `setSuspicion`. Dead player cards hide the suspicion strip and show an "Eliminated" label. The role picker button (top-right of each card) opens a modal with all role options; shows the role icon + name label when set.
- **Visual style**: Stained-glass medieval fantasy aesthetic consistent across all assets. Dark stone frames, jewel-toned panels, castle motifs. UI chrome (cards, overlays) should blend with this palette.

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
If Metro fails to connect, try `npx expo start --tunnel`.

## Known Limitations / Future Work
- Timers are client-side only — drifts possible on slow devices
- No server-side role validation (roles map is readable by determined clients)
- Bot support is dev/testing only — disable `BOT_CONFIG.enabled` before shipping
- Disconnected players are eliminated at the end of the phase they left in (no multi-phase grace period)
- No deep-link or session restore — if a player force-quits the app they must rejoin via the Home screen (room code needed again)
- **Seat selection**: Bear Tamer neighbors are determined by join order. A future enhancement could let players drag-reorder their seats in the lobby before game start, which would make the Bear Tamer's information more meaningful and closer to the physical game experience.
