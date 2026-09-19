/**
 * The main poker table — an oval SVG with seats arranged radially.
 * Community cards sit in the centre alongside the pot display.
 */

import type { ClientPokerState } from "@memory-game/shared";
import { PokerSeat } from "./PokerSeat.js";

const SUIT_SYMBOLS: Record<string, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};
const SUIT_COLORS: Record<string, string> = {
  S: "#e2e8f0",
  H: "#f87171",
  D: "#f87171",
  C: "#e2e8f0",
};

/** Rank display: 10 is rendered as "10", others as single char */
function rankLabel(rank: string) {
  return rank;
}

interface PokerTableProps {
  state: ClientPokerState;
  myPlayerId: string;
  // Outer dimensions of the SVG canvas
  width?: number;
  height?: number;
}

export function PokerTable({ state, myPlayerId, width = 700, height = 480 }: PokerTableProps) {
  const cx = width / 2;
  const cy = height / 2;

  // Table oval dimensions
  const tableRx = width * 0.38;
  const tableRy = height * 0.32;

  // Seat orbit — slightly outside the table
  const seatRx = tableRx + 62;
  const seatRy = tableRy + 62;

  const n = state.players.length;

  // Find the index of "me" so I'm always at the bottom
  const myIndex = state.players.findIndex((p) => p.id === myPlayerId);

  /**
   * Distribute seats around the oval.
   * My seat is placed at angle = 0 (bottom). Others fan out clockwise.
   */
  function seatAngle(playerIndex: number): number {
    // Delta from my index
    const delta = ((playerIndex - myIndex) + n) % n;
    return (delta / n) * 360;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: width, display: "block", margin: "0 auto" }}
    >
      <defs>
        <radialGradient id="tableGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#064e3b" />
          <stop offset="100%" stopColor="#022c22" />
        </radialGradient>
        <radialGradient id="feltGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background */}
      <rect width={width} height={height} fill="transparent" />

      {/* Table rim shadow */}
      <ellipse
        cx={cx}
        cy={cy + 8}
        rx={tableRx + 12}
        ry={tableRy + 12}
        fill="rgba(0,0,0,0.45)"
      />

      {/* Table rim */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={tableRx + 8}
        ry={tableRy + 8}
        fill="#7c2d12"
        stroke="#92400e"
        strokeWidth={2}
      />

      {/* Felt surface */}
      <ellipse cx={cx} cy={cy} rx={tableRx} ry={tableRy} fill="url(#tableGrad)" />
      <ellipse cx={cx} cy={cy} rx={tableRx} ry={tableRy} fill="url(#feltGlow)" />

      {/* Felt border detail */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={tableRx - 6}
        ry={tableRy - 6}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={1.5}
      />

      {/* Round label */}
      <text
        x={cx}
        y={cy - tableRy + 28}
        textAnchor="middle"
        fontSize="9"
        fill="rgba(255,255,255,0.3)"
        fontWeight="600"
        letterSpacing="2"
      >
        {state.round === "WAITING"
          ? "WAITING"
          : state.round === "PRE_FLOP"
            ? "PRE-FLOP"
            : state.round}
      </text>

      {/* Community cards */}
      <CommunityCards
        cards={state.communityCards}
        cx={cx}
        cy={cy}
        round={state.round}
      />

      {/* Pot display */}
      <PotChip
        mainPot={state.mainPot}
        sidePots={state.sidePots}
        cx={cx}
        cy={cy - 42}
      />

      {/* Winner announcement */}
      {state.winners && state.winners.length > 0 && (
        <WinnerBanner winners={state.winners} cx={cx} cy={cy + tableRy - 28} />
      )}

      {/* Player seats */}
      {state.players.map((player, idx) => (
        <PokerSeat
          key={player.id}
          player={player}
          isMe={player.id === myPlayerId}
          isActive={state.activeSeat === player.seatPosition}
          isDealer={state.dealerSeat === player.seatPosition}
          isSB={state.sbSeat === player.seatPosition}
          isBB={state.bbSeat === player.seatPosition}
          angle={seatAngle(idx)}
          rx={seatRx}
          ry={seatRy}
          tableCx={cx}
          tableCy={cy}
        />
      ))}
    </svg>
  );
}

/** Community card area in the centre of the table */
function CommunityCards({
  cards,
  cx,
  cy,
  round,
}: {
  cards: ClientPokerState["communityCards"];
  cx: number;
  cy: number;
  round: string;
}) {
  if (cards.length === 0 && round !== "WAITING") return null;

  const cardW = 38;
  const cardH = 54;
  const gap = 6;
  const totalW = 5 * cardW + 4 * gap;
  const startX = cx - totalW / 2;
  const startY = cy - cardH / 2 + 10;

  return (
    <g>
      {Array.from({ length: 5 }).map((_, i) => {
        const card = cards[i];
        const x = startX + i * (cardW + gap);
        return (
          <g key={i} transform={`translate(${x}, ${startY})`}>
            {card ? (
              <>
                {/* Card face */}
                <rect
                  width={cardW}
                  height={cardH}
                  rx={4}
                  fill="white"
                  stroke="rgba(0,0,0,0.2)"
                  strokeWidth={0.5}
                  style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}
                />
                {/* Top-left rank + suit */}
                <text
                  x={3}
                  y={12}
                  fontSize="10"
                  fontWeight="800"
                  fill={SUIT_COLORS[card.suit] === "#e2e8f0" ? "#1e293b" : "#dc2626"}
                >
                  {rankLabel(card.rank)}
                </text>
                <text
                  x={3}
                  y={22}
                  fontSize="9"
                  fill={card.suit === "H" || card.suit === "D" ? "#dc2626" : "#1e293b"}
                >
                  {SUIT_SYMBOLS[card.suit]}
                </text>
                {/* Centre pip */}
                <text
                  x={cardW / 2}
                  y={cardH / 2 + 8}
                  textAnchor="middle"
                  fontSize="18"
                  fill={card.suit === "H" || card.suit === "D" ? "#dc2626" : "#1e293b"}
                >
                  {SUIT_SYMBOLS[card.suit]}
                </text>
              </>
            ) : (
              // Placeholder slot
              <rect
                width={cardW}
                height={cardH}
                rx={4}
                fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Pot chip displayed above community cards */
function PotChip({
  mainPot,
  sidePots,
  cx,
  cy,
}: {
  mainPot: number;
  sidePots: ClientPokerState["sidePots"];
  cx: number;
  cy: number;
}) {
  if (mainPot === 0) return null;
  const extra = sidePots.length > 1 ? ` (+${sidePots.length - 1} side)` : "";
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <rect
        x={-52}
        y={-14}
        width={104}
        height={26}
        rx={13}
        fill="rgba(251,191,36,0.15)"
        stroke="rgba(251,191,36,0.4)"
        strokeWidth={1}
      />
      <text y={4} textAnchor="middle" fontSize="11" fill="var(--accent)" fontWeight="700">
        POT: ${mainPot.toLocaleString()}{extra}
      </text>
    </g>
  );
}

/** Winner banner shown at showdown */
function WinnerBanner({
  winners,
  cx,
  cy,
}: {
  winners: ClientPokerState["winners"];
  cx: number;
  cy: number;
}) {
  if (!winners || winners.length === 0) return null;
  const w = winners[0]!;
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <rect
        x={-90}
        y={-14}
        width={180}
        height={26}
        rx={13}
        fill="rgba(251,191,36,0.25)"
        stroke="rgba(251,191,36,0.7)"
        strokeWidth={1.5}
      />
      <text y={4} textAnchor="middle" fontSize="10" fill="var(--accent)" fontWeight="800">
        🏆 {w.playerName} — {w.handName}
      </text>
    </g>
  );
}
