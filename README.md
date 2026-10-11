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
- [Testing with bots](#testing-with-bots)
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
- **10 roles:** Villager, Werewolf, Seer, Witch, Hunter, Cupid, Thief, Saviour, Bear Tamer and Sisters.
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
| **Night 1** | Thief → Cupid → Werewolves (they only see each other, no kill) → Seer |
| **Later nights** | Saviour → Werewolves (choose a victim) → Witch (if she has potions left) → Seer |

Roles that aren't in the game, or whose player is dead, are skipped.

### Timers

Each timer is a maximum. A step ends as soon as its player acts, and the vote ends as soon as everyone has voted. If time runs out, the host's phone picks for that player automatically.

| Step | Time limit |
|---|---|
| Thief, Cupid, Werewolves on night 1 | 15 s |
| Seer, Saviour | 30 s |
| Werewolves on later nights, Witch | 45 s |
| Day discussion and vote | 4 min |
| Hunter's last shot | 20 s |
| Vote result screen | 8 s |

### Win conditions

- **Villagers** win when every werewolf is dead.
- **Werewolves** win when living werewolves are at least as many as all other living players.
- **Lovers** win when the two lovers are the last two players alive, whatever their teams.

---

## Roles

| Role | Team | Ability |
|---|---|---|
| **Villager** | Village | No ability. Finds the wolves through discussion and votes. |
| **Werewolf** | Wolves | Each night (from night 2) the wolves pick a victim together, coordinating in the wolf chat. |
| **Seer** | Village | Each night, chooses a player and learns whether they are a werewolf. |
| **Witch** | Village | Has one healing potion (saves that night's victim) and one poison potion (kills any player). Each potion can be used once per game. |
| **Hunter** | Village | When eliminated, by night or by vote, immediately shoots one player of their choice. If the Hunter died at night, the day continues normally after the shot; if they were voted out, night falls. |
| **Cupid** | Village | On night 1, links two players as lovers. If one lover dies, the other dies of heartbreak. |
| **Thief** | Village | On night 1, takes one of the roles nobody was dealt (Villager, Werewolf, Seer, Witch, Hunter, Cupid) and plays as that role from then on. If none is available, stays with the village. |
| **Saviour** | Village | Each night (from night 2), protects one other player from the werewolves. Can't protect the same player two nights in a row. |
| **Bear Tamer** | Village | No action. If either neighbour is a werewolf, a public growl is announced at dawn. Neighbours follow join order and wrap around. |
| **Sisters** (2) | Village | Know each other's identity from the start. No night action. |

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

Roles are shuffled and dealt at random at the start of every game. In **Custom** mode the host sets the werewolf count and switches each special role on or off, and Villagers fill the remaining slots.

---

## Tech stack

| Part | Technology |
|---|---|
| App | Expo SDK 57, React Native 0.86, React 19.2 (New Architecture only) |
| Navigation | React Navigation 6 (native stack) |
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

### Game events are written atomically
Each event-log entry is written in the same Firestore update that changes the game status (`arrayUnion` inside a single `updateRoom`).

*Why:* separate writes caused race conditions. Phones saw the new status before the matching events had arrived.

### Fast screen changes
- Starting a game writes the night status straight away. Deleting the previous game's wolf chat runs in parallel instead of blocking.
- `useRoom` keeps the last snapshot of the room, so the next screen draws immediately instead of waiting for Firestore again.

### Random roles, even with test bots
The role list is shuffled every game. Test bots can only play werewolf or villager, so they draw random slots of those two, and humans get everything else. A human can still be dealt a werewolf.

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
  constants/               Roles, compositions, theme, icons, dev settings (bots)
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
5. Set the Firestore rules. At minimum, signed-in users need access to rooms and their chat subcollections:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

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

## Testing with bots

[`app/constants/devConfig.js`](app/constants/devConfig.js) can add test bots, so you can try a game with fewer than 5 people:

```js
export const BOT_CONFIG = {
  enabled: true,
  bots: [{ nickname: 'Bot 1' }, { nickname: 'Bot 2' }, ...],
};
```

- Bots are dealt random werewolf or villager roles.
- The host's phone plays for them: bot wolves pick a random victim and bots cast random votes.
- **Bots are currently disabled** (`enabled: false`). Make sure they're off again before building an APK to share.

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

- **Roles are not secret from a determined player.** Every phone receives the full room document, including all roles, so a technically minded player could read them. Fixing this would need server-side logic, such as Cloud Functions, plus stricter Firestore rules.
- **Open Firestore rules.** Any signed-in user, including anonymous ones, can read and write any room. The Firebase web configuration in `config.js` isn't a secret in itself; protection depends entirely on the rules.
- **Timers run on each phone**, so they can drift slightly on slow devices.
- **Leaving mid-game:** a player who taps *Leave* is eliminated at the end of the current phase, unless they come back before it ends. If it's their turn at night when they leave, the game moves on to the next step immediately.
- **Host takeover needs everyone on this version**, and it is turned off in Narrator games once they start.
- If the host's phone dies in the middle of resolving a night, the new host resolves it again, which can duplicate a few event-log lines.
- **Bear Tamer neighbours** are based on join order, not on where people actually sit.
- **React Navigation 6** is behind the current major version; upgrading to 7 is a future task.

---

## Ideas for the future

- **New roles:** White Wolf and Wolf Hound (artwork is already in `assets-src/roles/`).
- **Seat order in the lobby,** so the Bear Tamer reflects the real table.
- **Automated tests** for the game rules: role dealing, win conditions, night order and the lover chain.
- **Server-side role secrecy and stricter Firestore rules.**
- **An iOS build.**
- **Open the game from the phone's own camera** by registering the `werewolves://` link scheme.
