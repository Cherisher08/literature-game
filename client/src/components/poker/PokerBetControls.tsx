/**
 * Betting controls for the active player.
 * Actions: Fold / Check / Call / Raise
 * Quick-raise buttons: ¼ pot, ½ pot, Full pot, 2× pot
 */

import { useState } from "react";
import type { ClientPokerState, PokerAction } from "@memory-game/shared";

interface PokerBetControlsProps {
  state: ClientPokerState;
  onAction: (action: PokerAction) => void;
  busy?: boolean;
}

export function PokerBetControls({ state, onAction, busy = false }: PokerBetControlsProps) {
  const [raiseAmount, setRaiseAmount] = useState<number>(state.minRaise);
  const [showRaiseInput, setShowRaiseInput] = useState(false);

  const myPlayer = state.players.find((p) => p.id === state.myPlayerId);
  if (!myPlayer) return null;

  const myChips = myPlayer.chips;
  const callAmount = state.highestBet - myPlayer.currentBet;
  const canCheck = callAmount === 0;
  const canCall = callAmount > 0 && callAmount < myChips;
  const canRaise = myChips > callAmount;
  const pot = state.mainPot;

  // Pot-fraction quick amounts
  const quarterPot = Math.max(state.minRaise, Math.round(pot / 4));
  const halfPot = Math.max(state.minRaise, Math.round(pot / 2));
  const fullPot = Math.max(state.minRaise, pot);
  const doublePot = Math.max(state.minRaise, pot * 2);

  const clampedRaise = Math.min(myChips, Math.max(state.minRaise, raiseAmount));

  function quickRaise(amount: number) {
    const clamped = Math.min(myChips, Math.max(state.minRaise, amount));
    setRaiseAmount(clamped);
    setShowRaiseInput(true);
  }

  function handleRaise() {
    if (clampedRaise >= myChips) {
      onAction({ type: "ALL_IN" });
    } else {
      onAction({ type: "RAISE", amount: clampedRaise });
    }
    setShowRaiseInput(false);
  }

  function handleAllIn() {
    onAction({ type: "ALL_IN" });
  }

  const btnBase =
    "flex-1 rounded-2xl py-3 text-sm font-bold transition-all active:scale-[0.97] disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Pot fraction quick-raise row */}
      {canRaise && (
        <div className="flex gap-2">
          <span className="self-center text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap">
            Quick raise:
          </span>
          {[
            { label: "¼ Pot", amount: quarterPot },
            { label: "½ Pot", amount: halfPot },
            { label: "Full Pot", amount: fullPot },
            { label: "2× Pot", amount: doublePot },
          ].map(({ label, amount }) => (
            <button
              key={label}
              disabled={busy || amount > myChips}
              onClick={() => quickRaise(amount)}
              className="flex-1 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 py-2 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all disabled:opacity-40"
            >
              {label}
              <div className="text-[9px] font-normal text-[var(--accent)]/70 mt-0.5">
                ${amount.toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Raise amount slider */}
      {showRaiseInput && canRaise && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Raise amount</span>
            <span className="text-sm font-black text-[var(--accent)]">
              ${clampedRaise.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            min={state.minRaise}
            max={myChips}
            step={Math.max(1, Math.floor(state.minRaise / 2))}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
            <span>Min ${state.minRaise.toLocaleString()}</span>
            <span>All-in ${myChips.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* Fold */}
        <button
          disabled={busy}
          onClick={() => onAction({ type: "FOLD" })}
          className={`${btnBase} border border-[var(--team-them)]/40 bg-[var(--team-them)]/10 text-[var(--team-them)] hover:bg-[var(--team-them)]/20`}
        >
          Fold
        </button>

        {/* Check or Call */}
        {canCheck ? (
          <button
            disabled={busy}
            onClick={() => onAction({ type: "CHECK" })}
            className={`${btnBase} border border-[var(--team-us)]/40 bg-[var(--team-us)]/10 text-[var(--team-us)] hover:bg-[var(--team-us)]/20`}
          >
            Check
          </button>
        ) : (
          <button
            disabled={busy || (!canCall && myChips < callAmount)}
            onClick={() =>
              callAmount >= myChips ? handleAllIn() : onAction({ type: "CALL" })
            }
            className={`${btnBase} border border-[var(--team-us)]/60 bg-[var(--team-us)]/15 text-[var(--team-us)] hover:bg-[var(--team-us)]/25`}
          >
            {callAmount >= myChips ? "All-in" : `Call $${callAmount.toLocaleString()}`}
          </button>
        )}

        {/* Raise / Bet */}
        {canRaise && (
          <button
            disabled={busy}
            onClick={() => {
              if (showRaiseInput) {
                handleRaise();
              } else {
                setRaiseAmount(halfPot);
                setShowRaiseInput(true);
              }
            }}
            className={`${btnBase} bg-[var(--accent)] text-[#2a1e02] hover:brightness-105`}
          >
            {showRaiseInput
              ? `Raise $${clampedRaise.toLocaleString()}`
              : state.highestBet === 0
                ? "Bet"
                : "Raise"}
          </button>
        )}

        {/* All-in shortcut */}
        {myChips > 0 && (
          <button
            disabled={busy}
            onClick={handleAllIn}
            className={`${btnBase} border border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20`}
            style={{ maxWidth: 72 }}
          >
            All-in
          </button>
        )}
      </div>
    </div>
  );
}
