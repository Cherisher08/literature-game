/**
 * Game Selection Hub / Home Page.
 *
 * Provides a landing portal for selecting tabletop & card games.
 * Literature is active and playable; upcoming games are displayed
 * with 'Coming Soon' badges to demonstrate the extensible multi-game architecture.
 */

import { useState } from "react";
import {
  Spade,
  Heart,
  Club,
  Diamond,
  Users,
  Eye,
  Mic,
  Bot,
  Sparkles,
  ArrowRight,
  User,
  Check,
  Edit2,
  Lock,
} from "lucide-react";
import { MAX_NAME_LENGTH } from "@memory-game/shared";
import { useGame } from "../store/useGame.js";
import { HowToPlayButton } from "../components/HowToPlayButton.js";

interface GameEntry {
  id: string;
  title: string;
  category: string;
  tagline: string;
  description: string;
  playerRange: string;
  status: "ACTIVE" | "COMING_SOON";
  icon: typeof Spade;
  accentColor: string;
  highlights: { icon: typeof Users; label: string }[];
}

const GAMES: GameEntry[] = [
  {
    id: "literature",
    title: "Literature",
    category: "Team Deduction & Memory",
    tagline: "The legendary team card game of deduction and hidden hands",
    description:
      "Play in two teams. Ask opponents for cards within sets you hold, deduce hands, make brilliant team declarations, and spectate live with voice chat.",
    playerRange: "4, 6 or 8 Players (2 Teams)",
    status: "ACTIVE",
    icon: Spade,
    accentColor: "var(--accent)",
    highlights: [
      { icon: Users, label: "4, 6 or 8 Players" },
      { icon: Mic, label: "Live Voice & Chat" },
      { icon: Eye, label: "Spectator Mode" },
      { icon: Bot, label: "Smart AI Bots" },
    ],
  },
  {
    id: "poker",
    title: "Poker",
    category: "Texas Hold'em",
    tagline: "Outwit, outbluff, and outlast at the most iconic table in the world",
    description:
      "Two hole cards. Five community cards. Blinds, raises, and all-ins. Play Texas Hold'em with up to 9 players — bet, bluff, and read the table to claim the pot.",
    playerRange: "2 – 9 Players",
    status: "ACTIVE",
    icon: Diamond,
    accentColor: "var(--card-red)",
    highlights: [
      { icon: Users, label: "2 to 9 Players" },
      { icon: Sparkles, label: "Blinds, Raises & All-ins" },
      { icon: Mic, label: "Live Voice Chat" },
      { icon: Bot, label: "AI Bots" },
    ],
  },
  {
    id: "judgement",
    title: "Judgement",
    category: "Trick-Taking & Bidding",
    tagline: "Bid exactly how many tricks you'll win — not one more, not one less",
    description:
      "The dealer chooses how many cards (1–7) each player receives. Everyone bids the number of tricks they'll win. A face-up card sets the trump suit. Play your cards — the highest card in the lead suit or trump wins the trick. Hit your bid to score; miss and pay the penalty.",
    playerRange: "2 – 7 Players",
    status: "COMING_SOON",
    icon: Heart,
    accentColor: "var(--card-red)",
    highlights: [
      { icon: Users, label: "2 to 7 Players" },
      { icon: Sparkles, label: "Bidding & Trump" },
      { icon: Eye, label: "Live Spectate" },
    ],
  },
  {
    id: "elimination",
    title: "Elimination",
    category: "Draw & Discard",
    tagline: "Race to the lowest hand — claim before someone beats you to it",
    description:
      "Each player starts with 5 cards. On your turn draw from the discard pile or the center deck, then drop a card (or multiple cards of the same value in different suits). When your total is 7 or less, declare a claim — win if you hold the lowest total, but get penalised if someone else ties or beats you.",
    playerRange: "2 – 8 Players",
    status: "COMING_SOON",
    icon: Club,
    accentColor: "var(--team-us)",
    highlights: [
      { icon: Users, label: "2 to 8 Players" },
      { icon: Sparkles, label: "Claim & Bluff" },
      { icon: Eye, label: "Real-time Spectate" },
    ],
  },
];

export function GamesHub() {
  const name = useGame((s) => s.name);
  const setName = useGame((s) => s.setName);
  const setScreen = useGame((s) => s.setScreen);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [nameError, setNameError] = useState<string | null>(null);

  function handleSaveName(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameError("Please enter your name.");
      return;
    }
    setName(trimmed);
    setEditingName(false);
    setNameError(null);
  }

  function handlePlayGame(gameId: string) {
    if (gameId !== "literature" && gameId !== "poker") return;

    if (!name.trim()) {
      setEditingName(true);
      setNameError("Please set your player name before joining.");
      return;
    }

    if (gameId === "poker") {
      setScreen("POKER_ROOM");
    } else {
      setScreen("LITERATURE_ROOM");
    }
  }

  return (
    <div className="mx-auto min-h-full w-full max-w-5xl px-4 py-8 sm:px-6">
      {/* Top Bar: Brand & Profile */}
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--accent)] shadow-md">
            <div className="grid grid-cols-2 gap-1 text-[13px]">
              <Spade size={14} />
              <Heart size={14} className="text-[var(--card-red)]" />
              <Club size={14} />
              <Diamond size={14} className="text-[var(--card-red)]" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text)] sm:text-3xl">
              Card &amp; Table Games
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Multiplayer table games with voice chat &amp; live spectator mode
            </p>
          </div>
        </div>

        {/* Player Profile Widget & How to Play */}
        <div className="flex items-center gap-2.5">
          <HowToPlayButton
            gameId="literature"
            variant="pill"
            label="How to Play"
            className="hidden sm:flex"
          />
          {editingName ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-2">
              <input
                autoFocus
                value={nameValue}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => {
                  setNameValue(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Your name"
                className="w-40 rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] outline-none"
              />
              <button
                type="submit"
                className="flex items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[#2a1e02] hover:opacity-90"
              >
                <Check size={14} /> Save
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 shadow-sm">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                <User size={14} />
              </div>
              <div className="text-left">
                <div className="text-[10px] tracking-wider text-[var(--text-muted)] uppercase">
                  Player Name
                </div>
                <div className="text-sm font-bold text-[var(--text)]">
                  {name || <span className="text-[var(--text-muted)] italic">Not set</span>}
                </div>
              </div>
              <button
                onClick={() => {
                  setNameValue(name);
                  setEditingName(true);
                }}
                title="Change name"
                aria-label="Change player name"
                className="ml-1 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
              >
                <Edit2 size={14} />
              </button>
            </div>
          )}
        </div>
      </header>

      {nameError && (
        <div className="mb-6 rounded-xl border border-[var(--team-them)]/40 bg-[var(--team-them)]/10 px-4 py-2.5 text-center text-xs text-[var(--team-them)]">
          {nameError}
        </div>
      )}

      {/* Main Section: Available & Upcoming Games */}
      <section>
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text)]">Select a Game</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Choose a room to create or join. More games coming soon!
            </p>
          </div>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
            1 Playable &middot; 3 Coming Soon
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {GAMES.map((g) => {
            const isActive = g.status === "ACTIVE";
            const Icon = g.icon;

            return (
              <div
                key={g.id}
                className={`relative flex flex-col justify-between overflow-hidden rounded-3xl border p-6 transition-all ${
                  isActive
                    ? "border-[var(--accent)]/60 bg-gradient-to-br from-[var(--surface)] to-[var(--surface-raised)] shadow-xl shadow-[var(--accent)]/5 hover:border-[var(--accent)] hover:shadow-[var(--accent)]/15"
                    : "border-[var(--border)]/70 bg-[var(--surface)]/60 opacity-85"
                }`}
              >
                {/* Glow pill for active game */}
                {isActive && (
                  <div
                    className="pointer-events-none absolute -top-16 -right-16 h-36 w-36 rounded-full blur-2xl"
                    style={{ background: "rgba(251, 191, 36, 0.15)" }}
                  />
                )}

                <div>
                  {/* Category & Status Badges */}
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                      {g.category}
                    </span>

                    {isActive ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-[var(--team-us)]/15 px-2.5 py-1 text-[11px] font-bold text-[var(--team-us)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--team-us)] animate-pulse" />
                        Available Now
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
                        <Lock size={10} /> Coming Soon
                      </span>
                    )}
                  </div>

                  {/* Title & Icon */}
                  <div className="mb-2 flex items-center gap-3">
                    <div
                      className="grid h-10 w-10 place-items-center rounded-xl"
                      style={{
                        background: isActive ? "rgba(251, 191, 36, 0.15)" : "rgba(255, 255, 255, 0.05)",
                        color: g.accentColor,
                      }}
                    >
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-[var(--text)]">
                        {g.title}
                      </h3>
                      <div className="text-xs text-[var(--text-muted)]">{g.playerRange}</div>
                    </div>
                  </div>

                  <p className="mb-4 text-xs font-semibold text-[var(--accent)]">{g.tagline}</p>
                  <p className="mb-6 text-xs leading-relaxed text-[var(--text-muted)]">
                    {g.description}
                  </p>

                  {/* Highlights */}
                  <div className="mb-6 flex flex-wrap gap-2">
                    {g.highlights.map((h, i) => {
                      const HIcon = h.icon;
                      return (
                        <span
                          key={i}
                          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)]/70 bg-[var(--surface-raised)]/60 px-2.5 py-1 text-[11px] text-[var(--text-muted)]"
                        >
                          <HIcon size={12} className="text-[var(--accent)]" />
                          {h.label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Action */}
                <div>
                  {isActive ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <HowToPlayButton
                        gameId={g.id}
                        variant="pill"
                        label="How to Play"
                        className="justify-center rounded-2xl border-[var(--accent)]/40 bg-[var(--surface-raised)] py-3.5 px-4 text-sm font-bold text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] sm:w-auto"
                      />
                      <button
                        onClick={() => handlePlayGame(g.id)}
                        className="group flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3.5 text-sm font-bold text-[#2a1e02] shadow-md transition-transform hover:brightness-105 active:scale-[0.98]"
                        style={g.id === "poker" ? { background: "var(--card-red)", color: "white" } : {}}
                      >
                        Play {g.title}
                        <ArrowRight
                          size={16}
                          className="transition-transform group-hover:translate-x-1"
                        />
                      </button>
                    </div>
                  ) : (
                    <div className="flex w-full gap-2">
                      <HowToPlayButton
                        gameId={g.id}
                        variant="pill"
                        label="Rules"
                        className="flex-1 justify-center rounded-2xl py-3 text-xs font-semibold"
                      />
                      <button
                        disabled
                        className="flex-1 cursor-not-allowed items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)]/40 px-4 py-3 text-xs font-semibold text-[var(--text-muted)] opacity-60"
                      >
                        In Development
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer Info */}
      <footer className="mt-14 border-t border-[var(--border)] pt-6 text-center text-xs text-[var(--text-muted)]">
        <p>Literature Game Hub &middot; Real-time multiplayer card gaming with spectator &amp; voice support.</p>
      </footer>
    </div>
  );
}
