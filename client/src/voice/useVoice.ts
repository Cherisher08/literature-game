/**
 * Voice client. Spec §29, §69.
 *
 * Audio only. Joining is always an explicit user action — the microphone
 * permission prompt must follow a gesture, and iOS Safari is strict about it
 * (§69.3). Nothing here is load-bearing: if voice fails, is unconfigured, or is
 * simply switched off, the game plays exactly as before (§69.4).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
} from "livekit-client";
import { api } from "../socket/client.js";

export type VoiceStatus = "OFF" | "CONNECTING" | "ON" | "ERROR";

export interface VoiceApi {
  status: VoiceStatus;
  muted: boolean;
  /**
   * True when the browser is blocking remote audio until a user gesture.
   * Without handling this, you hear nothing while everything looks connected.
   */
  needsAudioUnlock: boolean;
  unlockAudio: () => Promise<void>;
  /** Player ids currently speaking, for the mic indicators (§29). */
  speaking: string[];
  error: string | null;
  join: () => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => Promise<void>;
}

export function useVoice(): VoiceApi {
  const roomRef = useRef<Room | null>(null);
  const audioRef = useRef<HTMLDivElement | null>(null);

  const [status, setStatus] = useState<VoiceStatus>("OFF");
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);

  // Remote audio elements need a home in the DOM to play.
  useEffect(() => {
    const host = document.createElement("div");
    host.style.display = "none";
    document.body.appendChild(host);
    audioRef.current = host;
    return () => {
      host.remove();
      audioRef.current = null;
    };
  }, []);

  const teardown = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) await room.disconnect();
    if (audioRef.current) audioRef.current.innerHTML = "";
    setSpeaking([]);
    setStatus("OFF");
    setNeedsAudioUnlock(false);
    void api.setVoiceState(false);
  }, []);

  // Leave cleanly if the component unmounts mid-call.
  useEffect(() => {
    return () => {
      void roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  const join = useCallback(async () => {
    if (roomRef.current || status === "CONNECTING") return;
    setError(null);
    setStatus("CONNECTING");

    const res = await api.voiceToken();
    if (!("ok" in res) || !res.ok) {
      setStatus("ERROR");
      setError(
        "error" in res && res.error === "VOICE_UNAVAILABLE"
          ? "Voice chat is not set up on this server."
          : "Could not start voice chat.",
      );
      return;
    }

    // Loaded on demand: the SDK is a large chunk and most sessions never join
    // voice, so it must not sit in the critical path of starting a game.
    const { ConnectionState, Room, RoomEvent, Track } = await import("livekit-client");

    const room = new Room({
      // §69.3: Opus DTX — silence costs almost nothing, which matters on the
      // weak connections §68.5 targets.
      publishDefaults: { dtx: true, red: true },
      adaptiveStream: true,
    });
    roomRef.current = room;

    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication) => {
        if (track.kind !== Track.Kind.Audio) return;
        const el = track.attach();
        audioRef.current?.appendChild(el);
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove());
      })
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        // Identity is the playerId (§69.3), so this maps straight onto the board.
        setSpeaking(speakers.map((s) => s.identity));
      })
      .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        setSpeaking((ids) => ids.filter((id) => id !== p.identity));
      })
      .on(RoomEvent.Disconnected, () => {
        void teardown();
      })
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Connected) setStatus("ON");
      })
      // Autoplay policy: remote audio can be blocked even though the connection
      // is healthy. Surface it so the player can tap once to enable sound.
      .on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setNeedsAudioUnlock(!room.canPlaybackAudio);
      });

    try {
      await room.connect(res.data.url, res.data.token);
      // Audio only — video is never published (§69.3).
      await room.localParticipant.setMicrophoneEnabled(true);

      // Joining was a click, so this normally succeeds immediately.
      try {
        await room.startAudio();
      } catch {
        setNeedsAudioUnlock(true);
      }
      setNeedsAudioUnlock(!room.canPlaybackAudio);

      setMuted(false);
      setStatus("ON");
      void api.setVoiceState(true);
    } catch (e) {
      roomRef.current = null;
      setStatus("ERROR");
      // The overwhelmingly common cause is a denied microphone permission.
      setError(
        e instanceof Error && /permission|denied|NotAllowed/i.test(e.message)
          ? "Microphone access was blocked. Allow it in your browser settings."
          : "Could not connect to voice chat.",
      );
    }
  }, [status, teardown]);

  const leave = useCallback(async () => {
    await teardown();
  }, [teardown]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }, [muted]);

  const unlockAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      setNeedsAudioUnlock(!room.canPlaybackAudio);
    } catch {
      setNeedsAudioUnlock(true);
    }
  }, []);

  return {
    status,
    muted,
    speaking,
    error,
    needsAudioUnlock,
    unlockAudio,
    join,
    leave,
    toggleMute,
  };
}
