export const ROLE = {
  VILLAGER: 'villager',
  WEREWOLF: 'werewolf',
  SEER: 'seer',
  WITCH: 'witch',
  HUNTER: 'hunter',
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
};

// Suggested role compositions per player count
export const ROLE_COMPOSITIONS = {
  2:  [ROLE.WEREWOLF, ROLE.VILLAGER],
  3:  [ROLE.WEREWOLF, ROLE.VILLAGER, ROLE.VILLAGER],
  4:  [ROLE.WEREWOLF, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.WITCH],
  5:  [ROLE.WEREWOLF, ROLE.SEER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
  6:  [ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
  7:  [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
  8:  [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
  9:  [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
  10: [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
  11: [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
  12: [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
};

export function getCompositionForCount(count) {
  if (count < 2) return [];
  const capped = Math.min(count, 12);
  const base = ROLE_COMPOSITIONS[capped] || ROLE_COMPOSITIONS[12];
  // If more than 12, fill remaining with villagers
  const extra = count > 12 ? Array(count - 12).fill(ROLE.VILLAGER) : [];
  return [...base, ...extra];
}
