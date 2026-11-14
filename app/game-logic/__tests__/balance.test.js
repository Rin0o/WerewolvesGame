import { estimateVillageWin, balanceVerdict } from '../balance';
import { getCompositionForCount } from '../../constants/roles';

const withRole = (composition, role) => {
  const i = composition.indexOf('villager');
  return [...composition.slice(0, i), role, ...composition.slice(i + 1)];
};

describe('estimateVillageWin', () => {
  it('rates every Normal preset as balanced or close to it', () => {
    for (let n = 5; n <= 20; n++) {
      const estimate = estimateVillageWin(getCompositionForCount(n));
      expect(estimate).toBeGreaterThan(0.4);
      expect(estimate).toBeLessThan(0.6);
    }
  });

  it('moves the right way for each change', () => {
    const base = getCompositionForCount(11);
    const p = estimateVillageWin(base);
    expect(estimateVillageWin(withRole(base, 'werewolf'))).toBeLessThan(p);
    expect(estimateVillageWin(withRole(base, 'wolf_father'))).toBeLessThan(estimateVillageWin(withRole(base, 'werewolf')));
    expect(estimateVillageWin(withRole(base, 'seer'))).toBeGreaterThan(p);
    expect(estimateVillageWin(withRole(base, 'wild_child'))).toBeLessThan(p);
    expect(estimateVillageWin(base, { classicFirstNight: true })).toBeLessThan(p);
    expect(estimateVillageWin(base, { revote: true })).toBeGreaterThan(p);
    expect(estimateVillageWin(base, { bots: 6 })).toBeLessThan(p);
  });

  it('has nothing to say about an empty table', () => {
    expect(estimateVillageWin([])).toBeNull();
    expect(balanceVerdict(null)).toBeNull();
  });
});

describe('balanceVerdict', () => {
  it('calls 40-60% balanced and names the favoured side beyond it', () => {
    expect(balanceVerdict(0.5).side).toBe('balanced');
    expect(balanceVerdict(0.4).side).toBe('balanced');
    expect(balanceVerdict(0.6).side).toBe('balanced');
    expect(balanceVerdict(0.65).label).toBe('Favours the village');
    expect(balanceVerdict(0.8).label).toBe('Strongly favours the village');
    expect(balanceVerdict(0.3).label).toBe('Favours the wolves');
    expect(balanceVerdict(0.1).label).toBe('Strongly favours the wolves');
  });
});
