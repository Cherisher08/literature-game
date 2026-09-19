import { useState } from "react";
import { HelpCircle, BookOpen } from "lucide-react";
import { HowToPlayModal } from "./HowToPlayModal.js";

export interface HowToPlayButtonProps {
  gameId?: string;
  variant?: "icon" | "pill" | "subtle";
  label?: string;
  className?: string;
  onClick?: () => void;
}

export function HowToPlayButton({
  gameId = "literature",
  variant = "icon",
  label = "How to play",
  className = "",
  onClick,
}: HowToPlayButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  function handleClick() {
    if (onClick) {
      onClick();
    } else {
      setModalOpen(true);
    }
  }

  return (
    <>
      {variant === "icon" && (
        <button
          type="button"
          onClick={handleClick}
          title="How to play (Game Rules & Help)"
          aria-label="How to play instructions"
          className={`group relative flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)] shadow-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--surface)] hover:text-[var(--accent)] active:scale-95 ${className}`}
        >
          <HelpCircle size={17} className="transition-transform group-hover:scale-110" />
          <span className="sr-only">How to play</span>
        </button>
      )}

      {variant === "pill" && (
        <button
          type="button"
          onClick={handleClick}
          title="How to play instructions"
          aria-label="How to play instructions"
          className={`group flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] shadow-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--surface)] hover:text-[var(--accent)] active:scale-95 ${className}`}
        >
          <HelpCircle size={15} className="text-[var(--accent)] transition-transform group-hover:scale-110" />
          <span>{label}</span>
        </button>
      )}

      {variant === "subtle" && (
        <button
          type="button"
          onClick={handleClick}
          title="How to play instructions"
          aria-label="How to play instructions"
          className={`flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline ${className}`}
        >
          <BookOpen size={14} />
          <span>{label}</span>
        </button>
      )}

      {!onClick && (
        <HowToPlayModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          initialGameId={gameId}
        />
      )}
    </>
  );
}
