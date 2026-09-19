import { useEffect, useState } from "react";
import {
  X,
  BookOpen,
  HelpCircle,
  Sparkles,
  Layers,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Spade,
  Heart,
  Club,
  Diamond,
} from "lucide-react";
import { GAME_INSTRUCTIONS, type GameInstructions } from "../data/gameInstructions.js";

export interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGameId?: string;
}

type TabType = "rules" | "halfsuits" | "tips";

const SUIT_ICONS = {
  S: Spade,
  H: Heart,
  D: Diamond,
  C: Club,
  NONE: Sparkles,
};

export function HowToPlayModal({
  isOpen,
  onClose,
  initialGameId = "literature",
}: HowToPlayModalProps) {
  const [selectedGameId, setSelectedGameId] = useState<string>(initialGameId);
  const [activeTab, setActiveTab] = useState<TabType>("rules");

  // Keep selectedGameId in sync with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedGameId(initialGameId);
      setActiveTab("rules");
    }
  }, [isOpen, initialGameId]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const game: GameInstructions =
    GAME_INSTRUCTIONS[selectedGameId] ?? GAME_INSTRUCTIONS["literature"]!;
  const hasHalfSuits = Boolean(game.halfSuits && game.halfSuits.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`How to play ${game.title}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
              <HelpCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-[var(--text)] sm:text-xl">
                  How to Play
                </h2>
                <span className="rounded-full bg-[var(--accent)]/20 px-2.5 py-0.5 text-xs font-bold text-[var(--accent)]">
                  {game.title}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">{game.playerCount}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close rules modal"
            className="rounded-xl p-2 text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--text)]"
          >
            <X size={20} />
          </button>
        </header>

        {/* Game Selector for Extensibility (only shows other games if user wants to browse) */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border)]/60 bg-[var(--surface)] px-5 py-2 sm:px-6">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mr-1 shrink-0">
            Game:
          </span>
          {Object.values(GAME_INSTRUCTIONS).map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setSelectedGameId(g.id);
                if (activeTab === "halfsuits" && !g.halfSuits) {
                  setActiveTab("rules");
                }
              }}
              className={`rounded-xl px-3 py-1 text-xs font-bold whitespace-nowrap transition-all ${
                selectedGameId === g.id
                  ? "bg-[var(--accent)] text-[#2a1e02] shadow-sm"
                  : "text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]"
              }`}
            >
              {g.title.replace(" (Fish)", "")}
            </button>
          ))}
        </div>

        {/* Sub Navigation Tabs */}
        <nav className="flex items-center gap-2 border-b border-[var(--border)] px-5 pt-3 pb-2 sm:px-6">
          <button
            onClick={() => setActiveTab("rules")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "rules"
                ? "bg-[var(--team-us)] text-[#07281a]"
                : "text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]"
            }`}
          >
            <BookOpen size={14} /> Rules &amp; Flow
          </button>

          {hasHalfSuits && (
            <button
              onClick={() => setActiveTab("halfsuits")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeTab === "halfsuits"
                  ? "bg-[var(--accent)] text-[#2a1e02]"
                  : "text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]"
              }`}
            >
              <Layers size={14} /> 9 Half-Suits
            </button>
          )}

          <button
            onClick={() => setActiveTab("tips")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              activeTab === "tips"
                ? "bg-[var(--accent)] text-[#2a1e02]"
                : "text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]"
            }`}
          >
            <Lightbulb size={14} /> Pro Tips
          </button>
        </nav>

        {/* Modal Scrollable Body */}
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Overview Banner */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-bold text-[var(--accent)]">
              Objective &amp; Quick Overview
            </h3>
            <p className="text-xs leading-relaxed text-[var(--text)] sm:text-sm">
              {game.overview}
            </p>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--team-us)]/10 border border-[var(--team-us)]/30 p-3 text-xs text-[var(--team-us)]">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Winning Goal: </span>
                {game.objective}
              </div>
            </div>
          </div>

          {/* TAB 1: RULES & FLOW */}
          {activeTab === "rules" && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Step-by-Step Gameplay Rules
              </h3>

              <div className="grid gap-3.5">
                {game.rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 transition-colors hover:border-[var(--border)]"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-[var(--text)]">
                        {rule.title}
                      </h4>
                      {rule.badge && (
                        <span className="rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                          {rule.badge}
                        </span>
                      )}
                    </div>
                    <p className="mb-3 text-xs text-[var(--text-muted)] leading-relaxed">
                      {rule.description}
                    </p>

                    <ul className="space-y-1.5">
                      {rule.keyPoints.map((point, pIdx) => {
                        const isHoldingRule = point.startsWith("The Holding Rule");
                        const isSingleMistake = point.startsWith("Any Single Mistake");
                        return (
                          <li
                            key={pIdx}
                            className={`flex items-start gap-2 rounded-xl p-2 text-xs leading-relaxed ${
                              isHoldingRule
                                ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 font-semibold"
                                : isSingleMistake
                                  ? "bg-[var(--team-them)]/10 text-[var(--team-them)] border border-[var(--team-them)]/30 font-medium"
                                  : "text-[var(--text)] bg-[var(--surface-raised)]/60"
                            }`}
                          >
                            <ChevronRight size={13} className="shrink-0 mt-0.5 opacity-70" />
                            <span>{point}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: HALF-SUITS (LITERATURE SPECIFIC) */}
          {activeTab === "halfsuits" && hasHalfSuits && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text)]">
                    The 9 Half-Suits Reference
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Each half-suit has exactly 6 cards. Remembering sets is key to declaring!
                  </p>
                </div>
                <span className="rounded-full bg-[var(--accent)]/15 px-2.5 py-1 text-xs font-bold text-[var(--accent)]">
                  54 Cards Total
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {game.halfSuits!.map((set, i) => {
                  const Icon = SUIT_ICONS[set.suit];
                  const isRed = set.suit === "H" || set.suit === "D";

                  return (
                    <div
                      key={i}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`grid h-6 w-6 place-items-center rounded-lg bg-[var(--surface-raised)] ${
                              isRed ? "text-[var(--card-red)]" : "text-[var(--text)]"
                            }`}
                          >
                            <Icon size={14} />
                          </div>
                          <span className="text-xs font-bold text-[var(--text)]">
                            {set.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          6 cards
                        </span>
                      </div>
                      <div className="mt-2 rounded-xl bg-[var(--surface-raised)]/70 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-[var(--accent)] tracking-wide">
                        {set.cards}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 p-4 text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-1.5 font-bold text-[var(--text)] mb-1">
                  <AlertTriangle size={14} className="text-[var(--accent)]" /> Remember:
                </div>
                You cannot ask for any card from a half-suit unless you hold at least one card in that half-suit in your own hand!
              </div>
            </div>
          )}

          {/* TAB 3: PRO TIPS */}
          {activeTab === "tips" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)]">
                  Strategy &amp; Pro Tips
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Master the art of deduction and teamwork.
                </p>
              </div>

              <div className="space-y-2.5">
                {game.proTips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-xs font-bold mt-0.5">
                      {idx + 1}
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-[var(--text)]">
                      {tip}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3.5 sm:px-6">
          <div className="text-[11px] text-[var(--text-muted)]">
            Press <kbd className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono border border-[var(--border)]">ESC</kbd> to exit
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-[var(--accent)] px-5 py-2 text-xs font-bold text-[#2a1e02] shadow-sm transition-transform hover:brightness-105 active:scale-95"
          >
            Got it!
          </button>
        </footer>
      </div>
    </div>
  );
}
