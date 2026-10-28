# Werewolves of Miller's Hollow

A mobile app for playing the social deduction game *The Werewolves of Miller's Hollow* with friends in the same room. Each player uses their own phone: it shows them their secret role, lets them act at night, and runs the day vote. No game master or cards are needed.

Built with React Native (Expo) and Firebase. There is no backend server: all game logic runs on the players' phones and is coordinated through a single Firestore document per room.

**Current version: 1.0.0** (Android)

> Unofficial fan project. *The Werewolves of Miller's Hollow* was designed by Philippe des Pallières and Hervé Marly and is published by Asmodee / Lui-même.

---

## Contents

- [Features](#features)
- [How a game works](#how-a-game-works)
- [Roles](#roles)
- [Tech stack](#tech-stack)
- [Architecture and key decisions](#architecture-and-key-decisions)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Building an Android APK](#building-an-android-apk)
- [Images and assets](#images-and-assets)
- [Automated tests](#automated-tests)
- [Bots](#bots)
- [Versioning and releases](#versioning-and-releases)
- [Known limitations](#known-limitations)
- [Ideas for the future](#ideas-for-the-future)

---

## Features

- **Your name is remembered:** players choose a name the first time they open the app. It's saved on the phone and can be changed later in ⚙️ settings on the Home screen, which also has a sound on/off switch and shows the app version.
- **Rooms with a 5-letter code:** one player creates a room and the others join by typing the code or scanning a QR code the lobby can show. Two players in the same room can't use the same name.
- **Three game modes:**
  - **Normal:** roles are picked automatically for the number of players.
  - **Custom:** the host chooses the number of werewolves and which special roles are in play.
  - **Narrator:** the host doesn't play. They choose the roles as in Custom mode (the player count doesn't include them), then run the game from dashboards that show every role and every action.
- **18 roles:** Villager, Werewolf, Seer, Witch, Hunter, Cupid, Thief, Saviour, Bear Tamer, Sisters, Fox, Wild Child, Village Idiot, Raven, Big Bad Wolf, Accursed Wolf-Father, White Wolf and Wolf Hound.
- **Lobby options:** a Quiet or Classic first night, what happens on a tied vote (no lynch, or one revote between the tied players), and bots to fill empty seats (see [Bots](#bots)). Tap any role icon in the lobby to read what that role does.
- **Private chats:** the werewolves have their own chat at night, and there's a day chat for everyone. A red badge on the chat button counts new messages.
- **Seating view:** the table button at night and during the day shows the table. Your two current neighbours are highlighted, and eliminated players are skipped.
- **Personal notes:** each player can mark suspicion levels, guess roles (only roles that can be in this game are offered) and keep a notepad. These stay on their phone only.
- **Game log:** an event history, plus a full role reveal at the end.
- **Resilience:**
  - If the host's phone disappears, another player automatically becomes host.
  - A player who closes the app can rejoin the game in progress.
- **Look:** stained-glass medieval art, with day and night themes, transitions and sound effects.

---

## How a game works

1. **Lobby:** players join with the room code (typed, or scanned from the QR code behind the lobby's Show QR button) and mark themselves ready. The host picks a game mode and starts. A game needs at least 5 players.
2. **Role reveal:** each player privately sees their role card. Werewolves also see the other werewolves, and the two Sisters see each other. The night only starts once everyone has tapped "I understand my role"; after a minute the host can start anyway. During the game, the eye button in the header shows your role again, along with your pack, sister or lover, and every role in this game as it was dealt.
3. **Night:** roles wake up one at a time in a fixed order. Only the player whose turn it is sees an action; everyone else sees a "the village sleeps" screen.
4. **Dawn:** the app announces who died. If a Bear Tamer is alive and sits next to a werewolf, the bear also growls.
5. **Day:** players discuss, using the day chat if they want, then each votes for a player.
   - The player with the most votes is eliminated, and their role is revealed. (The Village Idiot survives the first time, and a player marked by the Raven starts with 2 votes; see Roles.)
   - No votes at all means nobody dies. A tie also means nobody dies, unless the host chose "Vote again" in the lobby: then the village votes once more (60 s), only between the tied players, and a second tie spares everyone.
   - Either way, night falls next.
6. The game alternates between night and day until someone wins. The game-over screen shows the winner, every role and the full event log. The host can then start a new game in the same room.

### Night order

| Night | Order |
|---|---|
| **Night 1 — Quiet** (default) | Thief → Cupid → Wild Child (picks a role model) → Wolf Hound (picks a side) → Werewolves (they only see each other, no kill). The Seer, Witch and Saviour sleep. |
| **Night 1 — Classic** | Thief → Cupid → Wild Child → Wolf Hound → Saviour → Fox → Werewolves (choose a victim) → Wolf-Father → Big Bad Wolf → Witch → Seer → Raven |
| **Later nights** | Saviour → Fox (until it loses its power) → Werewolves (choose a victim) → Wolf-Father (until he infects someone) → Big Bad Wolf (until a wolf dies) → White Wolf (even nights only) → Witch (if she has potions left) → Seer → Raven |

The host picks **Quiet** or **Classic** for the first night in the lobby; everyone sees the choice. Classic follows the official rules. Roles that aren't in the game, or whose player is dead, are skipped.

### Timers

Each timer is a maximum. A step ends as soon as its player acts, and the vote ends as soon as everyone has voted. If time runs out, the host's phone picks for that player automatically.

| Step | Time limit |
|---|---|
| Wolf Hound, Werewolves on a Quiet night 1 | 15 s |
| Seer, Saviour, White Wolf | 25 s |
| Thief, Cupid | 30 s |
| Werewolves when hunting, Witch | 45 s |
| Day discussion and vote | 30 s per living player, between 90 s and 4 min (set when the day starts) |
| Hunter's last shot | 20 s |
| Vote result screen | 8 s |

### Win conditions

- **Villagers** win when every werewolf, White Wolf included, is dead.
- **Werewolves** win when living werewolves are at least as many as all other living players. A living White Wolf counts as one of the "others".
- **White Wolf** wins alone as the last player alive.
- **Lovers** win when the two lovers are the last two players alive, whatever their teams.

---

## Roles

| Role | Team | Ability |
|---|---|---|
| **Villager** | Village | No ability. Finds the wolves through discussion and votes. |
| **Werewolf** | Wolves | Each night every wolf (the White Wolf, Big Bad Wolf, Wolf-Father and any infected player included) votes for a victim, coordinating in the wolf chat; the most-voted player is taken. If the pack is split, it votes once more (30 s) only between the tied players; if it's split again, nobody dies that night. When the hunt ends, every wolf sees a card with the pack's choice and the final votes, until they tap "Back to the shadows" (the rest of the night carries on meanwhile). With a Quiet first night they only meet on night 1. |
| **Seer** | Village | Each night chooses a player and learns whether they are a werewolf. With a Quiet first night, starts on night 2. |
| **Witch** | Village | Has one healing potion (saves that night's victim) and one poison potion (kills any player). Each potion can be used once per game. |
| **Hunter** | Village | When eliminated, by night or by vote, immediately shoots one player of their choice. If the Hunter died at night, the day continues normally after the shot; if they were voted out, night falls. |
| **Cupid** | Village | On night 1, links two players as lovers. If one lover dies, the other dies of heartbreak. |
| **Thief** | Village | On night 1, takes one of the roles nobody was dealt (Villager, Werewolf, Seer, Witch, Hunter, Cupid) and plays as that role from then on, starting that same night. If none is available, stays with the village. |
| **Saviour** | Village | Each night (from night 2), protects one other player from the werewolves. Can't protect the same player two nights in a row. |
| **Bear Tamer** | Village | No action. If either neighbour is a werewolf, a public growl is announced at dawn. Neighbours are the nearest living players in join order, wrapping around (the narrator has no seat). The seating view shows every player their own neighbours. |
| **Sisters** (2) | Village | Know each other's identity from the start. No night action, but they have a private chat that is open only at night. |
| **Fox** | Village | Each night (from night 2 with a Quiet first night) may point at another player and learns whether that player or either of their living neighbours is a werewolf. While choosing, the Fox sees exactly which players will be sniffed. If none of the three is a wolf, the Fox loses its power and never wakes again. If the timer runs out, the Fox stays hidden and keeps its power. |
| **Wild Child** | Village, then maybe Wolves | On night 1, chooses a role model (a random one if the timer runs out). While the model lives, the Wild Child is a villager, and the Seer sees them as one. If the model dies, by any cause, the Wild Child becomes a werewolf: a full-screen notice tells them privately whose death turned them and who their pack is, and they wake with the pack and use the wolf chat from then on. Nobody else is told. |
| **Village Idiot** | Village | No night action. The first time the village votes them out, they are revealed to everyone and survive, but can no longer vote: their row shows the Idiot icon and "cannot vote", and the day ends without waiting for them. A second vote against them kills them. Wolves, poison and the Hunter kill them normally. Bots can be dealt this role, and bots don't vote for a revealed Idiot unless nobody else can be chosen. |
| **Raven** | Village | Each night (from night 2 with a Quiet first night) may mark another player, or mark no one (also what happens when the timer runs out). At dawn everyone learns who was marked, never by whom, and the marked player starts the vote with 2 votes against them: shown on their row, and as a "Raven +2" chip on the result screen. Those 2 votes alone can get someone lynched, but they don't count in a tie revote. If the marked player dies that night, the mark is lost; if the Raven dies, the mark still counts. |
| **Big Bad Wolf** | Wolves | Hunts and votes with the pack, and uses the wolf chat. Then, as long as no wolf has died (any werewolf, the White Wolf, a Wild Child that turned or a Wolf Hound that joined the pack), wakes again alone and may devour a second victim, or stay with the pack (also what happens when the timer runs out). The Saviour can protect against it, but the Witch's potion only saves the pack's victim. Once a wolf dies, a reminder tells the Big Bad Wolf it no longer hunts alone. |
| **Accursed Wolf-Father** | Wolves | Hunts and votes with the pack. Once per game, right after the pack has chosen, may infect the victim instead of letting them die (20 s; if time runs out the victim dies and the bite is kept). The infected player survives, keeps their own role and power (an infected Witch keeps exactly the potions she had left), and from then on also wakes with the pack, uses the wolf chat and wins with the werewolves. Dawn looks like a peaceful night and only the infected player is told, with a private notice. The Seer, Fox and Bear Tamer see them as a wolf. If the Saviour protected the victim, the bite fails and the Wolf-Father keeps it; the Witch can't "save" an infected player, so her potion isn't used. |
| **White Wolf** | Alone | Hunts with the pack, who see them as a normal werewolf. Every second night (2, 4, 6…) also wakes alone and may devour one other werewolf. Wins only as the last player alive. The Seer and the Bear Tamer detect them as a wolf. |
| **Wolf Hound** | Chosen | On night 1, secretly chooses Villager or Werewolf. Choosing the wolves makes them a werewolf straight away, so they wake with the pack that same night. If the timer runs out, they stay a Villager. |

### Roles per player count (Normal mode)

| Players | Wolves | Other roles |
|---|---|---|
| 5 | 1 | Hunter, 3 Villagers |
| 6 | 1 | Seer, 4 Villagers |
| 7 | 2 | Seer, Witch, Hunter, 2 Villagers |
| 8 | 2 | Seer, Witch, Hunter, 3 Villagers |
| 9 | 2 | Seer, Witch, Hunter, Cupid, 3 Villagers |
| 10 | 3 | Seer, Witch, Hunter, Cupid, Bear Tamer, 2 Villagers |
| 11 | 3 | Seer, Witch, Hunter, Cupid, Bear Tamer, 3 Villagers |
| 12 | 3 | Seer, Witch, Hunter, Saviour, Cupid, 2 Sisters, 2 Villagers |
| 13 | 4 | Seer, Witch, Hunter, Saviour, Cupid, Bear Tamer, 2 Sisters, 1 Villager |
| 14–17 | 4 | As for 13, plus one Villager per extra player |
| 18+ | 5 | As for 13, plus Villagers for the rest |

These tables were balanced with a simulation of 20,000 games per player count, aiming for the village to win about half the time with the default Quiet first night (a Classic first night helps the village). The Thief isn't in Normal games: every role they could steal is already dealt there, so it only appears in Custom and Narrator modes. Roles are shuffled and dealt at random at the start of every game. In **Custom** and **Narrator** modes the host sets the werewolf count and switches each special role on or off, and Villagers fill the remaining slots. The Fox, Wild Child, Village Idiot, Raven, Big Bad Wolf, Wolf-Father, White Wolf and Wolf Hound are only available in Custom and Narrator modes for now.

---

## Tech stack

| Part | Technology |
|---|---|
| App | Expo SDK 58, React Native 0.88, React 19.3 (New Architecture only) |
| Navigation | React Navigation 7 (native stack) |
| Backend | Firebase 10 (Firestore for game state, Anonymous Auth for player identity) |
| Animation | react-native-reanimated 4 |
| Audio | expo-audio |
| QR codes | `qrcode` (generated in JS, drawn with plain Views) and expo-camera (scanning) |
| Local storage | AsyncStorage (player name and sound setting, notes, suspicions, and the saved game used for rejoining) |

---

## Architecture and key decisions

### No backend: one Firestore document per room
All game state for a room lives in `rooms/{roomId}`: players, roles, night actions, votes, events, winner and so on. Every phone subscribes to that document in real time. Werewolf chat, sisters chat and day chat live in subcollections.

*Why:* there's no server to host or pay for, and the game is meant for friends playing together in one room, not strangers online.

### The host's phone runs the game
One phone, the host's, notices when a night step is finished or all votes are in. It then advances the game: it resolves the night, the lynch and the next night. Other phones only submit their own actions.

*Why:* this keeps the game consistent without a server. Only one client ever decides what happens next.

### Automatic host takeover
The host's phone increments a `hostHeartbeat` counter every 8 seconds.
- Every other phone tracks how long it has been since it last saw the counter change. It uses its own clock, so phones whose clocks disagree don't trigger false takeovers.
- After 25 seconds of silence, the next player in join order becomes host through a Firestore transaction, which only succeeds if no one else got there first. If that player is also gone, the one after them tries 6 seconds later, and so on.
- The new host carries on where the old one stopped: a night step, a timer that already ran out, or a pending vote result.
- If the old host comes back, they continue as a normal player.
- Takeover is turned off in Narrator games once they start, because only the narrator can move those forward.

### Rejoining after closing the app
Entering a lobby saves `{ roomId, playerId, nickname }` on the phone. If the app is closed and reopened, the Home screen offers **Rejoin Game**, as long as the game still exists and the player is still in it. Rejoin opens the lobby, night, day or game-over screen, whichever the game is on. Player identity is the Firebase anonymous user ID, which stays the same across app restarts.

### Joining by QR code
The lobby shows the letter code with two buttons, **Share** and **Show QR**. Show QR opens a pop-up with a QR code containing `werewolves://join/<CODE>`; it's hidden by default to keep the lobby short. **Scan QR Code** on the Home screen opens the camera, accepts only codes in that format, and then runs the same join as typing the code (name check included). The QR code is built from the `qrcode` library's matrix and drawn with plain Views, so displaying it needs no extra native module. Scanning uses expo-camera, which asks for the camera permission only (no microphone).

*Why:* in the same room it's faster than typing, and it avoids typos. The `werewolves://` prefix makes the scanner ignore unrelated QR codes. The scheme isn't registered with Android yet, so the phone's own camera app can't open the game from it.

### Firestore rules
[`firestore.rules`](firestore.rules) only allows the writes the app actually makes:

| Who | May change |
|---|---|
| Anyone signed in | Create a room as its host; read rooms (needed to join by code) |
| Someone joining | Add only themselves to a room still in the lobby (`players` + `memberIds`) |
| A member | In the lobby: leave, or flip their own ready flag. At night: their own role's night action. In the day: their own vote (not once revealed as the Village Idiot). Any time: mark themselves gone/back, take over as host (for themselves only) |
| The Hunter | Fire their shot (`players`, `winner`, `status`, `hunterTriggered`, `events`) while `hunterTriggered` is them; if the shot kills the Wild Child's role model, also turn that one Wild Child into a werewolf (`roles`, `wildChildTurnedAt`) and no other role |
| The host | Everything else, except the room code, `createdAt`, `hostId` and `memberIds` |
| Chats | Members read and post as themselves (1–500 characters); only the pack (wolf roles and an infected player) posts in the wolf chat; only the Sisters post in the sisters chat, and only at night; only the host deletes |

Rooms keep a `memberIds` list next to `players`, because rules can't search a list of player objects for the user's ID. Nobody can delete a room.

The rules are tested against the Firestore emulator (`npm run test:rules`, see [Automated tests](#automated-tests)).

*Why:* the old rules let any signed-in user rewrite any room. Roles still travel in the room document, so they're not secret (see [Known limitations](#known-limitations)).

### Game events are written atomically
Each event-log entry is written in the same Firestore update that changes the game status (`arrayUnion` inside a single `updateRoom`).

*Why:* separate writes caused race conditions. Phones saw the new status before the matching events had arrived.

### Fast screen changes
- Starting a game writes the night status straight away. Deleting the previous game's wolf and sisters chats runs in parallel instead of blocking.
- `useRoom` keeps the last snapshot of the room, so the next screen draws immediately instead of waiting for Firestore again.

### Random roles, even with bots
The role list is shuffled every game. Bots can only play werewolf or villager, so they draw random slots of those two, and humans get everything else. A human can still be dealt a werewolf.

### Lightweight images
The artwork is drawn at high resolution. The app ships resized WebP copies at about 3× their on-screen size, which cut the bundled images from about 120 MB to about 8 MB. See [Images and assets](#images-and-assets).

### Release signing that survives `prebuild`
`android/` is regenerated by `expo prebuild`, so hand edits there get lost. Release signing is therefore added by a config plugin, [`plugins/withReleaseSigning.js`](plugins/withReleaseSigning.js), which runs on every prebuild. See [Building an Android APK](#building-an-android-apk).

---

## Project structure

```
App.js                     Navigation stack (Launch → Welcome (first time only) → Home → Lobby → RoleReveal → Night ⇄ Day → GameOver)
app/
  screens/                 One file per screen
  components/              Reusable UI: role card, player card, notes panel, chats, timer,
    night-actions/         one component per role's night action
    day/                   vote result, Hunter section, dawn announcement, day chat
    narrator/              Narrator night/day dashboards
  game-logic/
    roles.js               Role assignment, win conditions, role helpers
    gameManager.js         startGame, night order, resolveNight, resolveLynch, hunterShoot (Wild Child, Village Idiot)
    hostDecisions.js       What the host decides each night and day (pure, tested); the screens only apply it
    voteManager.js         Vote counting (with the Raven's +2)
  firebase/
    config.js              Firebase project configuration
    authService.js         Anonymous sign-in
    roomService.js         All Firestore reads and writes (rooms, chats, host takeover)
  hooks/
    useRoom.js             Live room subscription (with last-snapshot cache)
    useGameState.js        Values derived from the room for the current player
    usePlayer.js           Personal notes and suspicions (AsyncStorage)
    useHostFailover.js     Host heartbeat and automatic takeover
    useUnreadMessages.js   Unread badges for the day, wolf and sisters chats
    useTurnedWolfNotice.js The private notice for a Wild Child who turned or a player the Wolf-Father infected
    useSoundEffect.js      Sound effects
  utils/session.js         Saved game for Rejoin
  utils/profile.js         Saved player name and sound setting
  utils/roomQr.js          Build and read the QR join link
  constants/               Roles, compositions, theme, icons, bot names
assets/                    WebP images used by the app, plus sounds
assets-src/                Full-resolution original artwork (not bundled)
plugins/                   Expo config plugins
android/                   Generated native Android project (committed)
CLAUDE.md                  Detailed notes for AI-assisted development
```

---

## Getting started

### Prerequisites
- Node.js 20.19.4 or newer (22 or 24 recommended)
- A Firebase project
- For running on a phone: the **Expo Go** app, signed in to an Expo account
- For building an APK: JDK 17 and the Android SDK (see the next section)

### 1. Install
```bash
npm install
```

### 2. Configure Firebase
1. Create a project in the [Firebase Console](https://console.firebase.google.com).
2. Enable **Authentication → Sign-in method → Anonymous**.
3. Create a **Firestore Database**.
4. Put your web app configuration in [`app/firebase/config.js`](app/firebase/config.js).
5. Deploy the Firestore rules from [`firestore.rules`](firestore.rules) with `firebase deploy --only firestore:rules` (Firebase CLI, logged in; the project is set in `.firebaserc`). See [Firestore rules](#firestore-rules).

### 3. Run
```bash
npx expo start
```
Scan the QR code with Expo Go. Expo Go now requires you to be signed in to the same Expo account in the terminal and in the app. If your phone can't connect, try `npx expo start --tunnel`.

---

## Building an Android APK

### One-time setup on a new computer

**1. Install CMake 3.31.6 through the Android SDK manager.** The default CMake 3.22.1 fails on Windows with `ninja: error: manifest 'build.ninja' still dirty after 100 tries`.
```bash
sdkmanager --install "cmake;3.31.6"
```

**2. Create `android/local.properties`.** This file is per-machine and not committed:
```properties
sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk
cmake.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk\\cmake\\3.31.6
```

**3. Set up the release signing key.** Without this, release builds fall back to the debug key, which is fine for testing.
- Generate a key once:
  ```bash
  keytool -genkeypair -v -storetype PKCS12 -keystore werewolves-release.jks \
    -alias werewolves -keyalg RSA -keysize 2048 -validity 10000
  ```
- Store the `.jks` file **outside the repo**.
- Add these settings to `~/.gradle/gradle.properties`, your personal Gradle settings file, also outside the repo:
  ```properties
  WEREWOLVES_UPLOAD_STORE_FILE=C:/path/to/werewolves-release.jks
  WEREWOLVES_UPLOAD_KEY_ALIAS=werewolves
  WEREWOLVES_UPLOAD_STORE_PASSWORD=...
  WEREWOLVES_UPLOAD_KEY_PASSWORD=...
  ```
- **Back up the key file and its password.** Android only installs an update over an existing app if both are signed with the same key. If the key is lost, every player has to uninstall the app before installing a new build.

### Build
```bash
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```
The APK is written to `android/app/build/outputs/apk/release/app-release.apk`. With the WebP images it's expected to be around 25–35 MB; before the image conversion it was about 150 MB.
- `arm64-v8a` covers practically every phone from the last 6–7 years and builds about four times faster. Leave the flag off to also support old 32-bit phones.
- To install on a phone, copy the APK over and open it, allowing installs from unknown sources. Or, with the phone connected over USB, run `adb install <path to apk>`.

### After changing `app.json` or native dependencies
Regenerate the native project:
```bash
npx expo prebuild --platform android
```
Prebuild **deletes and recreates `android/`**. Afterwards, re-create `android/local.properties` (see step 2). The signing setup is applied automatically by the config plugin.

---

## Images and assets

- `assets-src/` holds the **full-resolution original PNGs**. Nothing in the code may load from this folder, because Metro would bundle the full-size file.
- `assets/` holds the **WebP versions the app uses**. The only exception is `game_icon.png`, which stays PNG because Expo requires that format for the app icon.

**To add or change an image:**
1. Put the original PNG in `assets-src/`.
2. Export a WebP to the same path under `assets/`, at quality about 85 with transparency kept. Size it to about 3× its on-screen size:

| Kind of image | Size |
|---|---|
| Role and suspicion icons | 384 px |
| Small image buttons | 512–600 px |
| Banners | 900–1320 px wide |
| Role cards | 1200 px tall |
| Full-screen backgrounds | original size |

> `assets/role_icons/sisters.webp` has a transparent background edited by hand. Its original in `assets-src/` still has a black background, so don't re-export it from there.

---

## Automated tests

```bash
npm test
```

Jest (with the `jest-expo` preset) tests the game rules in [`app/game-logic/__tests__/`](app/game-logic/__tests__/), plus helpers in [`app/utils/__tests__/`](app/utils/__tests__/) and [`app/hooks/__tests__/`](app/hooks/__tests__/):

| File | Covers |
|---|---|
| `roles.test.js` | Compositions (incl. the 13+ and 18+ rules), custom compositions, random role dealing, win conditions (the Big Bad Wolf counts in the pack), seating, Thief/lover/sister helpers, the Fox's sniffed group, which roles the Notes picker offers |
| `voteManager.test.js` | Vote counting, ties and who is tied, unconfirmed votes, when all votes are in, the Raven's +2 |
| `nightOrder.test.js` | Who wakes on night 1 and later nights (Fox, Wild Child, Raven, Big Bad Wolf, Wolf-Father and an infected player included), skipping dead/absent roles, the next step, when a step is done, Thief swap timing, the pack vote and the result card the wolves see |
| `resolveNight.test.js` | Wolf kill, Saviour, Witch potions, lover chain, players who left, night 1 rules, Thief swap, Hunter, winners, Bear Tamer, the Fox losing its power, the Wild Child turning, the Raven's mark, the Big Bad Wolf's second victim, the Wolf-Father's infection (Saviour, Witch potions, once per game, the win, Fox and Bear Tamer) |
| `dayFlow.test.js` | Lynch, ties and the tie revote, lover chain, Hunter shot, winners, starting the next night, the Raven's +2 (and not in a revote), the Village Idiot spared once, the Wild Child turning by day |
| `hostDecisions.test.js` | The host's decisions: next night step, pack vote outcome, timeout defaults (never the Saviour or Seer on themselves), the narrator's Next, bot wolves, when voting is done and who can vote, timer lengths |
| `startGame.test.js` | Dealing, the role-reading gate, the recorded composition, witch potions, narrator (with the roles they chose), chat-cleanup failure, fair dealing with bots (who may hold the Sisters or the Village Idiot) |
| `bots.test.js` | How many seats bots fill (every empty one, so one player can test alone), random themed bot names, the name list itself |
| `botChat.test.js` | Who a bot votes for (never itself, the dead, its pack or a revealed Village Idiot; only the tied players in a revote), its chat lines matching that vote, wolf-chat lines |
| `roomQr.test.js` | Reading a room code from a scanned QR, rejecting other or malformed codes |
| `profile.test.js` | Player-name rules (2–18 characters, trimmed) and the case-insensitive duplicate check |
| `session.test.js` | Rejoin: which screen each room status opens, saving and clearing the session |
| `gameOverSound.test.js` | The end-of-game sound matches the winner, and nothing plays while Play Again resets the room |
| `gameState.test.js` | What each player learns about others (pack, sister, lover, Cupid, the Wild Child's role model, an infected player) — nobody else's role leaks; the turned Wild Child's and the infected player's notices |
| `unreadMessages.test.js` | Chat badge counting: own messages never count, opening the chat clears it, per room and chat |

Firestore is mocked (`roomService` and `arrayUnion`), so the tests run offline and check the exact room update each function writes. The tests don't depend on the exact rows of the composition table, so it can be retuned freely.

### Firestore rules tests

```bash
npm run test:rules
```

[`firestore-tests/rooms.rules-test.js`](firestore-tests/rooms.rules-test.js) runs 50 checks against [`firestore.rules`](firestore.rules) in the local Firestore emulator (`firebase emulators:exec`, demo project `demo-werewolves`, so nothing touches the real database). It makes the same writes the app makes (join, ready, night actions including the Fox, Wild Child, Raven, Big Bad Wolf, Wolf-Father and an infected player, votes and the revealed Village Idiot, Hunter shot and the Wild Child turning, host takeover, wolf/sisters/day chats) and checks that the wrong player can't make them. Needs the Firebase CLI and **Java 21 or newer** (the Android build still uses Java 17; point `JAVA_HOME` at a JDK 21 just for this command if needed).

---

## Bots

In **Normal** and **Custom** games the host can switch on **🤖 Fill empty seats with bots** in the lobby. Everyone sees the setting and how many bots will join, and the Start button says "Start with N bots".

- **How many:** bots fill every empty seat up to 5 players (Normal) or up to the target player count (Custom). There's no minimum number of real players for now (until version 2.0), so you can play a whole game alone against bots to try things out.
- **Names:** each game picks random villager names from [`app/constants/botNames.js`](app/constants/botNames.js) (e.g. "Old Tom 🤖", "Widow Agnes 🤖"), never repeating one and never matching a real player's name.
- **Roles:** bots only play Werewolf, Villager, Sister or Village Idiot (roles without a night action). Roles with an action always go to real players first; the two Sisters are always dealt as a pair, so if only one fits on the real players, a bot gets the other. Werewolf seats are drawn at random across the whole table, so a real player is as likely to be a wolf as a bot. A wolf only moves to a bot when the real players are needed for the special roles.
- **Behaviour:** the host's phone plays for them, with a pause so nobody's turn is skipped. Bot wolves vote a few seconds into the hunt and follow the pack's leading choice (or pick at random). Bots cast random day votes 30–90 seconds into the day, or a few seconds after every real player has voted.
- **Chat (optional):** once bots are on, the host can also switch on **💬 Bots write in the chats** (off by default; otherwise bots vote silently). To make the village feel alive, bots then talk in the day chat: a line about last night (who died, a quiet night, the bears), a suspicion about someone, and then "I'm voting for X" right before they vote for exactly that player. Wolf bots never accuse their own pack, and in the wolf chat they propose or agree on the night's victim before voting. A bot says at most three things per day and goes quiet once it's dead or the vote is over.
- Not available in Narrator mode. Play Again removes the bots; the next game adds fresh ones if the setting is still on.

---

## Versioning and releases

What changed in each version is listed in [CHANGELOG.md](CHANGELOG.md).

Versions follow **MAJOR.MINOR.PATCH**:
- **PATCH** for bug fixes.
- **MINOR** for new features, such as a new role.
- **MAJOR** when old and new app versions can no longer play together, for example after a change to the room data format.

**To release:**
1. In `app.json`, update `expo.version` and increase `expo.android.versionCode` by 1. Android only installs an update if its `versionCode` is higher than the installed one.
2. Run `npx expo prebuild --platform android`, then rebuild the APK.
3. Commit, tag, and push:
   ```bash
   git tag -a v1.1.0 -m "Version 1.1.0: ..."
   git push && git push origin v1.1.0
   ```
4. Optionally, create a GitHub Release from the tag and attach the APK.

**Everyone in a room should run the same version.** For example, a host on a version without host takeover never sends heartbeats, and would be replaced after about 25 seconds.

---

## Known limitations

- **Roles are not secret from a determined player.** Every phone receives the full room document, including all roles, so a technically minded player could read them. Rules can't hide part of a document; fixing this would need the roles moved out of the room document, with server-side logic such as Cloud Functions to deal them.
- **Rooms are readable by any signed-in user,** because joining by code has to find the room before the player is a member. Writes are restricted (see [Firestore rules](#firestore-rules)).
- **Host takeover isn't checked by the server.** The rules let any member make themselves host; only the app waits for 25 seconds of silence first.
- **Timers run on each phone**, so they can drift slightly on slow devices.
- **Leaving mid-game:** *Leave game* sits in the Options pop-up (the gear button at the end of the bottom bar) (which also has the sound switch and this game's rules), behind a confirmation, so it can't be tapped by accident. A player who leaves is eliminated at the end of the current phase, unless they come back before it ends. If it's their turn at night when they leave, the game moves on to the next step immediately.
- **Host takeover needs everyone on this version**, and it is turned off in Narrator games once they start.
- If the host's phone dies in the middle of resolving a night, the new host resolves it again, which can duplicate a few event-log lines.
- **Bear Tamer neighbours** are based on join order, not on where people actually sit.

---

## Ideas for the future

- **More wolf-side roles:** Big Bad Wolf, Accursed Wolf-Father, Wild Child.
- **A White Wolf victory banner** (it currently reuses the werewolves banner with a line of text).
- **Seat order in the lobby,** so the Bear Tamer reflects the real table.
- **Server-side role secrecy** (roles moved out of the room document).
- **An iOS build.**
- **Open the game from the phone's own camera** by registering the `werewolves://` link scheme.
