const VILLAGE_WINS = ['villagers', 'lovers'];
const WOLF_WINS = ['werewolves', 'white_wolf'];

export function gameOverSound(room) {
  if (!room || room.status !== 'ended') return null;
  if (VILLAGE_WINS.includes(room.winner)) return 'villagersWin';
  if (WOLF_WINS.includes(room.winner)) return 'wolvesWin';
  return null;
}
