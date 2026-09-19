// App shell (§33, §63, §68.5) — the banner distinguishes reconnecting from server-gone so a stalled connection doesn't read as "waiting forever" (§63).

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PROTOCOL_VERSION } from "@memory-game/shared";
import { GamesHub } from "./screens/GamesHub.js";
import { LiteratureRoomScreen, NameScreen } from "./screens/NameAndHome.js";
import { LobbyScreen } from "./screens/Lobby.js";
import { GameScreen } from "./screens/Game.js";
import { ChatDock } from "./components/ChatDock.js";
import { VoiceDock } from "./components/VoiceDock.js";
import { useVoice } from "./voice/useVoice.js";
import { api, attachListeners, getSocket } from "./socket/client.js";
import { clearSession, loadSession, useGame, useIsSpectator, useMe } from "./store/useGame.js";

// Syncs the URL (/home, /lobby, /:roomId) to `screen` so back has real history entries instead of none, which is what closed the tab.
function useRouteSync(onBackPastRoom: () => void) {
  const screen = useGame((s) => s.screen);
  const roomId = useGame((s) => s.room?.roomId);
  const location = useLocation();
  const navigate = useNavigate();
  const weNavigated = useRef(false);
  const mounted = useRef(false);

  const target =
    screen === "GAME" && roomId
      ? `/${roomId}`
      : screen === "LOBBY" && roomId
        ? "/lobby"
        : screen === "LITERATURE_ROOM"
          ? "/literature"
          : "/home";

  // Forward: app state moved on (joined, started, left) — push the URL to match.
  useEffect(() => {
    if (location.pathname === target) return;
    weNavigated.current = true;
    navigate(target, { replace: !mounted.current });
    mounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // Backward: URL changed under us (back/forward). Stepping back to /home while still
  // seated in a room isn't allowed to happen silently — a stray back tap must not drop
  // you out of a live game — so the URL snaps back to where state is and a confirmation
  // is asked before anything actually leaves. Any other mismatch just snaps back too.
  useEffect(() => {
    mounted.current = true;
    if (weNavigated.current) {
      weNavigated.current = false;
      return;
    }
    if (location.pathname === target) return;

    const leavingRoom = location.pathname === "/home" && target !== "/home";
    weNavigated.current = true;
    navigate(target, { replace: true });
    if (leavingRoom) onBackPastRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}

export default function App() {
  const screen = useGame((s) => s.screen);
  const connection = useGame((s) => s.connection);
  const room = useGame((s) => s.room);
  const chat = useGame((s) => s.chat);
  const voiceParticipants = useGame((s) => s.voiceParticipants);
  const playerId = useGame((s) => s.playerId);
  const me = useMe();
  const isSpectator = useIsSpectator();
  const myId = playerId || me?.id;
  // Lifted above the screens so a voice call survives the lobby-to-game transition instead of dropping and reconnecting.
  const voice = useVoice();
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Disconnect voice whenever the player leaves the room for any reason.
  // `room` going null is the single canonical signal that covers: Leave Room
  // button (Lobby & Game), Game Over banner dismiss, room closed by server,
  // and the back-button confirm modal.
  useEffect(() => {
    if (!room) {
      void voice.leave();
    }
    // `voice.leave` is stable across renders (useCallback with no deps that change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  useRouteSync(() => setConfirmLeave(true));

  useEffect(() => {
    const store = useGame.getState();
    const sock = getSocket();

    // `connect` may have already fired before these listeners attach (StrictMode re-runs this effect) — seed from the live flag instead of waiting for an event that's gone.
    if (sock.connected) store.setConnection("CONNECTED");

    const detach = attachListeners({
      onState: (s) => useGame.getState().applyState(s),
      onEvent: (_e, seq) => {
        // §61.3 / §62.2: surface the reveal and the final result.
        if (_e.type === "DECLARATION_RESOLVED") useGame.getState().setReveal(_e.result);
        if (_e.type === "GAME_OVER") {
          useGame.getState().setGameOver({
            ...(_e.winningTeamId ? { winningTeamId: _e.winningTeamId } : {}),
            drawn: _e.drawn,
            scores: _e.teamScores,
          });
        }
        // §68.6: a gap means we missed a broadcast — replace state wholesale rather than applying an update to state we know is stale.
        if (useGame.getState().noteEvent(_e, seq)) {
          void api.resync().then((res) => {
            if ("ok" in res && res.ok) {
              useGame.getState().applyState(res.data, { hydrating: true });
            }
          });
        }
      },
      onChat: (m) => useGame.getState().addChat(m),
      onHostChanged: () => void 0,
      onVoiceParticipants: (ids) => useGame.getState().setVoiceParticipants(ids),
      onKicked: () => {
        void voice.leave();
        clearSession();
        useGame.getState().reset();
        useGame.getState().setError("You were removed from the room by the host.");
      },
      onClosed: () => {
        void voice.leave();
        clearSession();
        useGame.getState().reset();
        useGame.getState().setError("This room has closed.");
      },
      onConnect: () => {
        useGame.getState().setConnection("CONNECTED");

        // §35: every connect gets a brand-new server socket, so the seat must be re-bound each time or both broadcast paths silently skip this client.
        const saved = loadSession();
        if (!saved) return;

        void api
          .joinRoom(saved.roomId, saved.name, PROTOCOL_VERSION, saved.sessionToken)
          .then((res) => {
            const st = useGame.getState();
            if ("ok" in res && res.ok) {
              st.setName(saved.name);
              st.setIdentity(res.data.playerId);
              // §65.4: render settled, with entrance animation suppressed.
              st.applyState(res.data.state, { hydrating: true });
              return;
            }

            // Socket up but seat unbound — name the failure, don't look healthy.
            if ("error" in res && res.error === "TIMEOUT") {
              st.setConnection("RECONNECTING");
              return;
            }

            // §63: the room is gone — a restart or an expiry. Nothing to wait
            // on any more, so stop holding the loading screen up.
            clearSession();
            st.setConnection("SERVER_GONE");
            st.setScreen("HOME");
          });
      },
      onDisconnect: () => useGame.getState().setConnection("RECONNECTING"),
    });

    // Restore the name for the entry screen even without a live room.
    const saved = loadSession();
    if (saved && !store.name) store.setName(saved.name);

    return detach;
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {connection !== "CONNECTED" && <ConnectionBanner state={connection} />}
      {/* Exactly one region claims flex-1 — an empty sibling alongside the game left it holding half the viewport as dead space. */}
      {screen === "GAME" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <GameScreen />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {screen === "LOADING" && <LoadingScreen />}
          {screen === "HOME" && <GamesHub />}
          {screen === "LITERATURE_ROOM" && <LiteratureRoomScreen />}
          {screen === "NAME" && <NameScreen />}
          {screen === "LOBBY" && <LobbyScreen />}
        </div>
      )}

      {/* Rendered once here, not per-screen, so chat/voice survive the lobby-to-game transition (§28, §69). */}
      {room && myId && (
        <>
          <ChatDock chat={chat} myPlayerId={myId} />
          <VoiceDock
            voice={voice}
            available={room.voice.available}
            participants={voiceParticipants}
            players={room.players}
            spectators={room.spectators}
            myPlayerId={myId}
          />
        </>
      )}

      {confirmLeave && (
        <ConfirmLeaveModal
          isSpectator={isSpectator}
          onCancel={() => setConfirmLeave(false)}
          onLeave={() => {
            setConfirmLeave(false);
            void voice.leave();
            void api.leaveRoom();
            clearSession();
            useGame.getState().reset();
          }}
        />
      )}
    </div>
  );
}

// Shown while a stored session (§35) is being resumed — a reload or a fresh
// tab on a room link would otherwise flash the name-entry form first.
function LoadingScreen() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-[var(--text-muted)]">
      <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
      <p className="text-sm">Reconnecting…</p>
    </div>
  );
}

function ConfirmLeaveModal({
  isSpectator,
  onCancel,
  onLeave,
}: {
  isSpectator?: boolean;
  onCancel: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Leave room?"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-5">
        <h2 className="text-lg font-bold">Leave room?</h2>
        <p className="mt-1.5 text-sm text-[var(--text-muted)]">
          {isSpectator
            ? "You are currently spectating. Leaving will disconnect you from the room."
            : "That back tap would take you out of the room. You'll lose your seat and, if a game is running, your team plays on without you."}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[var(--border)] py-3 text-sm font-semibold"
          >
            Stay
          </button>
          <button
            onClick={onLeave}
            className="flex-1 rounded-xl bg-[var(--team-them)] py-3 text-sm font-bold text-white"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

function ConnectionBanner({ state }: { state: "CONNECTING" | "RECONNECTING" | "SERVER_GONE" }) {
  // §63: the server-gone state is terminal with an action, never a spinner.
  if (state === "SERVER_GONE") {
    return (
      <div className="bg-[var(--team-them)] px-4 py-2 text-center text-sm font-semibold text-white">
        The game server was restarted. This room is no longer available.
        <button
          className="ml-2 underline"
          onClick={() => {
            clearSession();
            const st = useGame.getState();
            st.reset();
            // `reset` leaves connection alone, so the banner would outlive the room.
            st.setConnection(getSocket().connected ? "CONNECTED" : "CONNECTING");
          }}
        >
          Create or join a new room
        </button>
      </div>
    );
  }
  return (
    <div className="bg-[var(--turn-banner)] px-4 py-1.5 text-center text-xs text-[var(--accent)]">
      {state === "CONNECTING" ? "Connecting…" : "Connection lost — reconnecting…"}
    </div>
  );
}
