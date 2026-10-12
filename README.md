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
  - **Narrator:** the host doesn't play. Instead they run the game from dashboards that show every role and every action.
- **12 roles:** Villager, Werewolf, Seer, Witch, Hunter, Cupid, Thief, Saviour, Bear Tamer, Sisters, White Wolf and Wolf Hound.
- **Lobby options:** a Quiet or Classic first night, and bots to fill empty seats (see [Bots](#bots)).
- **Private chats:** the werewolves have their own chat at night, and there's a day chat for everyone.
- **Personal notes:** each player can mark suspicion levels, guess roles and keep a notepad. These stay on their phone only.
- **Game log:** an event history, plus a full role reveal at the end.
- **Resilience:**
  - If the host's phone disappears, another player automatically becomes host.
  - A player who closes the app can rejoin the game in progress.
- **Look:** stained-glass medieval art, with day and night themes, transitions and sound effects.

---

## How a game works

1. **Lobby:** players join with the room code (typed, or scanned from the QR code behind the lobby's Show QR button) and mark themselves ready. The host picks a game mode and starts. A game needs at least 5 players.
2. **Role reveal:** each player privately sees their role card. Werewolves also see the other werewolves, and the two Sisters see each other.
3. **Night:** roles wake up one at a time in a fixed order. Only the player whose turn it is sees an action; everyone else sees a "the village sleeps" screen.
4. **Dawn:** the app announces who died. If a Bear Tamer is alive and sits next to a werewolf, the bear also growls.
5. **Day:** players discuss, using the day chat if they want, then each votes for a player.
   - The player with the most votes is eliminated, and their role is revealed.
   - A tie, or no votes at all, means nobody dies.
   - Either way, night falls next.
6. The game alternates between night and day until someone wins. The game-over screen shows the winner, every role and the full event log. The host can then start a new game in the same room.

### Night order

| Night | Order |
|---|---|
| **Night 1 — Quiet** (default) | Thief → Cupid → Wolf Hound (picks a side) → Werewolves (they only see each other, no kill). The Seer, Witch and Saviour sleep. |
| **Night 1 — Classic** | Thief → Cupid → Wolf Hound → Saviour → Werewolves (choose a victim) → Witch → Seer |
| **Later nights** | Saviour → Werewolves (choose a victim) → White Wolf (even nights only) → Witch (if she has potions left) → Seer |

The host picks **Quiet** or **Classic** for the first night in the lobby; everyone sees the choice. Classic follows the official rules. Roles that aren't in the game, or whose player is dead, are skipped.

### Timers

Each timer is a maximum. A step ends as soon as its player acts, and the vote ends as soon as everyone has voted. If time runs out, the host's phone picks for that player automatically.

| Step | Time limit |
|---|---|
| Thief, Cupid, Wolf Hound, Werewolves on a Quiet night 1 | 15 s |
| Seer, Saviour, White Wolf | 30 s |
| Werewolves when hunting, Witch | 45 s |
| Day discussion and vote | 4 min |
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
| **Werewolf** | Wolves | Each night the wolves pick a victim together, coordinating in the wolf chat. With a Quiet first night they only meet on night 1. |
| **Seer** | Village | Each night chooses a player and learns whether they are a werewolf. With a Quiet first night, starts on night 2. |
| **Witch** | Village | Has one healing potion (saves that night's victim) and one poison potion (kills any player). Each potion can be used once per game. |
| **Hunter** | Village | When eliminated, by night or by vote, immediately shoots one player of their choice. If the Hunter died at night, the day continues normally after the shot; if they were voted out, night falls. |
| **Cupid** | Village | On night 1, links two players as lovers. If one lover dies, the other dies of heartbreak. |
| **Thief** | Village | On night 1, takes one of the roles nobody was dealt (Villager, Werewolf, Seer, Witch, Hunter, Cupid) and plays as that role from then on. If none is available, stays with the village. |
| **Saviour** | Village | Each night (from night 2), protects one other player from the werewolves. Can't protect the same player two nights in a row. |
| **Bear Tamer** | Village | No action. If either neighbour is a werewolf, a public growl is announced at dawn. Neighbours follow join order and wrap around. |
| **Sisters** (2) | Village | Know each other's identity from the start. No night action. |
| **White Wolf** | Alone | Hunts with the pack, who see them as a normal werewolf. Every second night (2, 4, 6…) also wakes alone and may devour one other werewolf. Wins only as the last player alive. The Seer and the Bear Tamer detect them as a wolf. |
| **Wolf Hound** | Chosen | On night 1, secretly chooses Villager or Werewolf. Choosing the wolves makes them a werewolf straight away, so they wake with the pack that same night. If the timer runs out, they stay a Villager. |

### Roles per player count (Normal mode)

| Players | Wolves | Other roles |
|---|---|---|
| 5 | 1 | Hunter, 3 Villagers |
| 6 | 1 | Seer, Witch, Thief, 2 Villagers |
| 7 | 2 | Seer, Witch, Thief, 2 Villagers |
| 8 | 2 | Seer, Witch, Hunter, Cupid, Thief, 1 Villager |
| 9 | 2 | Seer, Witch, Hunter, Cupid, Thief, Saviour, 1 Villager |
| 10 | 3 | Seer, Witch, Hunter, Cupid, Thief, Saviour, Bear Tamer |
| 11 | 3 | Seer, Witch, Hunter, Cupid, Thief, Saviour, Bear Tamer, 1 Villager |
| 12 | 3 | Seer, Witch, Hunter, Cupid, Thief, Saviour, Bear Tamer, 2 Sisters |
| 13+ | 3 | As for 12, plus extra Villagers |

Roles are shuffled and dealt at random at the start of every game. In **Custom** mode the host sets the werewolf count and switches each special role on or off, and Villagers fill the remaining slots. The White Wolf and Wolf Hound are only available in Custom mode for now.

---

## Tech stack

| Part | Technology |
|---|---|
| App | Expo SDK 57, React Native 0.86, React 19.2 (New Architecture only) |
| Navigation | React Navigation 7 (native stack) |
| Backend | Firebase 10 (Firestore for game state, Anonymous Auth for player identity) |
| Animation | react-native-reanimated 4 |
| Audio | expo-audio |
| QR codes | `qrcode` (generated in JS, drawn with plain Views) and expo-camera (scanning) |
| Local storage | AsyncStorage (player name and sound setting, notes, suspicions, and the saved game used for rejoining) |

---

## Architecture and key decisions

### No backend: one Firestore document per room
All game state for a room lives in `rooms/{roomId}`: players, roles, night actions, votes, events, winner and so on. Every phone subscribes to that document in real time. Werewolf chat and day chat live in subcollections.

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
| A member | In the lobby: leave, or flip their own ready flag. At night: their own role's night action. In the day: their own vote. Any time: mark themselves gone/back, take over as host (for themselves only) |
| The Hunter | Fire their shot (`players`, `winner`, `status`, `hunterTriggered`, `events`) while `hunterTriggered` is them |
| The host | Everything else, except the room code, `createdAt`, `hostId` and `memberIds` |
| Chats | Members read and post as themselves (1–500 characters); only werewolves (White Wolf included) post in the wolf chat; only the host deletes |

Rooms keep a `memberIds` list next to `players`, because rules can't search a list of player objects for the user's ID. Nobody can delete a room.

The rules are tested against the Firestore emulator (`npm run test:rules`, see [Automated tests](#automated-tests)).

*Why:* the old rules let any signed-in user rewrite any room. Roles still travel in the room document, so they're not secret (see [Known limitations](#known-limitations)).

### Game events are written atomically
Each event-log entry is written in the same Firestore update that changes the game status (`arrayUnion` inside a single `updateRoom`).

*Why:* separate writes caused race conditions. Phones saw the new status before the matching events had arrived.

### Fast screen changes
- Starting a game writes the night status straight away. Deleting the previous game's wolf chat runs in parallel instead of blocking.
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
    gameManager.js         startGame, night order, resolveNight, resolveLynch, hunterShoot
    voteManager.js         Vote counting
  firebase/
    config.js              Firebase project configuration
    authService.js         Anonymous sign-in
    roomService.js         All Firestore reads and writes (rooms, chats, host takeover)
  hooks/
    useRoom.js             Live room subscription (with last-snapshot cache)
    useGameState.js        Values derived from the room for the current player
    usePlayer.js           Personal notes and suspicions (AsyncStorage)
    useHostFailover.js     Host heartbeat and automatic takeover
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

Jest (with the `jest-expo` preset) tests the game rules in [`app/game-logic/__tests__/`](app/game-logic/__tests__/):

| File | Covers |
|---|---|
| `roles.test.js` | Compositions, custom compositions, random role dealing, win conditions, Thief/lover/sister helpers |
| `voteManager.test.js` | Vote counting, ties, unconfirmed votes, when all votes are in |
| `nightOrder.test.js` | Who wakes on night 1 and later nights, skipping dead/absent roles, the next step, when a step is done |
| `resolveNight.test.js` | Wolf kill, Saviour, Witch potions, lover chain, players who left, night 1 rules, Thief swap, Hunter, winners, Bear Tamer |
| `dayFlow.test.js` | Lynch, ties, lover chain, Hunter shot, winners, starting the next night |
| `startGame.test.js` | Dealing, witch potions, narrator, chat-cleanup failure, bots |
| `bots.test.js` | How many seats bots may fill (half-table cap), random themed bot names |

Firestore is mocked (`roomService` and `arrayUnion`), so the tests run offline and check the exact room update each function writes. The tests don't depend on the exact rows of the composition table, so it can be retuned freely.

### Firestore rules tests

```bash
npm run test:rules
```

[`firestore-tests/rooms.rules-test.js`](firestore-tests/rooms.rules-test.js) runs 30 checks against [`firestore.rules`](firestore.rules) in the local Firestore emulator (`firebase emulators:exec`, demo project `demo-werewolves`, so nothing touches the real database). It makes the same writes the app makes (join, ready, night actions, votes, Hunter shot, host takeover, chats) and checks that the wrong player can't make them. Needs the Firebase CLI and **Java 21 or newer** (the Android build still uses Java 17; point `JAVA_HOME` at a JDK 21 just for this command if needed).

---

## Bots

In **Normal** and **Custom** games the host can switch on **🤖 Fill empty seats with bots** in the lobby. Everyone sees the setting and how many bots will join, and the Start button says "Start with N bots".

- **How many:** bots fill the table up to 5 players (Normal) or up to the target player count (Custom), but never more than half the table, so there are always at least as many real players as bots. If that isn't enough, the lobby says how many more real players are needed.
- **Names:** each game picks random villager names from [`app/constants/botNames.js`](app/constants/botNames.js) (e.g. "Old Tom 🤖", "Widow Agnes 🤖"), never repeating one and never matching a real player's name.
- **Roles:** bots only play Werewolf or Villager; special roles always go to real players.
- **Behaviour:** the host's phone plays for them. Bot wolves pick a random victim and bots cast random votes.
- Not available in Narrator mode. Play Again removes the bots; the next game adds fresh ones if the setting is still on.

---

## Versioning and releases

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
- **Leaving mid-game:** a player who taps *Leave* is eliminated at the end of the current phase, unless they come back before it ends. If it's their turn at night when they leave, the game moves on to the next step immediately.
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
