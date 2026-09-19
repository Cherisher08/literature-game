/**
 * Lobby with team selection. Spec §71.
 *
 * §71.4's principle applies to every control here, not just Start: a disabled
 * option states why it is disabled. A dimmed card with no explanation reads as
 * a broken app, which is exactly how the first version came across.
 */

import { useState } from "react";
import {
  Bot,
  Check,
  Copy,
  Crown,
  Eye,
  Link2,
  LogOut,
  LogIn,
  Play,
  Repeat2,
  UserX,
  Users,
  X,
} from "lucide-react";
import { BOT_DIFFICULTIES, type BotDifficulty, type PublicPlayer, type TeamId } from "@memory-game/shared";
import { api } from "../socket/client.js";
import { clearSession, useGame, useIsHost, useIsSpectator, useMe } from "../store/useGame.js";
import { describe } from "./NameAndHome.js";

const TEAM_LABEL: Record<TeamId, string> = { A: "Team A", B: "Team B" };

/**
 * `navigator.clipboard` only exists in a secure context (HTTPS or localhost) —
 * over plain HTTP on a LAN IP it's `undefined` and writeText silently does
 * nothing. Fall back to the old hidden-textarea + execCommand trick, which
 * still works over HTTP in every major browser.
 */
function copyText(text: string): void {
  if (navigator.clipboard) {
    void navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.focus();
  el.select();
  try {
    document.execCommand("copy");
  } catch {
    /* nothing more we can do — the button's own visible text is the fallback */
  }
  el.remove();
}

export function LobbyScreen() {
  const room = useGame((s) => s.room)!;
  const reset = useGame((s) => s.reset);
  const setError = useGame((s) => s.setError);
  const error = useGame((s) => s.error);
  const playerId = useGame((s) => s.playerId);
  const isHost = useIsHost();
  const isSpectator = useIsSpectator();
  const me = useMe();

  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [botLevel, setBotLevel] = useState<BotDifficulty>("MEDIUM");

  const seats = room.playerCount;
  const half = seats / 2;

  const teamA = room.players.filter((p) => p.teamId === "A");
  const teamB = room.players.filter((p) => p.teamId === "B");
  const unassigned = room.players.filter((p) => p.teamId === null);

  const bothFull = teamA.length >= half && teamB.length >= half;
  const missing = seats - room.players.length;
  const startReason =
    missing > 0
      ? `Waiting for ${missing} more player${missing === 1 ? "" : "s"}`
      : teamA.length > half || teamB.length > half
        ? `Teams must be ${half} a side`
        : null;

  async function pick(teamId: TeamId | null) {
    setError(null);
    const res = await api.selectTeam(teamId);
    if (!("ok" in res) || !res.ok) setError(describe(res));
  }

  async function addBot(difficulty: BotDifficulty, teamId?: TeamId) {
    setError(null);
    const res = await api.addBot(difficulty, teamId);
    if (!("ok" in res) || !res.ok) setError(describe(res));
  }

  async function removeBot(playerId: string) {
    setError(null);
    const res = await api.removeBot(playerId);
    if (!("ok" in res) || !res.ok) setError(describe(res));
  }

  async function kickPlayer(playerId: string) {
    setError(null);
    const res = await api.kickPlayer(playerId);
    if (!("ok" in res) || !res.ok) setError(describe(res));
  }

  async function start() {
    setBusy(true);
    setError(null);
    const res = await api.startGame();
    setBusy(false);
    if (!("ok" in res) || !res.ok) setError(describe(res));
  }

  async function leave() {
    await api.leaveRoom();
    clearSession();
    reset();
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-5 p-5">
      {/* Room code — the invite (§5.3) */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center">
        <p className="mb-2 text-xs tracking-wide text-[var(--text-muted)] uppercase">
          Share this code
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className="font-mono text-4xl font-bold tracking-[0.25em] text-[var(--accent)]">
            {room.roomId}
          </span>
          <button
            onClick={() => {
              copyText(room.roomId);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            aria-label="Copy room code"
            className="rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--surface-raised)]"
          >
            {copied ? <Check size={18} className="text-[var(--team-us)]" /> : <Copy size={18} />}
          </button>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-[var(--text-muted)]">
          <Users size={15} />
          {room.players.length} of {seats} players
        </p>

        <button
          onClick={() => {
            const link = `${window.location.origin}/${room.roomId}`;
            if (navigator.share) {
              void navigator.share({ title: "Join my Literature game", url: link }).catch(() => {});
              return;
            }
            copyText(link);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 1500);
          }}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] py-2.5 text-sm font-semibold hover:bg-white/5"
        >
          {linkCopied ? (
            <>
              <Check size={15} className="text-[var(--team-us)]" /> Link copied
            </>
          ) : (
            <>
              <Link2 size={15} /> Share invite link
            </>
          )}
        </button>
      </div>

      {/* Spectator Mode Banner */}
      {isSpectator && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--accent)]/50 bg-[var(--accent)]/10 p-4 text-left">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]">
            <Eye size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--accent)]">Spectator Mode</h2>
            <p className="text-xs text-[var(--text-muted)]">
              {room.players.length >= seats
                ? "This room is full. You are tuned in as a spectator and will watch the game live once started."
                : "You joined as a spectator. You can listen in, chat, and watch the match live."}
            </p>
          </div>
        </div>
      )}

      {/* Team selection (§71) — everyone picks their own, not just the host */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Choose your team</h2>
          <span className="text-xs text-[var(--text-muted)]">
            {isSpectator
              ? "Spectating live audience"
              : me?.teamId
                ? "Tap the other team to switch"
                : `${half} per side`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(["A", "B"] as TeamId[]).map((teamId) => {
            const members = teamId === "A" ? teamA : teamB;
            const mine = me?.teamId === teamId;
            const full = members.length >= half;
            const blocked = full && !mine;

            // A container, not a button: the member rows carry their own remove
            // controls, and a button may not contain another button.
            return (
              <div
                key={teamId}
                className="flex flex-col rounded-2xl border-2 p-3 transition-colors"
                style={{
                  borderColor: mine ? "var(--accent)" : "var(--border)",
                  background: mine ? "rgba(251,191,36,.08)" : "var(--surface)",
                  transitionDuration: "var(--dur-fast)",
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold">{TEAM_LABEL[teamId]}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      background: full ? "rgba(239,68,68,.15)" : "rgba(255,255,255,.06)",
                      color: full ? "var(--team-them)" : "var(--text-muted)",
                    }}
                  >
                    {members.length}/{half}
                  </span>
                </div>

                <div className="mb-2 min-h-[72px] space-y-1.5">
                  {members.map((p) => (
                    <MemberRow
                      key={p.id}
                      player={p}
                      hostId={room.hostId}
                      meId={me?.id}
                      {...(isHost && p.isBot
                        ? { onRemove: () => void removeBot(p.id) }
                        : {})}
                      {...(isHost && p.id !== me?.id
                        ? { onKick: () => void kickPlayer(p.id) }
                        : {})}
                    />
                  ))}
                  {members.length === 0 && (
                    <span className="text-xs text-[var(--text-muted)]">Nobody yet</span>
                  )}
                </div>

                {/* §71.4: a disabled control states why. */}
                <button
                  onClick={() => void pick(teamId)}
                  disabled={isSpectator || blocked || mine}
                  className="mt-auto w-full rounded-lg border px-2 py-1.5 text-[11px] font-semibold disabled:cursor-default"
                  style={{
                    borderColor: mine ? "var(--accent)" : "var(--border)",
                    color: isSpectator
                      ? "var(--text-muted)"
                      : mine
                        ? "var(--accent)"
                        : blocked
                          ? "var(--team-them)"
                          : "var(--text)",
                    background: mine ? "transparent" : "rgba(255,255,255,.04)",
                    opacity: isSpectator || blocked ? 0.6 : 1,
                  }}
                >
                  {isSpectator ? (
                    "Spectating"
                  ) : mine ? (
                    <span className="flex items-center justify-center gap-1">
                      <Check size={12} /> You're here
                    </span>
                  ) : blocked ? (
                    <>Full{bothFull ? " — step out below" : ""}</>
                  ) : me?.teamId ? (
                    <span className="flex items-center justify-center gap-1">
                      <Repeat2 size={12} /> Switch here
                    </span>
                  ) : (
                    "Join"
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* §71.5: the neutral box. Without somewhere to step out to, two full
            teams cannot swap anyone without a player leaving the room. */}
        <div
          className="mt-3 w-full rounded-2xl border-2 border-dashed p-3 text-left transition-colors"
          style={{
            borderColor: !isSpectator && !me?.teamId ? "var(--accent)" : "var(--border)",
            background: !isSpectator && !me?.teamId ? "rgba(251,191,36,.06)" : "transparent",
            opacity: isSpectator ? 0.6 : 1,
            transitionDuration: "var(--dur-fast)",
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">No team</span>
            <span className="text-[11px] text-[var(--text-muted)]">{unassigned.length}</span>
          </div>

          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 min-h-[24px]">
            {unassigned.map((p) => (
              <div key={p.id} className="min-w-[120px]">
                <MemberRow
                  player={p}
                  hostId={room.hostId}
                  meId={me?.id}
                  {...(isHost && p.isBot ? { onRemove: () => void removeBot(p.id) } : {})}
                  {...(isHost && p.id !== me?.id ? { onKick: () => void kickPlayer(p.id) } : {})}
                />
              </div>
            ))}
            {unassigned.length === 0 && (
              <span className="text-xs text-[var(--text-muted)]">Nobody waiting</span>
            )}
          </div>

          <button
            onClick={() => void pick(null)}
            disabled={isSpectator || !me?.teamId}
            className="w-full rounded-lg border px-2 py-1.5 text-[11px] font-semibold disabled:cursor-default"
            style={{
              borderColor: !isSpectator && !me?.teamId ? "var(--accent)" : "var(--border)",
              color: isSpectator
                ? "var(--text-muted)"
                : !me?.teamId
                  ? "var(--accent)"
                  : "var(--text)",
              background: !isSpectator && !me?.teamId ? "transparent" : "rgba(255,255,255,.04)",
              opacity: isSpectator || !me?.teamId ? 0.6 : 1,
            }}
          >
            {isSpectator ? (
              "Spectators do not hold seats or join teams"
            ) : !me?.teamId ? (
              <span className="flex items-center justify-center gap-1">
                <Check size={12} /> You'll be placed automatically at start
              </span>
            ) : bothFull ? (
              <span className="flex items-center justify-center gap-1 text-[var(--accent)]">
                <LogIn size={12} /> Step out here to free your slot, then swap
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1">
                <LogIn size={12} /> Step out of your team
              </span>
            )}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-center text-sm text-[var(--team-them)]">
            {error}
          </p>
        )}
      </section>

      {/* Spectators List */}
      {room.spectators && room.spectators.length > 0 && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Eye size={15} className="text-[var(--accent)]" /> Spectators ({room.spectators.length})
            </h2>
            <span className="text-[11px] text-[var(--text-muted)]">Live audience</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {room.spectators.map((s) => (
              <span
                key={s.id}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs"
              >
                <span className={`h-2 w-2 rounded-full ${s.connected ? "bg-[var(--team-us)]" : "bg-[var(--text-muted)]"}`} />
                <span className={s.id === playerId ? "font-bold text-[var(--accent)]" : "text-[var(--text)]"}>
                  {s.name}
                  {s.id === playerId ? " (you)" : ""}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* §73: bots fill empty seats, on a chosen side. Host only, lobby only. */}
      {isHost && missing > 0 && (
        <section className="rounded-xl border border-dashed border-[var(--border)] p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Bot size={14} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold">Add a bot</h2>
            <span className="ml-auto text-[11px] text-[var(--text-muted)]">
              {missing} seat{missing === 1 ? "" : "s"} free
            </span>
          </div>

          <div className="mb-2 grid grid-cols-3 gap-1.5">
            {BOT_DIFFICULTIES.map((d) => {
              const active = botLevel === d;
              return (
                <button
                  key={d}
                  onClick={() => setBotLevel(d)}
                  aria-pressed={active}
                  className="rounded-lg border px-2 py-1.5 text-xs font-semibold"
                  style={{
                    borderColor: active ? "var(--accent)" : "var(--border)",
                    background: active ? "rgba(251,191,36,.1)" : "var(--surface)",
                  }}
                >
                  {d === "EASY" ? "Easy" : d === "MEDIUM" ? "Medium" : "Hard"}
                  <div className="text-[10px] font-normal text-[var(--text-muted)]">
                    {d === "EASY" ? "own hand" : d === "MEDIUM" ? "remembers" : "deduces"}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(["A", "B"] as TeamId[]).map((teamId) => {
              const full =
                (teamId === "A" ? teamA : teamB).length >= half;
              return (
                <button
                  key={teamId}
                  onClick={() => void addBot(botLevel, teamId)}
                  disabled={full}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  + {TEAM_LABEL[teamId]}
                  {full && (
                    <div className="text-[10px] font-normal text-[var(--team-them)]">full</div>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => void addBot(botLevel)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-xs font-semibold"
            >
              + No team
              <div className="text-[10px] font-normal text-[var(--text-muted)]">auto</div>
            </button>
          </div>
        </section>
      )}

      <div className="mt-auto space-y-3">
        {isHost ? (
          <>
            <button
              onClick={() => void start()}
              disabled={busy || startReason !== null}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--team-us)] px-4 py-3.5 font-bold text-[#07281a] disabled:opacity-40"
            >
              <Play size={18} /> Start game
            </button>
            {startReason && (
              <p className="text-center text-xs text-[var(--text-muted)]">{startReason}</p>
            )}
          </>
        ) : (
          <p className="text-center text-sm text-[var(--text-muted)]">
            {isSpectator
              ? (startReason ? `Spectating: ${startReason}` : "Spectating: Waiting for host to start match")
              : (startReason ?? "Waiting for the host to start")}
          </p>
        )}

        <button
          onClick={() => void leave()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-muted)]"
        >
          <LogOut size={16} /> Leave room
        </button>
      </div>
    </div>
  );
}

function MemberRow({
  player,
  hostId,
  meId,
  onRemove,
  onKick,
}: {
  player: PublicPlayer;
  hostId: string;
  meId: string | undefined;
  onRemove?: () => void;
  /** Host-only: kick any non-self player from the lobby. */
  onKick?: () => void;
}) {
  const isMe = player.id === meId;
  return (
    <div className="group flex items-center gap-1.5 text-sm">
      {player.id === hostId && (
        <Crown size={12} className="shrink-0 text-[var(--accent)]" aria-label="Host" />
      )}
      {player.isBot && <Bot size={12} className="shrink-0 text-[var(--text-muted)]" />}
      <span className={`truncate ${isMe ? "font-bold text-[var(--accent)]" : ""}`}>
        {player.name}
        {isMe ? " (you)" : ""}
      </span>
      {player.isBot && player.difficulty && (
        <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
          {player.difficulty.toLowerCase()}
        </span>
      )}
      <span className="ml-auto flex items-center gap-0.5">
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label={`Remove ${player.name}`}
            className="shrink-0 rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--team-them)]"
          >
            <X size={12} />
          </button>
        )}
        {onKick && !onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!confirm(`Kick ${player.name} from the room?`)) return;
              onKick();
            }}
            aria-label={`Kick ${player.name}`}
            title="Kick player"
            className="shrink-0 rounded p-0.5 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--team-them)]"
          >
            <UserX size={12} />
          </button>
        )}
      </span>
    </div>
  );
}
