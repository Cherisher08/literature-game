/**
 * Procedurally generated card faces. Spec §67.1, §70.
 *
 * The whole face is ONE SVG on a 100x140 viewBox (the real 2.5:3.5 card ratio),
 * so corner indices, pips and courts all scale together. An earlier version
 * mixed `em` type with `%` positioning, which drifted apart at small sizes and
 * left the pips scattered.
 *
 * Suits are SVG paths, never Unicode characters — `♥` can take emoji
 * presentation and varies by font, which would make identical cards look
 * different on every device.
 */

import type { Card, Suit } from "@memory-game/shared";
import { SUIT_COLOR } from "@memory-game/shared";

const W = 100;
const H = 140;

// Pips drawn on a 100x100 box centred at (50,50), scaled into place.
const SUIT_PATH: Record<Exclude<Suit, "NONE">, string> = {
  S: "M50 8 C36 30 14 44 14 62 a17 17 0 0 0 29 12 c-1 10 -6 17 -13 22 h40 c-7 -5 -12 -12 -13 -22 a17 17 0 0 0 29 -12 C86 44 64 30 50 8 Z",
  H: "M50 92 C20 68 12 53 12 39 A21 21 0 0 1 50 26 A21 21 0 0 1 88 39 C88 53 80 68 50 92 Z",
  D: "M50 6 L84 50 L50 94 L16 50 Z",
  C: "M50 8 a18 18 0 0 1 13 30 a18 18 0 1 1 -11 22 c1 10 6 18 14 24 H34 c8 -6 13 -14 14 -24 a18 18 0 1 1 -11 -22 A18 18 0 0 1 50 8 Z",
};

/** A pip centred at (cx, cy) with the given width, optionally inverted. */
function Pip({
  suit,
  cx,
  cy,
  size,
  flipped = false,
}: {
  suit: Suit;
  cx: number;
  cy: number;
  size: number;
  flipped?: boolean;
}) {
  if (suit === "NONE") return null;
  const s = size / 100;
  return (
    <g
      transform={`translate(${cx} ${cy}) scale(${s}) rotate(${flipped ? 180 : 0}) translate(-50 -50)`}
    >
      <path d={SUIT_PATH[suit]} fill="currentColor" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Pip layout — the traditional grid, in viewBox units
// ---------------------------------------------------------------------------

const L = 34;
const C = 50;
const R = 66;

/** [x, y, flipped] */
type Spot = [number, number, boolean?];

const LAYOUTS: Partial<Record<string, Spot[]>> = {
  "2": [[C, 36], [C, 104, true]],
  "3": [[C, 36], [C, 70], [C, 104, true]],
  "4": [[L, 36], [R, 36], [L, 104, true], [R, 104, true]],
  "5": [[L, 36], [R, 36], [C, 70], [L, 104, true], [R, 104, true]],
  "6": [[L, 36], [R, 36], [L, 70], [R, 70], [L, 104, true], [R, 104, true]],
  "7": [[L, 36], [R, 36], [C, 53], [L, 70], [R, 70], [L, 104, true], [R, 104, true]],
  "8": [
    [L, 36], [R, 36], [C, 53], [L, 70], [R, 70],
    [C, 87, true], [L, 104, true], [R, 104, true],
  ],
  // 9 and 10 use tighter rows and smaller pips so they clear the corner indices.
  "9": [
    [L, 38], [R, 38], [L, 59], [R, 59], [C, 70],
    [L, 81, true], [R, 81, true], [L, 102, true], [R, 102, true],
  ],
  "10": [
    [L, 38], [R, 38], [C, 49], [L, 59], [R, 59],
    [L, 81, true], [R, 81, true], [C, 91, true], [L, 102, true], [R, 102, true],
  ],
};

const PIP_SIZE = 17;
const DENSE_PIP_SIZE = 14;
const DENSE = new Set(["9", "10"]);

// ---------------------------------------------------------------------------
// Corner index — rank stacked above a small pip, mirrored bottom-right
// ---------------------------------------------------------------------------

function Corner({ rank, suit, flipped }: { rank: string; suit: Suit; flipped?: boolean }) {
  const x = flipped ? W - 13 : 13;
  const y = flipped ? H - 13 : 13;
  // "10" needs to be narrower so it fits the corner.
  const wide = rank === "10";

  return (
    <g transform={flipped ? `rotate(180 ${x} ${y})` : undefined}>
      <text
        x={x}
        y={y + 5}
        textAnchor="middle"
        fontSize={wide ? 17 : 20}
        fontWeight={700}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="currentColor"
        letterSpacing={wide ? -1.5 : 0}
      >
        {rank}
      </text>
      <Pip suit={suit} cx={x} cy={y + 15} size={11} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Pluggable court and joker slots (§70.2)
// ---------------------------------------------------------------------------

function ProceduralCourt({ card }: { card: Card }) {
  return (
    <g>
      <rect
        x={28}
        y={34}
        width={44}
        height={72}
        rx={4}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <rect
        x={33}
        y={39}
        width={34}
        height={62}
        rx={3}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.8}
        opacity={0.4}
      />
      <text
        x={50}
        y={72}
        textAnchor="middle"
        fontSize={30}
        fontWeight={700}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="currentColor"
      >
        {card.rank}
      </text>
      <Pip suit={card.suit} cx={50} cy={92} size={18} />
    </g>
  );
}

function ProceduralJoker({ card }: { card: Card }) {
  const black = card.id === "JOKER-BLACK";
  return (
    <g>
      {black ? (
        <path
          d="M50 34 L58 56 L81 56 L62 70 L69 92 L50 78 L31 92 L38 70 L19 56 L42 56 Z"
          fill="currentColor"
        />
      ) : (
        <g>
          <circle cx={50} cy={63} r={24} fill="none" stroke="currentColor" strokeWidth={6} />
          <circle cx={50} cy={63} r={9} fill="currentColor" />
        </g>
      )}
      <text
        x={50}
        y={110}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        letterSpacing={2}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="currentColor"
      >
        JOKER
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------

export function CardFace({ card }: { card: Card }) {
  const isJoker = card.rank === "JOKER";
  const isCourt = card.rank === "J" || card.rank === "Q" || card.rank === "K";
  const isAce = card.rank === "A";
  const layout = LAYOUTS[card.rank];

  const color = isJoker
    ? card.id === "JOKER-BLACK"
      ? "var(--card-black)"
      : "var(--card-red)"
    : SUIT_COLOR[card.suit] === "red"
      ? "var(--card-red)"
      : "var(--card-black)";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full select-none"
      style={{ color, background: "var(--card-face)", display: "block" }}
      aria-hidden="true"
      focusable="false"
    >
      {!isJoker && (
        <>
          <Corner rank={card.rank} suit={card.suit} />
          <Corner rank={card.rank} suit={card.suit} flipped />
        </>
      )}

      {isJoker && <ProceduralJoker card={card} />}
      {isCourt && <ProceduralCourt card={card} />}
      {isAce && <Pip suit={card.suit} cx={50} cy={70} size={44} />}

      {layout?.map(([x, y, flipped], i) => (
        <Pip
          key={i}
          suit={card.suit}
          cx={x}
          cy={y}
          size={DENSE.has(card.rank) ? DENSE_PIP_SIZE : PIP_SIZE}
          flipped={flipped}
        />
      ))}
    </svg>
  );
}

/** Card back — used only where a card is genuinely unknown (§64.3). */
export function CardBack() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" aria-hidden="true">
      <rect width={W} height={H} fill="#16304f" />
      <rect x={4} y={4} width={W - 8} height={H - 8} rx={4} fill="none" stroke="#f3f4f6" strokeWidth={2.5} />
      <pattern id="cb" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="10" fill="#1e3a5f" />
      </pattern>
      <rect x={8} y={8} width={W - 16} height={H - 16} rx={2} fill="url(#cb)" />
    </svg>
  );
}
