export const ROLE = {
  VILLAGER: 'villager',
  WEREWOLF: 'werewolf',
  SEER: 'seer',
  WITCH: 'witch',
  HUNTER: 'hunter',
  CUPID: 'cupid',
  THIEF: 'thief',
};

export const ROLE_DEFINITIONS = {
  [ROLE.VILLAGER]: {
    name: 'Villager',
    emoji: '🏡',
    team: 'villagers',
    description: 'A simple resident of Miller\'s Hollow.',
    goal: 'Eliminate all Werewolves by day through discussion and voting.',
    ability: null,
  },
  [ROLE.WEREWOLF]: {
    name: 'Werewolf',
    emoji: '🐺',
    team: 'werewolves',
    description: 'A creature of darkness hiding among the villagers.',
    goal: 'Eliminate enough villagers so werewolves equal or outnumber them.',
    ability: 'Each night, secretly choose a villager to eliminate together with other werewolves.',
  },
  [ROLE.SEER]: {
    name: 'Seer',
    emoji: '🔮',
    team: 'villagers',
    description: 'A gifted mystic who can sense the true nature of others.',
    goal: 'Help the village find and eliminate all Werewolves.',
    ability: 'Each night, choose one player to learn whether they are a Werewolf or not.',
  },
  [ROLE.WITCH]: {
    name: 'Witch',
    emoji: '🧙‍♀️',
    team: 'villagers',
    description: 'A powerful herbalist with two magical potions.',
    goal: 'Help the village survive. Use your potions wisely — each can only be used once.',
    ability: 'Save Potion: revive the werewolves\' victim this night.\nPoison Potion: kill one player of your choice this night.',
  },
  [ROLE.HUNTER]: {
    name: 'Hunter',
    emoji: '🏹',
    team: 'villagers',
    description: 'A skilled tracker who never goes down without a fight.',
    goal: 'Help eliminate all Werewolves. Use your final shot well.',
    ability: 'When eliminated (day or night), immediately choose one player to take down with you.',
  },
  [ROLE.CUPID]: {
    name: 'Cupid',
    emoji: '💘',
    team: 'villagers',
    description: 'A mischievous spirit who binds two souls together with an arrow.',
    goal: 'Help the villagers win — unless your two lovers are the last players alive, in which case they win together regardless of team.',
    ability: 'On the first night only, choose any two players to become lovers. If one lover dies, the other dies of heartbreak. If the lovers are the last two alive, they win together.',
  },
  [ROLE.THIEF]: {
    name: 'Thief',
    emoji: '🃏',
    team: 'villagers',
    description: 'A mysterious stranger who arrives in the village with no identity of their own.',
    goal: 'Steal a role not yet taken by anyone else and play as that role for the rest of the game.',
    ability: 'On the first night only, you see all roles not assigned to any player. You must pick one and immediately become that role — including its team and abilities. If no roles are available, you remain a Thief (and side with the villagers).',
  },
};

// Suggested role compositions per player count
export const ROLE_COMPOSITIONS = {
  2:  [ROLE.WEREWOLF, ROLE.VILLAGER],
  3:  [ROLE.WEREWOLF, ROLE.VILLAGER, ROLE.VILLAGER],
  4:  [ROLE.WEREWOLF, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.WITCH],
  5:  [ROLE.WEREWOLF, ROLE.SEER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
  6:  [ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.THIEF, ROLE.VILLAGER, ROLE.VILLAGER],
  7:  [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.THIEF, ROLE.VILLAGER, ROLE.VILLAGER],
  8:  [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.CUPID, ROLE.THIEF, ROLE.VILLAGER],
  9:  [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.CUPID, ROLE.THIEF, ROLE.VILLAGER, ROLE.VILLAGER],
  10: [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.CUPID, ROLE.THIEF, ROLE.VILLAGER, ROLE.VILLAGER],
  11: [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.CUPID, ROLE.THIEF, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
  12: [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.CUPID, ROLE.THIEF, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
};

export function getCompositionForCount(count) {
  if (count < 2) return [];
  const capped = Math.min(count, 12);
  const base = ROLE_COMPOSITIONS[capped] || ROLE_COMPOSITIONS[12];
  // If more than 12, fill remaining with villagers
  const extra = count > 12 ? Array(count - 12).fill(ROLE.VILLAGER) : [];
  return [...base, ...extra];
}
