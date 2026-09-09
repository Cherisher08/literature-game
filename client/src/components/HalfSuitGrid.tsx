/**
 * Half-suit tiles. Spec §64.6, §48.
 *
 * The old tiles all read "Open" and carried no information. Each tile now shows
 * how many of its six cards YOU hold, which is directly actionable: holding at
 * least one is what makes the set legal to ask in (§48).
 */

import { CARD_SETS, type Card, type ResolvedSet, type SetId, type TeamId } from "@memory-game/shared";
import { Check, X, Zap } from "lucide-react";

const SUIT_GLYPH: Record<string, string> = { S: "S", H: "H", D: "D", C: "C" };

export interface HalfSuitGridProps {
  activeSetIds: SetId[];
  resolvedSets: ResolvedSet[];
  myHand: Card[];
  myTeam: TeamId | null;
  declaringSet?: boolean;
}

export function HalfSuitGrid({
  activeSetIds,
  resolvedSets,
  myHand,
  myTeam,
  declaringSet,
}: HalfSuitGridProps) {
  const held = new Map<number, number>();
  for (const c of myHand) held.set(c.setId, (held.get(c.setId) ?? 0) + 1);

  const sets = CARD_SETS.filter((s) => activeSetIds.includes(s.setId));

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {sets.map((set) => {
        const resolved = resolvedSets.find((r) => r.setId === set.setId);
        const ours = resolved?.wonByTeamId === myTeam;
        const mine = held.get(set.setId) ?? 0;

        const border = resolved
          ? ours
            ? "var(--team-us)"
            : "var(--team-them)"
          : declaringSet
            ? "var(--accent)"
            : mine > 0
              ? "rgba(251,191,36,.45)"
              : "var(--border)";

        return (
          <div
            key={set.setId}
            className="rounded-xl border p-2.5"
            style={{
              borderColor: border,
              background: resolved ? "rgba(255,255,255,.03)" : "var(--surface)",
              opacity: resolved ? 0.7 : 1,
            }}
          >
            <div className="flex items-start justify-between gap-1">
              <span className="text-[11px] leading-tight font-semibold">{set.name}</span>
              {set.suit !== "NONE" && (
                <span
                  className="shrink-0 text-[10px] font-bold"
                  style={{
                    color: set.suit === "H" || set.suit === "D" ? "var(--card-red)" : "var(--text-muted)",
                  }}
                >
                  {SUIT_GLYPH[set.suit]}
                </span>
              )}
            </div>

            {resolved ? (
              <div
                className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: ours ? "var(--team-us)" : "var(--team-them)" }}
              >
                {ours ? <Check size={12} /> : <X size={12} />}
                {ours ? "Ours" : "Theirs"}
                {/* §64.6: a set won because opponents declared wrongly reads differently. */}
                {resolved.stolen && <Zap size={11} aria-label="Stolen on a failed declaration" />}
              </div>
            ) : (
              <div className="mt-1.5 flex items-center gap-1.5">
                <SetPips held={mine} />
                <span className="text-[10px] text-[var(--text-muted)]">
                  {mine > 0 ? `you hold ${mine}` : "none"}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Six dots, filled for cards you hold — how much of the set you can see. */
function SetPips({ held }: { held: number }) {
  return (
    <div className="flex gap-[3px]" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: i < held ? "var(--accent)" : "rgba(255,255,255,.14)" }}
        />
      ))}
    </div>
  );
}
