/**
 * Main Poker game screen.
 *
 * Layout:
 *  - Top bar: room code, hand info, leave, HowToPlay
 *  - Centre: PokerTable SVG (oval table with seats)
 *  - My hand: hole cards
 *  - Bottom bar (active player only): PokerBetControls
 *  - Lobby state: pre-start with player list & Start / Add-Bot buttons
 */

import { useState } from "react";
import {
  ArrowLeft,
  Bot,
  Copy,
  Crown,
  Diamond,
  Play,
  RefreshCw,
} from "lucide-react";
import type { PokerAction } from "@memory-game/shared";
import { api } from "../socket/client.js";
import { clearSession, useGame, useIsHost } from "../store/useGame.js";
import { HowToPlayButton } from "../components/HowToPlayButton.js";
import { PokerTable } from "../components/poker/PokerTable.js";
import { PokerBetControls } from "../components/poker/PokerBetControls.js";

const SUIT_SYMBOLS: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

export function PokerGame() {
  const room = useGame((s) => s.room);
  const playerId = useGame((s) => s.playerId)!;
  const setScreen = useGame((s) => s.setScreen);
  const isHost = useIsHost();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const poker = room.poker;
  if (!poker) {
    // Room exists but no poker state yet — show lobby
    return <PokerLobby room={room} playerId={playerId} isHost={isHost} />;
  }

  const isMyTurn = poker.activePlayerId === playerId;
  const myPlayer = poker.players.find((p) => p.id === playerId);

  function copyRoomCode() {
    const text = `${window.location.origin}/${room!.roomId}`;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function doAction(action: PokerAction) {
    if (busy) return;
    setBusy(true);
    await api.pokerAction(action);
    setBusy(false);
  }

  async function doNextHand() {
    if (busy) return;
    setBusy(true);
    await api.pokerNextHand();
    setBusy(false);
  }

  function doLeave() {
    void api.leaveRoom();
    clearSession();
    useGame.getState().reset();
    setScreen("HOME");
  }

  const isHandOver = poker.round === "HAND_OVER" || poker.round === "SHOWDOWN";
  const isFinished = poker.status === "FINISHED";

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: "var(--surface)" }}>
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={doLeave}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)] transition-colors"
          >
            <ArrowLeft size={14} /> Leave
          </button>

          <div className="flex items-center gap-2">
            <Diamond size={14} className="text-[var(--card-red)]" />
            <span className="text-sm font-black text-[var(--text)]">
              Texas Hold'em
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Hand number */}
          <span className="hidden text-xs text-[var(--text-muted)] sm:inline">
            Hand #{poker.handNumber} &middot; SB ${poker.smallBlind} / BB ${poker.bigBlind}
          </span>

          {/* Room code copy */}
          <button
            onClick={copyRoomCode}
            className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-mono font-bold hover:bg-[var(--surface-raised)]/80 transition-colors"
          >
            {copied ? "Copied!" : room.roomId}
            <Copy size={11} className="ml-0.5 opacity-60" />
          </button>

          <HowToPlayButton gameId="poker" variant="icon" />
        </div>
      </div>

      {/* Main area: table */}
      <div className="relative min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
        <PokerTable state={poker} myPlayerId={playerId} />
      </div>

      {/* My hole cards — always visible at bottom */}
      {myPlayer && myPlayer.hasCards && poker.myHoleCards.length === 2 && (
        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[var(--text-muted)]">Your hand</span>
              <div className="flex gap-2">
                {poker.myHoleCards.map((card, i) => (
                  <HoleCard key={i} rank={card.rank} suit={card.suit} />
                ))}
              </div>
            </div>
            {poker.currentHandRank && (
              <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-xs font-bold text-[var(--accent)]">
                {poker.currentHandRank}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Finished state */}
      {isFinished && (
        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 text-center">
          <p className="mb-2 text-sm font-bold text-[var(--text)]">Game Over!</p>
          <button
            onClick={doLeave}
            className="rounded-2xl bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-[#2a1e02]"
          >
            Back to Lobby
          </button>
        </div>
      )}

      {/* Hand over: Next Hand button (host) */}
      {isHandOver && !isFinished && (
        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--text-muted)]">
              {poker.winners && poker.winners.length > 0 && (
                <span>
                  🏆 <strong className="text-[var(--text)]">{poker.winners[0]!.playerName}</strong>{" "}
                  wins ${poker.winners[0]!.amount.toLocaleString()} with{" "}
                  <em>{poker.winners[0]!.handName}</em>
                </span>
              )}
            </div>
            {isHost && (
              <button
                onClick={doNextHand}
                disabled={busy}
                className="flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[#2a1e02] disabled:opacity-60"
              >
                <RefreshCw size={14} />
                Next Hand
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bet controls — shown only on my turn during active hand */}
      {isMyTurn && !isHandOver && !isFinished && (
        <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-raised)]">
          <PokerBetControls state={poker} onAction={doAction} busy={busy} />
        </div>
      )}
    </div>
  );
}

/** Inline hole card chip */
function HoleCard({ rank, suit }: { rank: string; suit: string }) {
  const isRed = suit === "H" || suit === "D";
  return (
    <div
      className="flex h-14 w-10 flex-col items-center justify-center rounded-xl border border-[var(--border)] shadow-md"
      style={{ background: "white" }}
    >
      <span
        className="text-base font-black leading-none"
        style={{ color: isRed ? "#dc2626" : "#1e293b" }}
      >
        {rank}
      </span>
      <span
        className="text-lg leading-none"
        style={{ color: isRed ? "#dc2626" : "#1e293b" }}
      >
        {SUIT_SYMBOLS[suit]}
      </span>
    </div>
  );
}

/** Pre-start lobby for poker rooms */
function PokerLobby({
  room,
  playerId,
  isHost,
}: {
  room: NonNullable<ReturnType<typeof useGame.getState>["room"]>;
  playerId: string;
  isHost: boolean;
}) {
  const setScreen = useGame((s) => s.setScreen);
  const [busy, setBusy] = useState(false);

  async function startPoker() {
    if (busy) return;
    setBusy(true);
    await api.pokerStart();
    setBusy(false);
  }

  async function addBot() {
    if (busy) return;
    setBusy(true);
    await api.pokerAddBot();
    setBusy(false);
  }

  function leaveRoom() {
    void api.leaveRoom();
    clearSession();
    useGame.getState().reset();
    setScreen("HOME");
  }

  const canStart = room.players.length >= 2;

  return (
    <div className="mx-auto min-h-full w-full max-w-lg px-4 py-8">
      <button
        onClick={leaveRoom}
        className="mb-6 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)] transition-colors"
      >
        <ArrowLeft size={16} /> Leave Table
      </button>

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--border)] shadow-md"
          style={{ background: "rgba(220,38,38,0.15)", color: "var(--card-red)" }}
        >
          <Diamond size={22} />
        </div>
        <div>
          <h1 className="text-xl font-black text-[var(--text)]">Poker Table</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Room <span className="font-mono font-bold">{room.roomId}</span> · Waiting for players
          </p>
        </div>
      </div>

      {/* Players list */}
      <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
        <h2 className="mb-3 text-xs font-bold tracking-wider text-[var(--text-muted)] uppercase">
          Seated Players ({room.players.length} / {room.playerCount})
        </h2>
        <div className="flex flex-col gap-2">
          {room.players.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <div
                className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold"
                style={{
                  background:
                    p.id === playerId ? "rgba(251,191,36,0.2)" : "rgba(30,58,95,0.5)",
                  color: p.id === playerId ? "var(--accent)" : "#93c5fd",
                }}
              >
                {p.name[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-[var(--text)]">
                {p.name}
                {p.id === playerId && (
                  <span className="ml-2 text-xs text-[var(--accent)]">(you)</span>
                )}
              </span>
              {room.hostId === p.id && (
                <Crown size={12} className="ml-auto text-[var(--accent)]" />
              )}
            </div>
          ))}

          {Array.from({ length: room.playerCount - room.players.length }).map((_, i) => (
            <div key={`empty-${i}`} className="flex items-center gap-3 opacity-35">
              <div className="h-8 w-8 rounded-full border border-dashed border-[var(--border)]" />
              <span className="text-sm text-[var(--text-muted)]">Empty seat</span>
            </div>
          ))}
        </div>
      </div>

      {!canStart && (
        <p className="mb-4 text-center text-xs text-[var(--text-muted)]">
          Need at least 2 players to start.
        </p>
      )}

      {isHost && (
        <div className="flex flex-col gap-3">
          <button
            onClick={addBot}
            disabled={busy || room.players.length >= room.playerCount}
            className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] py-3 text-sm font-bold text-[var(--text)] hover:bg-[var(--surface-raised)]/80 disabled:opacity-50"
          >
            <Bot size={16} /> Add AI Bot
          </button>
          <button
            onClick={startPoker}
            disabled={busy || !canStart}
            className="flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white shadow-md hover:brightness-110 disabled:opacity-60"
            style={{ background: "var(--card-red)" }}
          >
            <Play size={16} /> Start Poker
          </button>
        </div>
      )}
    </div>
  );
}
