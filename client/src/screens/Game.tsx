/**
 * The game board. Spec §38, §64.4-64.6, §65.
 *
 * Visual priority, in order:
 *   1. YOUR HAND        — the largest region; consulted on every single turn
 *   2. THE LAST EXCHANGE — the game's primary public information channel (§65)
 *   3. everything else  — players and half-suits are reference
 *
 * The earlier layout inverted this: the half-suit grid dominated the middle
 * while the hand was a cramped scrolling strip. Players and half-suits now live
 * in a "Table" sheet on mobile and a side column on desktop, so the hand can
 * take the space it deserves.
 */

import { useMemo, useState } from "react";
import {
  CARD_SETS,
  cardsPerPlayerFor,
  type Card,
  type ClientGameState,
  type PlayerCount,
  type SetId,
  type TeamId,
} from "@memory-game/shared";
import { LayoutGrid, Sparkles, X } from "lucide-react";
import { LastAskPanel } from "../components/LastAskPanel.js";
import { PlayerCard } from "../components/PlayerCard.js";
import { PlayingCard } from "../components/PlayingCard.js";
import { HalfSuitGrid } from "../components/HalfSuitGrid.js";
import { ChatDock } from "../components/ChatDock.js";
import { AskDialog } from "../components/AskDialog.js";
import { DeclareDialog } from "../components/DeclareDialog.js";
import { DeclarationReveal, GameOverBanner } from "../components/DeclarationReveal.js";
import { api } from "../socket/client.js";
import { clearSession, useGame, useMe } from "../store/useGame.js";
import { describe } from "./NameAndHome.js";

export function GameScreen() {
  const room = useGame((s) => s.room)!;
  const hydrating = useGame((s) => s.hydrating);
  const chat = useGame((s) => s.chat);
  const setError = useGame((s) => s.setError);
  const error = useGame((s) => s.error);
  const reveal = useGame((s) => s.reveal);
  const gameOver = useGame((s) => s.gameOver);
  const setReveal = useGame((s) => s.setReveal);
  const me = useMe();

  const [askOpen, setAskOpen] = useState(false);
  const [declareOpen, setDeclareOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);

  const game = room.game;
  if (!game) return null;

  const myTeam = me?.teamId ?? null;
  const myTurn =
    game.turn.kind === "PLAYER"
      ? game.turn.playerId === me?.id
      : myTeam !== null && game.turn.teamId === myTeam;

  const askingRule = myTeam ? game.askingRule[myTeam] : "OPPONENT_ONLY";
  const declareOnly = askingRule === "DECLARE_ONLY";
  const spectating = game.myHand.length === 0;
  const maxCards = cardsPerPlayerFor(room.playerCount as PlayerCount);

  const myScore = myTeam ? game.teamScores[myTeam] : 0;
  const theirScore = myTeam ? game.teamScores[myTeam === "A" ? "B" : "A"] : 0;

  const canAsk = myTurn && !spectating && !declareOnly && !game.declarationWindow;
  const canDeclare =
    !spectating && (myTurn || isMyTeamWindow(game, myTeam)) && game.status === "PLAYING";

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    const res = (await fn()) as { ok?: boolean };
    if (!res?.ok) setError(describe(res));
    return Boolean(res?.ok);
  }

  const table = <TablePanel game={game} room={room} me={me} maxCards={maxCards} />;

  return (
    <div className="flex h-full flex-col">
      {/* --- Compact status: score + turn on one line --------------------- */}
      <header className="shrink-0">
        <div
          className="flex items-center justify-between gap-3 px-4 py-1.5"
          style={{ background: "var(--score-bar)" }}
        >
          <Score label="You" value={myScore} tone="us" />
          <span className="font-mono text-[10px] tracking-widest text-[var(--text-muted)]">
            {room.roomId}
          </span>
          <Score label="Them" value={theirScore} tone="them" align="right" />
        </div>

        <div
          className="flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-bold"
          style={{
            background: myTurn ? "var(--turn-banner)" : "rgba(255,255,255,.03)",
            color: myTurn ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          {myTurn && <Sparkles size={15} />}
          <TurnLabel game={game} meId={me?.id} myTeam={myTeam} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* --- Priority column: last exchange, then the hand -------------- */}
        <div className="flex min-h-0 flex-col">
          <div className="shrink-0">
            <LastAskPanel
              lastAsk={game.lastAsk}
              players={game.players}
              myTeamId={myTeam}
              hydrating={hydrating}
            />
          </div>

          {/* The hand takes every pixel left over. */}
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-20">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold tracking-wider text-[var(--accent)] uppercase">
                Your hand
              </h2>
              <span className="text-[11px] text-[var(--text-muted)]">
                {game.myHand.length} cards
              </span>
            </div>
            <Hand cards={game.myHand} />
          </div>
        </div>

        {/* Desktop reference column */}
        <aside className="no-scrollbar hidden min-h-0 overflow-y-auto border-l border-[var(--border)] p-4 lg:block">
          {table}
        </aside>
      </div>

      {/* --- Actions ------------------------------------------------------ */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)]">
        {error && (
          <p role="alert" className="px-4 pt-2 text-center text-sm text-[var(--team-them)]">
            {error}
          </p>
        )}

        {spectating && (
          <p className="px-4 pt-2 text-center text-[11px] text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text)]">No cards left — spectating.</span>{" "}
            You cannot ask or declare. Your teammates play on.
          </p>
        )}

        {declareOnly && !spectating && (
          <p className="px-4 pt-2 text-center text-[11px] text-[var(--accent)]">
            The other team has no cards — nobody to ask. Your team must declare.
          </p>
        )}

        <div className="flex gap-2 p-3">
          <button
            onClick={() => setAskOpen(true)}
            disabled={!canAsk}
            className="flex-1 rounded-xl bg-[var(--team-us)] py-3.5 font-bold text-[#07281a] disabled:opacity-30"
          >
            ASK CARD
          </button>
          <button
            onClick={async () => {
              const opened = game.declarationWindow
                ? await act(() => api.claimDeclaration())
                : await act(() => api.openDeclaration());
              if (opened) setDeclareOpen(true);
            }}
            disabled={!canDeclare}
            className="flex-1 rounded-xl bg-[var(--accent)] py-3.5 font-bold text-[#2a1e02] disabled:opacity-30"
          >
            DECLARE
          </button>
          <button
            onClick={() => setTableOpen(true)}
            aria-label="Table — players and half-suits"
            className="rounded-xl border border-[var(--border)] px-4 lg:hidden"
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      {/* Mobile: everything secondary lives here */}
      {tableOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/70 lg:hidden"
          onClick={(e) => e.target === e.currentTarget && setTableOpen(false)}
        >
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border-t border-[var(--border)] bg-[var(--bg)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Table</h2>
              <button
                onClick={() => setTableOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 hover:bg-white/5"
              >
                <X size={20} />
              </button>
            </div>
            {table}
          </div>
        </div>
      )}

      <ChatDock chat={chat} myPlayerId={game.myPlayerId} />

      {reveal && (
        <DeclarationReveal result={reveal} myTeamId={myTeam} onDismiss={() => setReveal(null)} />
      )}

      {gameOver && !reveal && (
        <GameOverBanner
          {...(gameOver.winningTeamId ? { winningTeamId: gameOver.winningTeamId } : {})}
          drawn={gameOver.drawn}
          myTeamId={myTeam}
          scores={gameOver.scores}
          onDismiss={() => {
            clearSession();
            useGame.getState().reset();
          }}
        />
      )}

      {askOpen && (
        <AskDialog
          game={game}
          myTeam={myTeam}
          onClose={() => setAskOpen(false)}
          onAsk={async (targetId, cardId) => {
            await act(() => api.askCard(targetId, cardId));
            setAskOpen(false);
          }}
        />
      )}

      {declareOpen && (
        <DeclareDialog
          game={game}
          onClose={() => {
            void api.releaseDeclaration();
            setDeclareOpen(false);
          }}
          onDeclare={async (setId, assignments) => {
            await act(() => api.declare(setId, assignments));
            setDeclareOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

const isActive = (game: ClientGameState, playerId: string) =>
  game.turn.kind === "PLAYER" && game.turn.playerId === playerId;

const isMyTeamWindow = (game: ClientGameState, myTeam: TeamId | null) =>
  Boolean(game.declarationWindow && myTeam && game.declarationWindow.teamId === myTeam);

function TablePanel({
  game,
  room,
  me,
  maxCards,
}: {
  game: ClientGameState;
  room: { hostId: string };
  me: { id: string; teamId: TeamId | null } | null;
  maxCards: number;
}) {
  const myTeam = me?.teamId ?? null;
  const opponents = game.players.filter((p) => p.teamId !== myTeam);
  const teammates = game.players.filter((p) => p.teamId === myTeam);

  return (
    <div className="space-y-4">
      <Group title="Opponents">
        {opponents.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            myTeam={myTeam}
            isHost={p.id === room.hostId}
            isMe={p.id === me?.id}
            active={isActive(game, p.id)}
            maxCards={maxCards}
          />
        ))}
      </Group>

      <Group title="Your team">
        {teammates.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            myTeam={myTeam}
            isHost={p.id === room.hostId}
            isMe={p.id === me?.id}
            active={isActive(game, p.id)}
            maxCards={maxCards}
          />
        ))}
      </Group>

      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
          Half-suits · {game.resolvedSets.length}/{game.activeSetIds.length}
        </h2>
        <HalfSuitGrid
          activeSetIds={game.activeSetIds}
          resolvedSets={game.resolvedSets}
          myHand={game.myHand}
          myTeam={myTeam}
          declaringSet={Boolean(game.declarationWindow)}
        />
      </section>
    </div>
  );
}

function Score({
  label,
  value,
  tone,
  align = "left",
}: {
  label: string;
  value: number;
  tone: "us" | "them";
  align?: "left" | "right";
}) {
  return (
    <div className={`flex items-baseline gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
      <span
        className="text-xl font-bold tabular-nums"
        style={{ color: tone === "us" ? "var(--team-us)" : "var(--team-them)" }}
      >
        {value}
      </span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
        {title}
      </h2>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function TurnLabel({
  game,
  meId,
  myTeam,
}: {
  game: ClientGameState;
  meId: string | undefined;
  myTeam: TeamId | null;
}) {
  if (game.status === "FINISHED") {
    return <span>{game.winningTeamId === myTeam ? "You win!" : "Game over"}</span>;
  }
  const turn = game.turn;
  if (turn.kind === "TEAM_OPEN") {
    return (
      <span>
        {turn.teamId === myTeam
          ? "Your team's turn — anyone can play"
          : "Waiting for the other team"}
      </span>
    );
  }
  if (turn.playerId === meId) return <span>Your turn</span>;
  const who = game.players.find((p) => p.id === turn.playerId);
  return <span>Waiting for {who?.name ?? "…"}</span>;
}

/**
 * §64.4: grouped by half-suit — the visual form of §48's ask rule. Rows wrap so
 * the whole hand is visible at once rather than scrolling sideways.
 */
function Hand({ cards }: { cards: Card[] }) {
  const grouped = useMemo(() => {
    const bySet = new Map<SetId, Card[]>();
    for (const c of cards) {
      const list = bySet.get(c.setId) ?? [];
      list.push(c);
      bySet.set(c.setId, list);
    }
    return CARD_SETS.filter((s) => bySet.has(s.setId)).map((s) => ({
      set: s,
      cards: bySet.get(s.setId)!,
    }));
  }, [cards]);

  if (cards.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--text-muted)]">
        You have no cards left.
      </p>
    );
  }

  return (
    <div className="divide-y divide-[var(--border)]">
      {grouped.map(({ set, cards: group }) => (
        // Label on the left, cards on the right: one row per half-suit, so the
        // row height is the card height rather than a padded box around it.
        <div key={set.setId} className="flex items-center gap-3 py-1.5">
          <span className="w-[74px] shrink-0 text-[11px] leading-tight text-[var(--text-muted)]">
            {set.name}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {group.map((c, i) => (
              <PlayingCard key={c.id} card={c} size="md" tilt={(i % 2 === 0 ? -1 : 1) * 1.2} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
