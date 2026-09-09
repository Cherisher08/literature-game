/**
 * Voice controls. Spec §29, §17, §69.
 *
 * Joining is an explicit button, never automatic on room entry — the mic prompt
 * must follow a user gesture (§69.3), and a game that grabs your microphone
 * unasked is a game people close.
 *
 * Room-wide only. §17 forbids a teammate channel, so there is no way to speak
 * to a subset of the room, and there must never be one.
 */

import { Loader2, Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import type { PublicPlayer } from "@memory-game/shared";
import type { VoiceApi } from "../voice/useVoice.js";

export interface VoiceDockProps {
  voice: VoiceApi;
  available: boolean;
  participants: string[];
  players: PublicPlayer[];
  myPlayerId: string;
}

export function VoiceDock({
  voice,
  available,
  participants,
  players,
  myPlayerId,
}: VoiceDockProps) {
  // §71.4's principle applies here too: a control that silently vanishes is
  // indistinguishable from a bug. When voice is unconfigured, say so quietly
  // rather than showing nothing.
  if (!available) {
    return (
      <div className="fixed right-3 bottom-[8.5rem] z-30">
        <span
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-raised)]/90 px-3 py-1.5 text-[10px] text-[var(--text-muted)]"
          title="The server has no LiveKit credentials configured"
        >
          <MicOff size={12} /> Voice off
        </span>
      </div>
    );
  }

  const inCall = voice.status === "ON";
  const connecting = voice.status === "CONNECTING";
  const others = participants.filter((id) => id !== myPlayerId);

  return (
    <div className="fixed right-3 bottom-[8.5rem] z-30 flex flex-col items-end gap-2">
      {voice.error && (
        <p className="max-w-[min(78vw,260px)] rounded-lg border border-[var(--team-them)]/40 bg-[var(--surface-raised)] px-2.5 py-1.5 text-[11px] text-[var(--team-them)]">
          {voice.error}
        </p>
      )}

      {inCall && voice.needsAudioUnlock && (
        <button
          onClick={() => void voice.unlockAudio()}
          className="max-w-[min(78vw,260px)] rounded-lg border border-[var(--accent)] bg-[var(--accent)]/15 px-3 py-1.5 text-[11px] font-semibold text-[var(--accent)]"
        >
          Tap to enable sound
        </button>
      )}

      {inCall && others.length > 0 && (
        <div className="flex max-w-[min(78vw,260px)] flex-wrap justify-end gap-1">
          {others.map((id) => {
            const p = players.find((x) => x.id === id);
            if (!p) return null;
            const talking = voice.speaking.includes(id);
            return (
              <span
                key={id}
                className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
                style={{
                  borderColor: talking ? "var(--team-us)" : "var(--border)",
                  background: "var(--surface-raised)",
                  color: talking ? "var(--team-us)" : "var(--text-muted)",
                }}
              >
                <Volume2 size={10} style={{ opacity: talking ? 1 : 0.4 }} />
                {p.name}
              </span>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        {inCall && (
          <>
            <button
              onClick={() => void voice.toggleMute()}
              aria-label={voice.muted ? "Unmute microphone" : "Mute microphone"}
              aria-pressed={voice.muted}
              className="grid h-11 w-11 place-items-center rounded-full border shadow-lg"
              style={{
                borderColor: voice.muted ? "var(--team-them)" : "var(--team-us)",
                background: "var(--surface-raised)",
                color: voice.muted ? "var(--team-them)" : "var(--team-us)",
              }}
            >
              {voice.muted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={() => void voice.leave()}
              aria-label="Leave voice chat"
              className="grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)] shadow-lg"
            >
              <PhoneOff size={18} />
            </button>
          </>
        )}

        {!inCall && (
          <button
            onClick={() => void voice.join()}
            disabled={connecting}
            aria-label="Join voice chat"
            className="flex h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-4 text-sm font-semibold shadow-lg disabled:opacity-60"
          >
            {connecting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Mic size={16} className="text-[var(--accent)]" />
            )}
            {connecting ? "Joining…" : "Voice"}
            {participants.length > 0 && (
              <span className="rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-bold text-[#2a1e02]">
                {participants.length}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
