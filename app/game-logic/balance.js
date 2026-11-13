import {
  BALANCE_POINTS_PER_LOGIT,
  BALANCE_BASE_POINTS,
  BALANCE_WOLF_SHARE_POINTS,
  BALANCE_PER_PLAYER_POINTS,
  BALANCE_BOT_SHARE_POINTS,
  BALANCE_CLASSIC_FIRST_NIGHT_POINTS,
  BALANCE_REVOTE_POINTS,
  BALANCE_WOLF_ROLES,
  BALANCE_ROLE_POINTS,
  BALANCE_BANDS,
} from '../constants/balance';

/**
 * The estimated share of games the village wins with this composition (an array of role keys, one per
 * player) and lobby settings. A logistic model fitted on simulated games; the weights live in
 * constants/balance.js. Returns null for an empty composition.
 */
export function estimateVillageWin(composition, { bots = 0, classicFirstNight = false, revote = false } = {}) {
  const players = composition.length;
  if (players === 0) return null;
  const wolves = composition.filter((role) => BALANCE_WOLF_ROLES.includes(role)).length;
  const points = BALANCE_BASE_POINTS
    + composition.reduce((sum, role) => sum + (BALANCE_ROLE_POINTS[role] || 0), 0)
    + BALANCE_WOLF_SHARE_POINTS * (wolves / players)
    + BALANCE_PER_PLAYER_POINTS * players
    + BALANCE_BOT_SHARE_POINTS * (bots / players)
    + (classicFirstNight ? BALANCE_CLASSIC_FIRST_NIGHT_POINTS : 0)
    + (revote ? BALANCE_REVOTE_POINTS : 0);
  return 1 / (1 + Math.exp(-points / BALANCE_POINTS_PER_LOGIT));
}

export function balanceVerdict(villageWin) {
  const { balanced, strongly } = BALANCE_BANDS;
  if (villageWin === null) return null;
  if (villageWin >= 1 - strongly) return { side: 'village', label: 'Strongly favours the village' };
  if (villageWin > 1 - balanced) return { side: 'village', label: 'Favours the village' };
  if (villageWin <= strongly) return { side: 'wolves', label: 'Strongly favours the wolves' };
  if (villageWin < balanced) return { side: 'wolves', label: 'Favours the wolves' };
  return { side: 'balanced', label: 'Balanced' };
}
