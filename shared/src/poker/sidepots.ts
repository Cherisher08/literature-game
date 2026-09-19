import type { PotInfo } from "../types/poker.js";

export interface PlayerBetContribution {
  playerId: string;
  totalBet: number;
  folded: boolean;
}

/**
 * Calculates the main pot and any side pots based on each player's total bet in the hand.
 */
export function calculateSidePots(players: PlayerBetContribution[]): PotInfo[] {
  // Only consider players who contributed chips
  const contributors = players.filter((p) => p.totalBet > 0);
  if (contributors.length === 0) return [];

  // Get all unique positive bet levels from players who haven't folded, plus all-in levels
  const allLevels = Array.from(new Set(contributors.map((p) => p.totalBet))).sort(
    (a, b) => a - b,
  );

  const rawPots: { amount: number; eligible: string[] }[] = [];
  let prevLevel = 0;

  for (const level of allLevels) {
    const delta = level - prevLevel;
    if (delta <= 0) continue;

    let potAmount = 0;
    const eligible: string[] = [];

    for (const p of contributors) {
      if (p.totalBet > prevLevel) {
        const contributedToLayer = Math.min(p.totalBet - prevLevel, delta);
        potAmount += contributedToLayer;
      }
      if (!p.folded && p.totalBet >= level) {
        eligible.push(p.playerId);
      }
    }

    if (potAmount > 0 && eligible.length > 0) {
      rawPots.push({ amount: potAmount, eligible: eligible.sort() });
    } else if (potAmount > 0 && rawPots.length > 0) {
      // If no one is eligible (e.g. everyone at this level folded), merge into the last pot
      rawPots[rawPots.length - 1]!.amount += potAmount;
    }

    prevLevel = level;
  }

  // Merge consecutive pots that have the exact same eligible players
  const mergedPots: PotInfo[] = [];
  let potIdCounter = 1;

  for (const raw of rawPots) {
    const last = mergedPots[mergedPots.length - 1];
    if (
      last &&
      last.eligiblePlayerIds.length === raw.eligible.length &&
      last.eligiblePlayerIds.every((id, idx) => id === raw.eligible[idx])
    ) {
      last.amount += raw.amount;
    } else {
      mergedPots.push({
        id: potIdCounter++,
        amount: raw.amount,
        eligiblePlayerIds: raw.eligible,
      });
    }
  }

  return mergedPots;
}
