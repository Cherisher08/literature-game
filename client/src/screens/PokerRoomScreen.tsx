/**
 * Poker room entry screen.
 * Mirrors LiteratureRoomScreen but for Texas Hold'em rooms.
 * Supports player count 2–9, starting chips, and blind config.
 */

import { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Coins,
  Diamond,
  Eye,
  LogIn,
  Plus,
  User,
} from "lucide-react";
import { MAX_NAME_LENGTH, PROTOCOL_VERSION, ROOM_CODE_LENGTH } from "@memory-game/shared";
import { api } from "../socket/client.js";
import { saveSession, useGame } from "../store/useGame.js";
import { HowToPlayButton } from "../components/HowToPlayButton.js";

const CHIP_PRESETS = [500, 1000, 2000, 5000] as const;
const BLIND_PRESETS: [number, number][] = [
  [5, 10],
  [10, 20],
  [25, 50],
  [50, 100],
];
const PLAYER_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

export function PokerRoomScreen() {
  const name = useGame((s) => s.name);
  const setName = useGame((s) => s.setName);
  const setScreen = useGame((s) => s.setScreen);
  const setIdentity = useGame((s) => s.setIdentity);
  const applyState = useGame((s) => s.applyState);
  const setError = useGame((s) => s.setError);
  const error = useGame((s) => s.error);

  const [tab, setTab] = useState<"create" | "join">("create");
  const [nameValue, setNameValue] = useState(name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Create config
  const [playerCount, setPlayerCount] = useState(6);
  const [startingChips, setStartingChips] = useState(1000);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [blindPresetIdx, setBlindPresetIdx] = useState(1); // [10, 20]

  const trimmedName = nameValue.trim();
  const trimmedCode = roomCode.trim().toUpperCase();
  const [sb, bb] = BLIND_PRESETS[blindPresetIdx]!;

  function requireName(): boolean {
    if (!trimmedName) {
      setNameError("Please enter your name first.");
      return false;
    }
    setNameError(null);
    return true;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!requireName() || busy) return;
    setName(trimmedName);
    setBusy(true);
    setError(null);

    const res = await api.createRoom(trimmedName, PROTOCOL_VERSION, playerCount, "POKER");
    setBusy(false);
    if (!("ok" in res) || !res.ok) {
      setError("error" in res ? String(res.error) : "Failed to create room.");
      return;
    }
    setIdentity(res.data.playerId);
    saveSession({
      roomId: res.data.roomId,
      sessionToken: res.data.sessionToken,
      name: trimmedName,
    });
    applyState(res.data.state);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!requireName() || busy || !trimmedCode) return;
    setName(trimmedName);
    setBusy(true);
    setError(null);

    const res = await api.joinRoom(trimmedCode, trimmedName, PROTOCOL_VERSION);
    setBusy(false);
    if (!("ok" in res) || !res.ok) {
      setError("error" in res ? String(res.error) : "Could not join that room.");
      return;
    }
    setIdentity(res.data.playerId);
    saveSession({
      roomId: res.data.roomId,
      sessionToken: res.data.sessionToken,
      name: trimmedName,
    });
    applyState(res.data.state);
  }

  return (
    <div className="mx-auto min-h-full w-full max-w-lg px-4 py-8 sm:px-6">
      {/* Back */}
      <button
        onClick={() => setScreen("HOME")}
        className="mb-6 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)] transition-colors"
      >
        <ArrowLeft size={16} /> Back to Games
      </button>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--border)] shadow-md"
            style={{ background: "rgba(220,38,38,0.15)", color: "var(--card-red)" }}
          >
            <Diamond size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text)]">
              Texas Hold'em
            </h1>
            <p className="text-xs text-[var(--text-muted)]">2 – 9 players per table</p>
          </div>
        </div>
        <HowToPlayButton gameId="poker" variant="icon" />
      </div>

      {/* Name */}
      <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
        <label className="mb-2 block text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
          Your Name
        </label>
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
            <User size={14} />
          </div>
          <input
            value={nameValue}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => {
              setNameValue(e.target.value);
              if (nameError) setNameError(null);
            }}
            placeholder="Enter your name"
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        {nameError && (
          <p className="mt-2 text-xs text-[var(--team-them)]">{nameError}</p>
        )}
      </div>

      {/* Tab switcher */}
      <div className="mb-6 flex rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1">
        {(["create", "join"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
              tab === t
                ? "bg-[var(--surface-raised)] text-[var(--text)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {t === "create" ? (
              <span className="flex items-center justify-center gap-1.5">
                <Plus size={14} /> Create Table
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <LogIn size={14} /> Join Table
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          {/* Player count */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
            <label className="mb-3 block text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Seats at the Table
            </label>
            <div className="flex flex-wrap gap-2">
              {PLAYER_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPlayerCount(n)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold border transition-all ${
                    playerCount === n
                      ? "border-[var(--card-red)] bg-[var(--card-red)]/15 text-[var(--card-red)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Starting chips */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
            <label className="mb-3 block text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              <span className="flex items-center gap-1.5">
                <Coins size={13} /> Starting Chips
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CHIP_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setStartingChips(c)}
                  className={`rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                    startingChips === c
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  {c.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced: blind sizes */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              Blind Levels (SB / BB)
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Currently: {sb} / {bb}
            </p>
            {showAdvanced && (
              <div className="mt-3 flex flex-wrap gap-2">
                {BLIND_PRESETS.map(([s, b], i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setBlindPresetIdx(i)}
                    className={`rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                      blindPresetIdx === i
                        ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                    }`}
                  >
                    {s} / {b}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-xl border border-[var(--team-them)]/40 bg-[var(--team-them)]/10 px-4 py-2.5 text-center text-xs text-[var(--team-them)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl py-4 text-sm font-black text-white shadow-md transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            style={{ background: "var(--card-red)" }}
          >
            {busy ? "Creating table…" : "Create Table"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
            <label className="mb-2 block text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Room Code
            </label>
            <input
              autoFocus
              value={roomCode}
              maxLength={ROOM_CODE_LENGTH}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABCD12"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base font-mono tracking-widest outline-none focus:border-[var(--card-red)]"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--surface)]/60 px-3.5 py-2.5 text-xs text-[var(--text-muted)]">
            <Eye size={13} className="shrink-0" />
            <span>You can also spectate an existing game without taking a seat.</span>
          </div>

          {error && (
            <p className="rounded-xl border border-[var(--team-them)]/40 bg-[var(--team-them)]/10 px-4 py-2.5 text-center text-xs text-[var(--team-them)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !trimmedCode}
            className="w-full rounded-2xl py-4 text-sm font-black text-white shadow-md transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            style={{ background: "var(--card-red)" }}
          >
            {busy ? "Joining…" : "Join Table"}
          </button>
        </form>
      )}
    </div>
  );
}
