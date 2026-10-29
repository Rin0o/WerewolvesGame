# Changelog

All notable changes to Werewolves of Miller's Hollow (Android). Newest version first.

## [1.2.0] — 2026-10-29

### Added
- **Seven new roles,** available in Custom and Narrator games:
  - **Fox:** each night, sniffs a player and their two neighbours to learn if a werewolf is among them. Finding none costs the Fox its power.
  - **Wild Child:** picks a role model on the first night, and becomes a werewolf if that player dies.
  - **Village Idiot:** survives the first time the village votes them out, but can no longer vote.
  - **Raven:** marks a player each night, who starts the next vote with 2 votes against them.
  - **Elder:** survives the first wolf attack. If the village kills the Elder, every villager loses their power.
  - **Big Bad Wolf:** hunts with the pack, then takes a second victim alone, until a wolf dies.
  - **Accursed Wolf-Father:** once per game, infects the pack's victim instead of killing them. They secretly join the wolves but keep their own role and power.
- **Sisters' chat:** the two Sisters can talk privately at night.
- **Dawn report:** a framed panel at the top of each day with who died (and their role), the bears, the Raven's mark and the Elder's fate. Below it, a section only you can see: your lover, your bears, a lost power. Tap its header to fold it while you vote.
- **The pack's choice:** after the hunt, every wolf sees who the pack chose and how each wolf voted.
- **The narrator chooses the roles,** with the same settings as Custom mode.
- **Bots can play the Village Idiot and the Elder.**

### Changed
- **A new look:**
  - The Home screen is now a moonlit village, with a gold settings gear.
  - The lobby is a warm inn, with the room code on a wooden sign and a candle that lights up when each player is ready.
  - The seating view shows a stained-glass table.
  - New icons for the chat send buttons and tied votes.
- **The bottom bar keeps the same order by day and night:** Options, Table, Notes, then the chats.
- **The Notes role picker** scrolls and only lists the roles in this game.
- **Updated to Expo SDK 58.**
- **The event log** now names a lynched player's role properly ("Villager", not "villager").

### Fixed
- The wolves' victory sound sometimes played after a village win, when the host pressed Play Again.
- When their timer ran out, the Saviour could protect themself and the Seer could inspect themself.
- A Thief who stole Cupid or Werewolf could lose that night's action after closing the "you stole" card.
- In games with bots, the White Wolf could be left out when no real player was free to take it, leaving fewer wolves than chosen.
- A chat message disappeared when it couldn't be sent. It now stays in the box.
- The dawn message showed role names like "bear_tamer".

## [1.1.3] — 2026-10-25

### Changed
- **Bot chat is now a lobby option.** When bots fill empty seats, the host can switch on "Bots write in the chats". It is off by default: bots then vote without posting in the day chat or the wolf chat. The Options pop-up shows whether bot chat is on.

## [1.1.2] — 2026-10-23

### Added
- **Roles in this game:** the eye button in the header lists every role dealt at the start; tap one to read it.
- **Tied vote option** in the lobby: on a tie, either nobody is lynched or the village votes once more (60 s) between the tied players only.
- **Wolf tie revote:** if the pack is split, it votes again (30 s) between the tied players; a second split means nobody dies that night.
- **Unread badges** on the day chat and wolf chat buttons.
- **Options pop-up** (gear button in the bottom bar): sound on/off, this game's rules (room code, mode, first night, tied vote) and Leave game.
- **Bot chat:** bots react to the night, voice suspicions and announce their vote before casting it (always for the player they named); wolf bots propose or agree on the night's victim in the wolf chat.
- **Close the app** link on the home screen (Android).
- 50 more bot names (80 in total).
- Tests for room QR codes, name rules, Rejoin, what each role learns about others, chat badges and bot chat.

### Changed
- **Balanced Normal-mode roles** for 5–13+ players, tuned with a 20,000-game simulation (about 45–56% village wins). 4 werewolves from 13 players, 5 from 18. The Thief is no longer dealt in Normal games.
- **Bottom bar:** tools only. Confirm vote is now a large button above the bar, shown only once you pick someone; the wolves confirm their vote the same way. Leave moved into the Options pop-up.
- **Night death screen:** a full-screen "You were eliminated" with the cause of death.
- **Seer's vision** shows the name of the player checked, with a werewolf or villager icon.
- Night waiting text is readable again (moonlight colours on a soft veil), with a new stained-glass moon.
- **Bots:** the two Sisters are always dealt as a pair (a bot can be a Sister); bots fill every empty seat, so one player can test alone (until version 2.0).

### Fixed
- A lone Sister when playing with bots: the second Sister was silently turned into a Villager.
- The Seer's vision said "That player" when the checked player died the same night.

## [1.1.1] — 2026-10-18

### Added
- **Seating view:** the table button shows everyone's seat, with your two living neighbours highlighted (useful for the Bear Tamer).
- **Your role during the game:** the eye button in the header shows your role, goal and ability, plus your pack, sister or lover.
- **Role pop-ups in the lobby:** tap any role icon to read what it does.
- **Role reading gate:** the first night only starts once everyone has tapped "I understand my role"; after a minute the host can start anyway.
- **Pack voting:** every wolf, the White Wolf included, votes for the victim and sees how the pack is voting.
- **Fill empty seats with bots:** a lobby option for Normal and Custom games.
- Full screen on Android (the system navigation bar is hidden).
- New art: table, eye and bear-growl icons.

### Changed
- Bots wait a few seconds before acting, so they never skip other players' turns.
- Werewolf seats are dealt fairly between real players and bots.
- Lighter, less boxed night screen; the elimination message is a pop-up.
- Timers: Thief and Cupid 30 s; Seer, Saviour and White Wolf 25 s; the day discussion scales with the number of living players (90 s to 4 min).

### Fixed
- The Thief's stolen role did nothing on the first night (a stolen Cupid never acted, a stolen Witch had no potions).
- The White Wolf's vote was skipped when another wolf or a bot voted first.
- The narrator was counted as a Bear Tamer neighbour.
- The narrator flag was not cleared when a new game started.

## [1.1.0] — 2026-10-11

### Added
- **White Wolf** and **Wolf Hound** roles (Custom mode).
- **First Night option** in the lobby: Quiet (wolves only meet) or Classic (official rules: wolves kill, Seer, Witch and Saviour wake).
- **Host takeover:** if the host's phone disappears, another player becomes host automatically.
- **Rejoin** a game after closing the app.
- **Join by QR code:** scan the lobby's QR code from the home screen.
- Your name is remembered, with a settings panel (name, sound).
- New launch screen artwork; tap anywhere to continue.
- Firestore security rules limit what each player may write.
- Automated tests for the game rules.

### Changed
- The Seer first wakes on night 2 (with a Quiet first night).
- Leave, Notes and Wolf Chat moved to a bottom bar at night.
- Shorter timers where nobody needs long; upgraded to React Navigation 7.
- Release builds are signed with the upload key.

### Fixed
- Hunter flow: after a night death the day continues; the next night is planned without the player just shot.
- The night order no longer breaks when a player leaves.

## [1.0.0] — 2026-10-11

First release.

- Real-time multiplayer rooms with a 5-character code, one Firestore document per room.
- Roles: Villager, Werewolf, Seer, Witch, Hunter, Cupid (lovers), Thief, Saviour, Bear Tamer and Sisters.
- Game modes: Normal (preset roles), Custom (host picks the roles) and Narrator (the host runs the game from dashboards).
- Night in sequence, one role at a time; day discussion and voting with a vote breakdown after each lynch.
- Day chat for everyone and a private wolf chat.
- Personal notes: suspicion levels, role guesses, a notepad and the event log.
- "You were eliminated" screen with the real cause of death.
- Stained-glass medieval art, day and night themes, animated transitions and sound effects.
- Expo SDK 57, with images converted to WebP.
