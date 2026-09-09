/**
 * Player avatars. Spec §70.1 — SVG marks, never emoji.
 *
 * Six geometric marks, one per seat, deterministic so a player looks the same
 * to everyone. The disc colour encodes team (§64.2); the group heading carries
 * the same information in text, since colour is never the only channel (§64.8).
 */

import type { TeamId } from "@memory-game/shared";

const MARKS: string[] = [
  // 0 — triangle
  "M50 16 L84 78 H16 Z",
  // 1 — square
  "M22 22 H78 V78 H22 Z",
  // 2 — hexagon
  "M50 14 L82 32 V68 L50 86 L18 68 V32 Z",
  // 3 — diamond stack
  "M50 12 L78 50 L50 88 L22 50 Z M50 34 L64 50 L50 66 L36 50 Z",
  // 4 — chevron
  "M20 30 L50 58 L80 30 L80 52 L50 80 L20 52 Z",
  // 5 — ring segments
  "M50 10 A40 40 0 0 1 90 50 H68 A18 18 0 0 0 50 32 Z M50 90 A40 40 0 0 1 10 50 H32 A18 18 0 0 0 50 68 Z",
];

export interface AvatarProps {
  seatPosition: number;
  /** null while unassigned in the lobby (§71.3). */
  teamId: TeamId | null;
  /** Whether this player is on the viewer's team. */
  isAlly: boolean;
  size?: number;
  dimmed?: boolean;
  ring?: "turn" | "none";
}

export function Avatar({
  seatPosition,
  teamId,
  isAlly,
  size = 56,
  dimmed = false,
  ring = "none",
}: AvatarProps) {
  const mark = MARKS[(seatPosition - 1) % MARKS.length]!;

  const background =
    teamId === null ? "#2b3350" : isAlly ? "var(--disc-us)" : "var(--disc-them)";
  const fill = teamId === null ? "#8b93ad" : isAlly ? "var(--team-us)" : "var(--team-them)";

  return (
    <div
      className="relative grid place-items-center rounded-full transition-opacity"
      style={{
        width: size,
        height: size,
        background,
        opacity: dimmed ? 0.45 : 1,
        boxShadow: ring === "turn" ? "0 0 0 3px var(--accent)" : "none",
        transitionDuration: "var(--dur-slow)",
      }}
    >
      <svg viewBox="0 0 100 100" width={size * 0.52} height={size * 0.52} aria-hidden="true">
        <path d={mark} fill={fill} />
      </svg>
    </div>
  );
}
