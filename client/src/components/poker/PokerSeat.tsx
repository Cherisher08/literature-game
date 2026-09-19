/**
 * Individual poker seat — renders a player's position around the oval table.
 * Shows avatar, name, chip count, hole cards (face-down for opponents),
 * current bet, turn indicator, and last action badge.
 */

import type { PublicPokerPlayer } from "@memory-game/shared";
import { PlayingCard } from "../PlayingCard.js";

const ACTION_COLORS: Record<string, string> = {
  FOLD: "var(--team-them)",
  CHECK: "var(--text-muted)",
  CALL: "var(--team-us)",
  BET: "var(--accent)",
  RAISE: "var(--accent)",
  ALL_IN: "#f97316",
};

const SEAT_MARKS = [
  "M50 16 L84 78 H16 Z",
  "M22 22 H78 V78 H22 Z",
  "M50 14 L82 32 V68 L50 86 L18 68 V32 Z",
  "M50 12 L78 50 L50 88 L22 50 Z",
  "M20 30 L50 58 L80 30 L80 52 L50 80 L20 52 Z",
  "M50 10 A40 40 0 0 1 90 50 H68 A18 18 0 0 0 50 32 Z M50 90 A40 40 0 0 1 10 50 H32 A18 18 0 0 0 50 68 Z",
];

interface PokerSeatProps {
  player: PublicPokerPlayer;
  isMe: boolean;
  isActive: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  /** Rotation angle in degrees — drives the CSS transform so seats fan around the oval */
  angle: number;
  /** Radius from table centre, separate values for x and y since the table is oval */
  rx: number;
  ry: number;
  tableCx: number;
  tableCy: number;
}

export function PokerSeat({
  player,
  isMe,
  isActive,
  isDealer,
  isSB,
  isBB,
  angle,
  rx,
  ry,
  tableCx,
  tableCy,
}: PokerSeatProps) {
  const rad = (angle * Math.PI) / 180;
  const cx = tableCx + rx * Math.sin(rad);
  const cy = tableCy - ry * Math.cos(rad);

  const mark = SEAT_MARKS[player.seatPosition % SEAT_MARKS.length]!;
  const isFolded = player.folded;
  const isAllIn = player.isAllIn;

  const diskBg = isMe
    ? "rgba(251,191,36,0.2)"
    : isFolded
      ? "rgba(100,100,100,0.15)"
      : "rgba(30,58,95,0.8)";
  const markFill = isMe ? "var(--accent)" : isFolded ? "#555" : "#93c5fd";

  // Cards rendered beside or above the seat avatar
  const hasRevealedCards = player.holeCards && player.holeCards.length === 2;

  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      style={{ transition: "all 0.4s ease" }}
    >
      {/* Turn glow ring */}
      {isActive && (
        <circle
          r={32}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={3}
          opacity={0.9}
          style={{
            filter: "drop-shadow(0 0 8px rgba(251,191,36,0.7))",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      )}

      {/* Avatar disk */}
      <circle
        r={26}
        fill={diskBg}
        stroke={isMe ? "var(--accent)" : isActive ? "rgba(251,191,36,0.5)" : "rgba(255,255,255,0.1)"}
        strokeWidth={isMe ? 2 : 1}
        style={{ opacity: isFolded ? 0.45 : 1 }}
      />
      <svg
        viewBox="0 0 100 100"
        width={26}
        height={26}
        x={-13}
        y={-13}
        style={{ opacity: isFolded ? 0.45 : 1 }}
      >
        <path d={mark} fill={markFill} />
      </svg>

      {/* Dealer button */}
      {isDealer && (
        <circle cx={20} cy={-20} r={8} fill="#e2e8f0" stroke="#1e293b" strokeWidth={1} />
      )}
      {isDealer && (
        <text x={20} y={-17} textAnchor="middle" fontSize="6" fill="#1e293b" fontWeight="bold">
          D
        </text>
      )}

      {/* SB / BB badges */}
      {(isSB || isBB) && !isDealer && (
        <circle cx={20} cy={-20} r={8} fill={isBB ? "var(--accent)" : "rgba(251,191,36,0.5)"} stroke="#1e293b" strokeWidth={1} />
      )}
      {(isSB || isBB) && !isDealer && (
        <text x={20} y={-17} textAnchor="middle" fontSize="6" fill="#1e293b" fontWeight="bold">
          {isBB ? "BB" : "SB"}
        </text>
      )}

      {/* Player name */}
      <text
        y={38}
        textAnchor="middle"
        fontSize="9"
        fill={isMe ? "var(--accent)" : "var(--text)"}
        fontWeight={isMe ? "800" : "600"}
      >
        {player.name.length > 10 ? player.name.slice(0, 9) + "…" : player.name}
      </text>

      {/* Chips */}
      <text y={50} textAnchor="middle" fontSize="8" fill="var(--text-muted)">
        {isAllIn ? "ALL IN" : `$${player.chips.toLocaleString()}`}
      </text>

      {/* Current bet chip */}
      {player.currentBet > 0 && (
        <g transform={`translate(0, -50)`}>
          <circle r={12} fill="rgba(251,191,36,0.2)" stroke="var(--accent)" strokeWidth={1.5} />
          <text y={4} textAnchor="middle" fontSize="7" fill="var(--accent)" fontWeight="700">
            ${player.currentBet}
          </text>
        </g>
      )}

      {/* Last action badge */}
      {player.lastAction && (
        <g transform={`translate(0, 60)`}>
          <rect
            x={-22}
            y={-8}
            width={44}
            height={14}
            rx={7}
            fill={ACTION_COLORS[player.lastAction.type] ?? "var(--text-muted)"}
            opacity={0.2}
          />
          <text
            y={4}
            textAnchor="middle"
            fontSize="7"
            fill={ACTION_COLORS[player.lastAction.type] ?? "var(--text-muted)"}
            fontWeight="700"
          >
            {player.lastAction.type}
          </text>
        </g>
      )}

      {/* Bot indicator */}
      {player.isBot && (
        <circle cx={-22} cy={-22} r={5} fill="rgba(100,100,200,0.4)" stroke="rgba(100,100,200,0.8)" strokeWidth={1} />
      )}

      {/* Hole cards (face-down squares for opponents, face-up for me/showdown) */}
      {player.hasCards && (
        <g transform={`translate(-16, -54)`}>
          {hasRevealedCards ? (
            // Revealed — render two small face-up card icons
            <>
              <rect width={14} height={20} rx={2} fill="white" stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
              <text x={7} y={14} textAnchor="middle" fontSize="8" fill={
                player.holeCards![0]!.suit === "H" || player.holeCards![0]!.suit === "D"
                  ? "#dc2626" : "#1e293b"
              }>
                {player.holeCards![0]!.rank === "10" ? "T" : player.holeCards![0]!.rank[0]}
              </text>
              <rect x={18} width={14} height={20} rx={2} fill="white" stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
              <text x={25} y={14} textAnchor="middle" fontSize="8" fill={
                player.holeCards![1]!.suit === "H" || player.holeCards![1]!.suit === "D"
                  ? "#dc2626" : "#1e293b"
              }>
                {player.holeCards![1]!.rank === "10" ? "T" : player.holeCards![1]!.rank[0]}
              </text>
            </>
          ) : (
            // Face-down backs
            <>
              <rect
                width={14}
                height={20}
                rx={2}
                fill="repeating-linear-gradient(45deg,#1e3a5f 0 3px,#16304f 3px 6px)"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={0.5}
              />
              <rect
                x={10}
                y={-2}
                width={14}
                height={20}
                rx={2}
                fill="repeating-linear-gradient(45deg,#1e3a5f 0 3px,#16304f 3px 6px)"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={0.5}
              />
            </>
          )}
        </g>
      )}

      {/* Folded overlay */}
      {isFolded && (
        <text
          y={-2}
          textAnchor="middle"
          fontSize="7"
          fill="var(--team-them)"
          fontWeight="700"
        >
          FOLD
        </text>
      )}

      {/* Disconnected */}
      {!player.connected && (
        <text y={-2} textAnchor="middle" fontSize="7" fill="var(--text-muted)">
          ···
        </text>
      )}
    </g>
  );
}
