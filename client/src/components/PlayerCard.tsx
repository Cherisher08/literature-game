/**
 * A player at the table. Spec §64.2, §64.8, §62.1.
 *
 * Card count is shown as both a number and a bar, because the count is the
 * information players actually track and a bare numeral is easy to skim past.
 */

import { Bot, Crown, WifiOff } from "lucide-react";
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
      className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left transition-all"
      style={{
        borderColor: selected ? "var(--accent)" : active ? tone : "var(--border)",
        background: active
          ? `linear-gradient(135deg, color-mix(in srgb, ${tone} 14%, var(--surface)), var(--surface))`
          : "var(--surface)",
        boxShadow: active ? `0 0 0 1px ${tone}, 0 6px 18px -6px ${tone}` : "none",
        opacity: player.spectating ? 0.6 : 1,
        transitionDuration: "var(--dur-fast)",
      }}
    >
      {/* Team-colour spine — a quiet, always-on cue that doesn't depend on the turn ring. */}
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: tone, opacity: player.teamId ? 0.9 : 0 }}
        aria-hidden="true"
      />

      <Avatar
        seatPosition={player.seatPosition}
        teamId={player.teamId}
        isAlly={ally}
        size={42}
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
          {player.botStandIn && (
            <span
              className="flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase"
              style={{ background: "rgba(251,191,36,.15)", color: "var(--accent)" }}
              title="Playing on their behalf while they're disconnected"
            >
              <Bot size={10} /> Bot
            </span>
          )}
          {active && (
            <span
              className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase"
              style={{ background: `color-mix(in srgb, ${tone} 20%, transparent)`, color: tone }}
            >
              Turn
            </span>
          )}
        </div>

        {player.spectating ? (
          <span className="text-[11px] tracking-wide text-[var(--text-muted)] uppercase">
            Spectating
          </span>
        ) : (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, color-mix(in srgb, ${tone} 70%, white), ${tone})`,
                  transitionDuration: "var(--dur-base)",
                }}
              />
            </div>
            <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">
              {player.cardCount}
            </span>
          </div>
        )}
      </div>
    </Tag>
  );
}
