import { ROLE } from '../constants/roles';

function namesOf(ids, players) {
  return ids
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => (p.isAlive ? p.nickname : `${p.nickname} (dead)`));
}

export function relatedGroups(gs, room) {
  const players = room?.players || [];
  const groups = [
    { label: 'Your pack', names: namesOf(gs.fellowWolves || [], players) },
    { label: 'Your sister', names: namesOf(gs.fellowSisters || [], players) },
    { label: 'Your lover', names: gs.myLover ? namesOf([gs.myLover.id], players) : [] },
  ];
  if (gs.myRole === ROLE.CUPID && room?.lovers) {
    groups.push({ label: 'The lovers you bound', names: namesOf(room.lovers, players) });
  }
  const roleModel = room?.wildChildModel || room?.nightActions?.wildChild;
  if (gs.myRole === ROLE.WILD_CHILD && roleModel) {
    groups.push({ label: 'Your role model', names: namesOf([roleModel], players) });
  }
  return groups;
}
