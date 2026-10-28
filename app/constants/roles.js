export const ROLE = {
  VILLAGER: 'villager',
  WEREWOLF: 'werewolf',
  SEER: 'seer',
  WITCH: 'witch',
  HUNTER: 'hunter',
  CUPID: 'cupid',
  THIEF: 'thief',
  SAVIOUR: 'saviour',
  BEAR_TAMER: 'bear_tamer',
  SISTER: 'sister',
  WHITE_WOLF: 'white_wolf',
  WOLF_HOUND: 'wolf_hound',
  FOX: 'fox',
};

export const WOLF_ROLES = [ROLE.WEREWOLF, ROLE.WHITE_WOLF];

export function isWolfRole(role) {
  return WOLF_ROLES.includes(role);
}

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
    ability: 'Each night, secretly choose a villager to eliminate together with other werewolves. With a Quiet first night, night 1 is only for meeting the pack.',
  },
  [ROLE.SEER]: {
    name: 'Seer',
    emoji: '🔮',
    team: 'villagers',
    description: 'A gifted mystic who can sense the true nature of others.',
    goal: 'Help the village find and eliminate all Werewolves.',
    ability: 'Each night, choose one player to learn whether they are a Werewolf or not. With a Quiet first night, you start on night 2.',
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
  [ROLE.SAVIOUR]: {
    name: 'Saviour',
    emoji: '🛡️',
    team: 'villagers',
    description: 'A brave guardian who watches over the village through the night.',
    goal: 'Protect villagers from the werewolves. Help eliminate all wolves.',
    ability: 'Each night, choose one player to protect from the werewolves. You cannot protect the same player two nights in a row.',
  },
  [ROLE.BEAR_TAMER]: {
    name: 'Bear Tamer',
    emoji: '🐻',
    team: 'villagers',
    description: 'A mysterious villager whose trained bears sense the presence of evil nearby.',
    goal: 'Help the village find and eliminate all Werewolves.',
    ability: 'Each dawn, if either of your immediate neighbors (by join order) is a Werewolf, your bears growl — warning you that danger is close.',
  },
  [ROLE.SISTER]: {
    name: 'Sister',
    emoji: '👧',
    team: 'villagers',
    description: 'One of two sisters who share a secret bond from the very first night.',
    goal: 'Help the village find and eliminate all Werewolves.',
    ability: 'At the start of the game you and your sister know each other\'s identities. Use your bond to collaborate discreetly during the day.',
  },
  [ROLE.WHITE_WOLF]: {
    name: 'White Wolf',
    emoji: '🐺',
    team: 'werewolves',
    description: 'A werewolf who hunts with the pack but secretly wants to be the last one standing.',
    goal: 'Be the last player alive.',
    ability: 'Each night you hunt with the werewolves, who see you as one of them. Every second night (nights 2, 4, 6…) you also wake alone and may devour one other werewolf.',
  },
  [ROLE.WOLF_HOUND]: {
    name: 'Wolf Hound',
    emoji: '🐕',
    team: 'villagers',
    description: 'A creature torn between the village and the pack.',
    goal: 'Win with the side you choose.',
    ability: 'On the first night, secretly choose to be a Villager or a Werewolf. If you choose the wolves, you join the pack that same night.',
  },
  [ROLE.FOX]: {
    name: 'Fox',
    emoji: '🦊',
    team: 'villagers',
    description: 'A cunning creature who can sniff out the pack among a group of neighbours.',
    goal: 'Help the village find and eliminate all Werewolves.',
    ability: 'Each night you may point at a player. You learn whether that player or either of their living neighbours is a Werewolf. If none of the three is, you lose your power for the rest of the game. With a Quiet first night, you start on night 2.',
  },
};

// Suggested role compositions per player count
export const ROLE_COMPOSITIONS = {
  2:  [ROLE.WEREWOLF, ROLE.VILLAGER],
  3:  [ROLE.WEREWOLF, ROLE.VILLAGER, ROLE.VILLAGER],
  4:  [ROLE.WEREWOLF, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.WITCH],
  5:  [ROLE.WEREWOLF, ROLE.HUNTER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
  6:  [ROLE.WEREWOLF, ROLE.SEER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
  7:  [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.VILLAGER, ROLE.VILLAGER],
  8:  [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
  9:  [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.CUPID, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
  10: [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.CUPID, ROLE.BEAR_TAMER, ROLE.VILLAGER, ROLE.VILLAGER],
  11: [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.CUPID, ROLE.BEAR_TAMER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER],
  12: [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.SAVIOUR, ROLE.CUPID, ROLE.SISTER, ROLE.SISTER, ROLE.VILLAGER, ROLE.VILLAGER],
  13: [ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.WEREWOLF, ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.SAVIOUR, ROLE.CUPID, ROLE.BEAR_TAMER, ROLE.SISTER, ROLE.SISTER, ROLE.VILLAGER],
};

const LARGEST_COMPOSITION = 13;
const FIFTH_WOLF_AT = 18;

export function getCompositionForCount(count) {
  if (count < 2) return [];
  if (count <= LARGEST_COMPOSITION) return [...ROLE_COMPOSITIONS[count]];
  const extraVillagers = count - LARGEST_COMPOSITION - (count >= FIFTH_WOLF_AT ? 1 : 0);
  return [
    ...ROLE_COMPOSITIONS[LARGEST_COMPOSITION],
    ...(count >= FIFTH_WOLF_AT ? [ROLE.WEREWOLF] : []),
    ...Array(extraVillagers).fill(ROLE.VILLAGER),
  ];
}

export function buildCustomComposition({ playerCount, werewolf, seer, witch, hunter, cupid, thief, saviour, bear_tamer, sister, white_wolf, wolf_hound, fox }) {
  const comp = [];
  for (let i = 0; i < werewolf; i++) comp.push(ROLE.WEREWOLF);
  if (white_wolf) comp.push(ROLE.WHITE_WOLF);
  if (wolf_hound) comp.push(ROLE.WOLF_HOUND);
  if (seer) comp.push(ROLE.SEER);
  if (witch) comp.push(ROLE.WITCH);
  if (hunter) comp.push(ROLE.HUNTER);
  if (cupid) comp.push(ROLE.CUPID);
  if (thief) comp.push(ROLE.THIEF);
  if (saviour) comp.push(ROLE.SAVIOUR);
  if (bear_tamer) comp.push(ROLE.BEAR_TAMER);
  if (fox) comp.push(ROLE.FOX);
  if (sister) { comp.push(ROLE.SISTER); comp.push(ROLE.SISTER); }
  const villagers = playerCount - comp.length;
  for (let i = 0; i < Math.max(0, villagers); i++) comp.push(ROLE.VILLAGER);
  return comp;
}
