/**
 * App shell. Spec §33, §63, §68.5.
 *
 * The connection banner distinguishes reconnecting from server-gone: a player
 * who cannot tell "slow" from "gone" waits forever for a room that no longer
 * exists (§63).
 */

import { useEffect } from "react";
import { PROTOCOL_VERSION } from "@memory-game/shared";
import { HomeScreen, NameScreen } from "./screens/NameAndHome.js";
import { LobbyScreen } from "./screens/Lobby.js";
import { GameScreen } from "./screens/Game.js";
import { api, attachListeners, getSocket } from "./socket/client.js";
import { clearSession, loadSession, useGame } from "./store/useGame.js";

export default function App() {
  const screen = useGame((s) => s.screen);
  const connection = useGame((s) => s.connection);

  useEffect(() => {
    const store = useGame.getState();
    const sock = getSocket();

    // socket.io connects on creation, so the `connect` event may already have
    // fired before these listeners attach (and StrictMode re-runs this effect).
    // Seed from the live flag instead of waiting for an event that is gone.
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
        // §68.6: a gap means we missed a broadcast — replace state wholesale
        // rather than applying an update to state we know is stale.
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
      onClosed: () => {
        clearSession();
        useGame.getState().reset();
        useGame.getState().setError("This room has closed.");
      },
      onConnect: () => {
        const st = useGame.getState();
        st.setConnection("CONNECTED");

        // §35: resume the seat if we have a token for it.
        const saved = loadSession();
        if (saved && !st.room) {
          void api
            .joinRoom(saved.roomId, saved.name, PROTOCOL_VERSION, saved.sessionToken)
            .then((res) => {
              if ("ok" in res && res.ok) {
                useGame.getState().setName(saved.name);
                useGame.getState().setIdentity(res.data.playerId);
                // §65.4: render settled, with entrance animation suppressed.
                useGame.getState().applyState(res.data.state, { hydrating: true });
              } else {
                clearSession();
              }
            });
        }
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
      {/* Exactly one region claims flex-1. Rendering an empty sibling alongside
          the game left it holding half the viewport as dead space. */}
      {screen === "GAME" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <GameScreen />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {screen === "NAME" && <NameScreen />}
          {screen === "HOME" && <HomeScreen />}
          {screen === "LOBBY" && <LobbyScreen />}
        </div>
      )}
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
            useGame.getState().reset();
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
