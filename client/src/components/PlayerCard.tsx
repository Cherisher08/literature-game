/**
 * A player at the table. Spec §64.2, §64.8, §62.1.
 *
 * Card count is shown as both a number and a bar, because the count is the
 * information players actually track and a bare numeral is easy to skim past.
 */

import { Crown, WifiOff } from "lucide-react";
import type { PublicPlayer, TeamId } from "@memory-game/shared";
import { Avatar } from "./Avatar.js";

export interface PlayerCardProps {
  player: PublicPlayer;
  myTeam: TeamId | null;
  isHost: boolean;
  isMe: boolean;
  active: boolean;
  /** Cards held at the start, to scale the bar. */
  maxCards: number;
  onClick?: () => void;
  selected?: boolean;
}

export function PlayerCard({
  player,
  myTeam,
  isHost,
  isMe,
  active,
  maxCards,
  onClick,
  selected,
}: PlayerCardProps) {
  const ally = player.teamId === myTeam;
  const tone = ally ? "var(--team-us)" : "var(--team-them)";
  const pct = maxCards > 0 ? Math.min(100, (player.cardCount / maxCards) * 100) : 0;

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick ? { onClick, type: "button" as const, "aria-pressed": selected } : {})}
      className="flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors"
      style={{
        borderColor: selected ? "var(--accent)" : active ? tone : "var(--border)",
        background: active ? "rgba(255,255,255,.04)" : "var(--surface)",
        opacity: player.spectating ? 0.6 : 1,
        transitionDuration: "var(--dur-fast)",
      }}
    >
      <Avatar
        seatPosition={player.seatPosition}
        teamId={player.teamId}
        isAlly={ally}
        size={40}
        ring={active ? "turn" : "none"}
        dimmed={player.spectating || !player.connected}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isHost && <Crown size={12} className="shrink-0 text-[var(--accent)]" aria-label="Host" />}
          <span className={`truncate text-sm ${isMe ? "font-bold" : "font-medium"}`}>
            {player.name}
            {isMe && <span className="text-[var(--accent)]"> (you)</span>}
          </span>
          {!player.connected && (
            <WifiOff size={12} className="shrink-0 text-[var(--team-them)]" aria-label="Offline" />
          )}
        </div>

        {player.spectating ? (
          <span className="text-[11px] tracking-wide text-[var(--text-muted)] uppercase">
            Spectating
          </span>
        ) : (
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${pct}%`,
                  background: tone,
                  transitionDuration: "var(--dur-base)",
                }}
              />
            </div>
            <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-[var(--text-muted)]">
              {player.cardCount}
            </span>
          </div>
        )}
      </div>
    </Tag>
  );
}
