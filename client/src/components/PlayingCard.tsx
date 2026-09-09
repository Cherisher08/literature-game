/**
 * The dimensional card. Spec §67.3, §64.3.
 *
 * Depth is a translateZ edge slab; the flip is rotateY on the inner element.
 * Only transform and opacity animate (§68.2).
 */

import { cardAccessibleName, type Card } from "@memory-game/shared";
import { CardBack, CardFace } from "./CardFace.js";

export type CardSize = "sm" | "md" | "lg";

/** Real playing-card proportions, 2.5 : 3.5. */
const SIZES: Record<CardSize, { w: number; h: number }> = {
  sm: { w: 46, h: 64 },
  md: { w: 62, h: 87 },
  lg: { w: 80, h: 112 },
};

export interface PlayingCardProps {
  card: Card;
  size?: CardSize;
  /** Shows the back until flipped — the §65.4 reveal beat. */
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  /** Rest tilt so cards never look like stickers (§67.3). */
  tilt?: number;
  className?: string;
}

export function PlayingCard({
  card,
  size = "sm",
  faceDown = false,
  selected = false,
  disabled = false,
  highlighted = false,
  onClick,
  tilt = 0,
  className = "",
}: PlayingCardProps) {
  const { w, h } = SIZES[size];
  const interactive = Boolean(onClick) && !disabled;

  return (
    <div
      className={`card-scene relative ${className}`}
      style={{ width: w, height: h }}
    >
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={cardAccessibleName(card)}
        aria-pressed={interactive ? selected : undefined}
        aria-disabled={disabled || undefined}
        onClick={interactive ? onClick : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
        className={[
          "card-inner rounded-[8px]",
          interactive ? "cursor-pointer" : "",
          disabled ? "opacity-55" : "",
          selected ? "-translate-y-1" : "",
        ].join(" ")}
        style={{
          // Custom properties drive both the transform and the sheen angle.
          ["--rot" as string]: faceDown ? "180deg" : "0deg",
          ["--tilt" as string]: `${tilt}deg`,
          boxShadow: selected
            ? "0 0 0 2px var(--accent)"
            : highlighted
              ? "0 0 0 2px var(--accent), 0 0 16px rgba(251,191,36,.45)"
              : "none",
          borderRadius: 8,
        }}
      >
        <div className="card-edge" />
        <div className="card-face">
          <CardFace card={card} />
          <div className="card-sheen" />
        </div>
        <div className="card-back">
          <CardBack />
        </div>
      </div>
    </div>
  );
}

/** A stack of backs, sized to a real count (§64.3: never a stand-in for unknown). */
export function CardCountStack({ count }: { count: number }) {
  const shown = Math.min(count, 5);
  return (
    <div className="relative h-[34px] w-[26px]">
      {Array.from({ length: shown }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-[4px] border border-white/20"
          style={{
            transform: `translate(${i * 2}px, ${-i * 2}px)`,
            background: "repeating-linear-gradient(45deg,#1e3a5f 0 4px,#16304f 4px 8px)",
          }}
        />
      ))}
    </div>
  );
}
