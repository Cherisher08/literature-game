/**
 * Entry screens. Spec §2.1, §5.
 *
 * Name only — no accounts, no email, nothing else collected (§2.2).
 */

import { useState } from "react";
import { LogIn, Plus, Spade } from "lucide-react";
import {
  DEFAULT_PLAYER_COUNT,
  MAX_NAME_LENGTH,
  PLAYER_COUNTS,
  PROTOCOL_VERSION,
  ROOM_CODE_LENGTH,
  cardsPerPlayerFor,
  isUnevenDeal,
  minCardsPerPlayerFor,
  type PlayerCount,
} from "@memory-game/shared";
import { api } from "../socket/client.js";
import { INITIAL_ROOM_CODE, saveSession, useGame } from "../store/useGame.js";

export function NameScreen() {
  const name = useGame((s) => s.name);
  const setName = useGame((s) => s.setName);
  const setScreen = useGame((s) => s.setScreen);
  const setIdentity = useGame((s) => s.setIdentity);
  const applyState = useGame((s) => s.applyState);
  const setError = useGame((s) => s.setError);
  const error = useGame((s) => s.error);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);

  const trimmed = value.trim();

  return (
    <Shell>
      <h1 className="mb-1 text-2xl font-bold">Literature</h1>
      <p className="mb-8 text-sm text-[var(--text-muted)]">
        {INITIAL_ROOM_CODE
          ? `Joining room ${INITIAL_ROOM_CODE} — enter your name to jump in.`
          : "A team card game of memory and deduction."}
      </p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!trimmed || busy) return;
          setName(trimmed);

          // A room link (e.g. /TN47RQ) should drop you straight into the room, not
          // hand you back to the create/join form once you've already typed the code.
          if (!INITIAL_ROOM_CODE) {
            setScreen("HOME");
            return;
          }

          setBusy(true);
          setError(null);
          const res = await api.joinRoom(INITIAL_ROOM_CODE, trimmed, PROTOCOL_VERSION);
          setBusy(false);
          if (!("ok" in res) || !res.ok) {
            setError(describe(res));
            setScreen("HOME");
            return;
          }
          setIdentity(res.data.playerId);
          saveSession({ roomId: res.data.roomId, sessionToken: res.data.sessionToken, name: trimmed });
          applyState(res.data.state);
        }}
        className="w-full"
      >
        <label htmlFor="name" className="mb-2 block text-xs tracking-wide text-[var(--text-muted)] uppercase">
          Enter your name
        </label>
        <input
          id="name"
          autoFocus
          value={value}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => setValue(e.target.value)}
          className="mb-4 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base outline-none focus:border-[var(--accent)]"
          placeholder="Your name"
        />
        <PrimaryButton disabled={!trimmed || busy}>
          {busy ? "Joining…" : "Continue"}
        </PrimaryButton>
      </form>

      {error && (
        <p role="alert" className="mt-4 text-center text-sm text-[var(--team-them)]">
          {error}
        </p>
      )}

      <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
        Your name is used only for this room and is deleted when the room closes.
      </p>
    </Shell>
  );
}

export function HomeScreen() {
  const name = useGame((s) => s.name);
  const setIdentity = useGame((s) => s.setIdentity);
  const applyState = useGame((s) => s.applyState);
  const setError = useGame((s) => s.setError);
  const error = useGame((s) => s.error);

  // A room link opened cold and not resolved by an auto-reconnect still names the room
  // the visitor meant to reach — pre-fill the join code instead of making them retype it.
  const [code, setCode] = useState(INITIAL_ROOM_CODE ?? "");
  const [busy, setBusy] = useState(false);
  const [playerCount, setPlayerCount] = useState<PlayerCount>(DEFAULT_PLAYER_COUNT);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await api.createRoom(name, PROTOCOL_VERSION, playerCount);
    setBusy(false);
    if (!("ok" in res) || !res.ok) {
      setError(describe(res));
      return;
    }
    setIdentity(res.data.playerId);
    saveSession({ roomId: res.data.roomId, sessionToken: res.data.sessionToken, name });
    applyState(res.data.state);
  }

  async function join() {
    setBusy(true);
    setError(null);
    const res = await api.joinRoom(code.trim().toUpperCase(), name, PROTOCOL_VERSION);
    setBusy(false);
    if (!("ok" in res) || !res.ok) {
      setError(describe(res));
      return;
    }
    setIdentity(res.data.playerId);
    saveSession({ roomId: res.data.roomId, sessionToken: res.data.sessionToken, name });
    applyState(res.data.state);
  }

  return (
    <Shell>
      <div className="mb-6 flex items-center gap-2 text-[var(--accent)]">
        <Spade size={22} />
        <h1 className="text-xl font-bold">Hello, {name}</h1>
      </div>

      {/* §72: table size decides the deck, so it is fixed at creation. */}
      <fieldset className="mb-4 w-full">
        <legend className="mb-2 text-xs tracking-wide text-[var(--text-muted)] uppercase">
          Players
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {PLAYER_COUNTS.map((n) => {
            const active = playerCount === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setPlayerCount(n)}
                aria-pressed={active}
                className="rounded-xl border-2 py-3 text-center"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active ? "rgba(251,191,36,.08)" : "var(--surface)",
                }}
              >
                <div className="text-xl font-bold">{n}</div>
                <div className="text-[11px] text-[var(--accent)]">
                  {n / 2}v{n / 2}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--text-muted)]">
          9 half-suits &middot;{" "}
          {isUnevenDeal(playerCount)
            ? `${minCardsPerPlayerFor(playerCount)}–${cardsPerPlayerFor(playerCount)}`
            : cardsPerPlayerFor(playerCount)}{" "}
          cards each &middot; includes Eights &amp; Jokers
        </p>
      </fieldset>

      <PrimaryButton onClick={create} disabled={busy}>
        <Plus size={18} /> Create a room
      </PrimaryButton>

      <div className="my-6 flex w-full items-center gap-3 text-xs text-[var(--text-muted)]">
        <div className="h-px flex-1 bg-[var(--border)]" />
        or join with a code
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <form
        className="w-full"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim().length === ROOM_CODE_LENGTH) void join();
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={ROOM_CODE_LENGTH}
          placeholder="ABC123"
          aria-label="Room code"
          className="mb-3 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] outline-none focus:border-[var(--accent)]"
        />
        <SecondaryButton disabled={busy || code.trim().length !== ROOM_CODE_LENGTH}>
          <LogIn size={18} /> Join room
        </SecondaryButton>
      </form>

      {error && (
        <p role="alert" className="mt-4 text-center text-sm text-[var(--team-them)]">
          {error}
        </p>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------

export function describe(res: unknown): string {
  const r = res as { error?: string; message?: string };
  if (r.error === "TIMEOUT") return "The server did not respond. Check your connection.";
  return r.message ?? "Something went wrong.";
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center">{children}</div>
    </div>
  );
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--team-us)] px-4 py-3 font-bold text-[#07281a] transition-transform disabled:opacity-40"
      style={{ transitionDuration: "var(--dur-instant)" }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-semibold disabled:opacity-40"
    >
      {children}
    </button>
  );
}
