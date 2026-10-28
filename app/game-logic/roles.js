import { ROLE, ROLE_DEFINITIONS, getCompositionForCount, isWolfRole, isPackWolf } from '../constants/roles';

const ALL_SELECTABLE_ROLES = [
  ROLE.VILLAGER, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.CUPID,
];

// Shuffle array (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Assigns roles to players and returns a map { playerId: role }
 * Also returns initial witch potions map { playerId: { save: true, poison: true } }
 */
export function assignRoles(players, composition = null) {
  const eligiblePlayers = players.filter((p) => !p.isNarrator);
  const comp = composition || getCompositionForCount(eligiblePlayers.length);
  const shuffledRoles = shuffle(comp);
  const shuffledPlayers = shuffle([...eligiblePlayers]);

  const roleMap = {};
  const witchPotions = {};

  shuffledPlayers.forEach((player, i) => {
    const role = shuffledRoles[i] || ROLE.VILLAGER;
    roleMap[player.id] = role;
    if (role === ROLE.WITCH) {
      witchPotions[player.id] = { save: true, poison: true };
    }
  });

  return { roleMap, witchPotions };
}

/**
 * Returns role definition object for a given role key.
 */
export function getRoleInfo(role) {
  return ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS[ROLE.VILLAGER];
}

/**
 * Returns the IDs of every player in the pack (werewolves and the White Wolf).
 */
export function getWerewolves(roleMap) {
  return Object.entries(roleMap)
    .filter(([, role]) => isWolfRole(role))
    .map(([id]) => id);
}

/**
 * Returns the player ID that has the given role (for unique roles).
 */
export function getPlayerWithRole(roleMap, role) {
  const entry = Object.entries(roleMap).find(([, r]) => r === role);
  return entry ? entry[0] : null;
}

/**
 * Checks win condition. Returns 'werewolves', 'villagers', 'lovers', 'white_wolf', or null.
 * Lovers win if they are the last two players alive, regardless of team.
 * The White Wolf wins alone; for the pack's majority check it counts as an opponent.
 */
export function checkWinCondition(players, roleMap, lovers = null) {
  const alive = players.filter((p) => p.isAlive && !p.isNarrator);

  if (lovers && lovers.length === 2) {
    const aliveIds = alive.map((p) => p.id);
    const bothLoversAlive = lovers.every((id) => aliveIds.includes(id));
    if (alive.length === 2 && bothLoversAlive) return 'lovers';
  }

  const pack = alive.filter((p) => isPackWolf(roleMap[p.id])).length;
  const whiteWolfAlive = alive.some((p) => roleMap[p.id] === ROLE.WHITE_WOLF);

  if (whiteWolfAlive && alive.length === 1) return 'white_wolf';
  if (pack === 0 && !whiteWolfAlive) return 'villagers';
  if (pack > 0 && pack >= alive.length - pack) return 'werewolves';
  return null;
}

/**
 * Returns roles available for the Thief to steal:
 * all implemented roles (one each) not already assigned to any player, excluding THIEF itself.
 */
export function getAvailableRolesForThief(roleMap) {
  const assigned = new Set(Object.values(roleMap));
  return ALL_SELECTABLE_ROLES.filter((r) => !assigned.has(r));
}

/**
 * Returns the roles a player could hold in this game, in ROLE_DEFINITIONS order: everything dealt
 * (roleComposition), Werewolf and Villager (a Wild Child or Wolf Hound can become them), and, when a
 * Thief was dealt, every role the Thief could steal. Without a recorded composition, every role.
 */
export function rolesInPlay(roleComposition) {
  const allRoles = Object.keys(ROLE_DEFINITIONS);
  if (!roleComposition || Object.keys(roleComposition).length === 0) return allRoles;
  const dealt = Object.keys(roleComposition);
  const stealable = dealt.includes(ROLE.THIEF) ? ALL_SELECTABLE_ROLES.filter((r) => !dealt.includes(r)) : [];
  const inPlay = new Set([...dealt, ROLE.WEREWOLF, ROLE.VILLAGER, ...stealable]);
  return allRoles.filter((r) => inPlay.has(r));
}

/**
 * Returns the partner ID for a given lover, or null if not a lover.
 */
export function getLoversPartner(playerId, lovers) {
  if (!lovers || !lovers.includes(playerId)) return null;
  return lovers.find((id) => id !== playerId) || null;
}

/**
 * Returns all player IDs assigned the Sister role.
 */
export function getSisters(roleMap) {
  return Object.entries(roleMap)
    .filter(([, role]) => role === ROLE.SISTER)
    .map(([id]) => id);
}

/**
 * Returns the players seated at the table, in seating (join) order. The narrator has no seat.
 */
export function getSeating(players) {
  return players.filter((p) => !p.isNarrator);
}

/**
 * Returns [leftId, rightId]: the nearest living seat on each side of the player, wrapping around.
 * Empty when fewer than two seated players are alive or the player isn't seated.
 */
export function getLivingNeighbours(players, playerId) {
  const seats = getSeating(players);
  const idx = seats.findIndex((p) => p.id === playerId);
  if (idx === -1 || seats.filter((p) => p.isAlive && p.id !== playerId).length === 0) return [];
  const n = seats.length;
  const nearest = (step) => {
    for (let i = 1; i < n; i++) {
      const seat = seats[(idx + step * i + n * n) % n];
      if (seat.isAlive) return seat.id;
    }
    return null;
  };
  return [nearest(-1), nearest(1)];
}

/**
 * Returns the players the Fox sniffs when pointing at targetId, in seating order:
 * the target's living neighbour on one side, the target, then the other neighbour (no duplicates).
 */
export function getFoxGroup(players, targetId) {
  const [left, right] = getLivingNeighbours(players, targetId);
  return [...new Set([left, targetId, right].filter(Boolean))];
}

export function foxSmellsWolf(players, roleMap, targetId) {
  return getFoxGroup(players, targetId).some((id) => isWolfRole(roleMap[id]));
}

export { ROLE };
