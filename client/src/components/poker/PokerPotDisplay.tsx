/**
 * Pot and side-pot display for the poker game.
 */

import type { PotInfo } from "@memory-game/shared";

interface PokerPotDisplayProps {
  mainPot: number;
  sidePots: PotInfo[];
  className?: string;
}

export function PokerPotDisplay({ mainPot, sidePots, className = "" }: PokerPotDisplayProps) {
  if (mainPot === 0) return null;

  const hasSidePots = sidePots.length > 1;

  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      {/* Main pot */}
      <div className="flex items-center gap-1.5 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-1.5">
        <ChipIcon className="text-[var(--accent)]" />
        <span className="text-sm font-black text-[var(--accent)]">
          ${mainPot.toLocaleString()}
        </span>
        <span className="text-xs font-semibold text-[var(--accent)]/60">Pot</span>
      </div>

      {/* Side pots (when players are all-in) */}
      {hasSidePots &&
        sidePots.slice(1).map((sp) => (
          <div
            key={sp.id}
            className="flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1"
          >
            <ChipIcon className="text-orange-400" />
            <span className="text-xs font-bold text-orange-400">
              ${sp.amount.toLocaleString()}
            </span>
            <span className="text-[10px] text-orange-400/60">Side {sp.id}</span>
          </div>
        ))}
    </div>
  );
}

function ChipIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      stroke="currentColor"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  );
}
