/**
 * Lobby with team selection. Spec §71.
 *
 * §71.4's principle applies to every control here, not just Start: a disabled
 * option states why it is disabled. A dimmed card with no explanation reads as
 * a broken app, which is exactly how the first version came across.
 */

import { useState } from "react";
import { Bot, Check, Copy, Crown, LogOut, LogIn, Play, Repeat2, Users, X } from "lucide-react";
import { BOT_DIFFICULTIES, type BotDifficulty, type PublicPlayer, type TeamId } from "@memory-game/shared";
import { api } from "../socket/client.js";
import { clearSession, useGame, useIsHost, useMe } from "../store/useGame.js";
import { describe } from "./NameAndHome.js";

const TEAM_LABEL: Record<TeamId, string> = { A: "Team A", B: "Team B" };

export function LobbyScreen() {
  const room = useGame((s) => s.room)!;
  const reset = useGame((s) => s.reset);
  const setError = useGame((s) => s.setError);
  const error = useGame((s) => s.error);
  const isHost = useIsHost();
  const me = useMe();

  const [copied, setCopied] = useState(false);
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
              void navigator.clipboard?.writeText(room.roomId);
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
      </div>

      {/* Team selection (§71) — everyone picks their own, not just the host */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Choose your team</h2>
          <span className="text-xs text-[var(--text-muted)]">
            {me?.teamId ? "Tap the other team to switch" : `${half} per side`}
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
                    />
                  ))}
                  {members.length === 0 && (
                    <span className="text-xs text-[var(--text-muted)]">Nobody yet</span>
                  )}
                </div>

                {/* §71.4: a disabled control states why. */}
                <button
                  onClick={() => void pick(teamId)}
                  disabled={blocked || mine}
                  className="mt-auto w-full rounded-lg border px-2 py-1.5 text-[11px] font-semibold disabled:cursor-default"
                  style={{
                    borderColor: mine ? "var(--accent)" : "var(--border)",
                    color: mine
                      ? "var(--accent)"
                      : blocked
                        ? "var(--team-them)"
                        : "var(--text)",
                    background: mine ? "transparent" : "rgba(255,255,255,.04)",
                    opacity: blocked ? 0.6 : 1,
                  }}
                >
                  {mine ? (
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
        <button
          onClick={() => void pick(null)}
          disabled={!me?.teamId}
          aria-pressed={!me?.teamId}
          className="mt-3 w-full rounded-2xl border-2 border-dashed p-3 text-left disabled:cursor-default"
          style={{
            borderColor: !me?.teamId ? "var(--accent)" : "var(--border)",
            background: !me?.teamId ? "rgba(251,191,36,.06)" : "transparent",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">No team</span>
            <span className="text-[11px] text-[var(--text-muted)]">{unassigned.length}</span>
          </div>

          <div className="mt-1.5 flex min-h-[24px] flex-wrap items-center gap-x-3 gap-y-1">
            {unassigned.map((p) => (
              <span
                key={p.id}
                className={`text-xs ${p.id === me?.id ? "font-bold text-[var(--accent)]" : "text-[var(--text-muted)]"}`}
              >
                {p.name}
                {p.id === me?.id ? " (you)" : ""}
              </span>
            ))}
            {unassigned.length === 0 && (
              <span className="text-xs text-[var(--text-muted)]">Nobody waiting</span>
            )}
          </div>

          <div className="mt-2 text-[11px] font-semibold">
            {!me?.teamId ? (
              <span className="text-[var(--text-muted)]">
                You'll be placed automatically at start
              </span>
            ) : bothFull ? (
              <span className="flex items-center gap-1 text-[var(--accent)]">
                <LogIn size={12} /> Step out here to free your slot, then swap
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[var(--text-muted)]">
                <LogIn size={12} /> Step out of your team
              </span>
            )}
          </div>
        </button>

        {error && (
          <p role="alert" className="mt-3 text-center text-sm text-[var(--team-them)]">
            {error}
          </p>
        )}
      </section>

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
            {startReason ?? "Waiting for the host to start"}
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
}: {
  player: PublicPlayer;
  hostId: string;
  meId: string | undefined;
  onRemove?: () => void;
}) {
  const isMe = player.id === meId;
  return (
    <div className="flex items-center gap-1.5 text-sm">
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
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${player.name}`}
          className="ml-auto shrink-0 rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--team-them)]"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
