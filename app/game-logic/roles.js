import { ROLE, ROLE_DEFINITIONS, getCompositionForCount } from '../constants/roles';

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
export function assignRoles(players) {
  const composition = getCompositionForCount(players.length);
  const shuffledRoles = shuffle(composition);
  const shuffledPlayers = shuffle([...players]);

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
 * Returns list of all werewolf player IDs for a given role map.
 */
export function getWerewolves(roleMap) {
  return Object.entries(roleMap)
    .filter(([, role]) => role === ROLE.WEREWOLF)
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
 * Checks win condition. Returns 'werewolves', 'villagers', 'lovers', or null.
 * Lovers win if they are the last two players alive, regardless of team.
 */
export function checkWinCondition(players, roleMap, lovers = null) {
  const alive = players.filter((p) => p.isAlive);

  if (lovers && lovers.length === 2) {
    const aliveIds = alive.map((p) => p.id);
    const bothLoversAlive = lovers.every((id) => aliveIds.includes(id));
    if (alive.length === 2 && bothLoversAlive) return 'lovers';
  }

  const aliveWolves = alive.filter((p) => roleMap[p.id] === ROLE.WEREWOLF).length;
  const aliveVillagers = alive.filter((p) => roleMap[p.id] !== ROLE.WEREWOLF).length;

  if (aliveWolves === 0) return 'villagers';
  if (aliveWolves >= aliveVillagers) return 'werewolves';
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
 * Returns the partner ID for a given lover, or null if not a lover.
 */
export function getLoversPartner(playerId, lovers) {
  if (!lovers || !lovers.includes(playerId)) return null;
  return lovers.find((id) => id !== playerId) || null;
}

/**
 * Returns true if the player's role is on the werewolf team.
 */
export function isWerewolf(role) {
  return role === ROLE.WEREWOLF;
}

export { ROLE };
