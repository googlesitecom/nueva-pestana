"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { useAxStore, type AxUser } from "@/lib/store";
import { getSocket } from "@/lib/socket";
import Avatar from "../avatar";
import { useToast } from "@/hooks/use-toast";

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/** Timbre de llamada con WebAudio (best effort) */
function useRinger() {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  const beep = useCallback((delay: number, freq: number) => {
    try {
      if (!ctxRef.current) {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        ctxRef.current = new AC();
      }
      const ctx = ctxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") void ctx.resume();
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    } catch {
      /* sin audio disponible */
    }
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stop();
    const pattern = () => {
      beep(0, 754);
      beep(0.28, 754);
    };
    pattern();
    timerRef.current = window.setInterval(pattern, 2200);
  }, [beep, stop]);

  useEffect(() => stop, [stop]);

  return { start, stop };
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function VideoTile({
  stream,
  muted,
  mirrored,
  label,
  color,
  audioOff,
  videoOff,
  connecting,
}: {
  stream: MediaStream | null;
  muted: boolean;
  mirrored: boolean;
  label: string;
  color: string;
  audioOff?: boolean;
  videoOff?: boolean;
  connecting?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current && stream && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream ? stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live") : false;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group relative aspect-video min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full object-cover ${mirrored ? "scale-x-[-1]" : ""} ${
          hasVideo ? "" : "hidden"
        }`}
      />
      {(!hasVideo || connecting) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          {connecting ? (
            <Avatar displayName={label} color={color} size={64} />
          ) : (
            <Avatar displayName={label} color={color} size={64} />
          )}
          <p className="text-xs font-semibold text-white/60">
            {connecting ? "Conectando…" : videoOff ? "Cámara desactivada" : "Sin vídeo"}
          </p>
        </div>
      )}
      {/* Etiqueta */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8">
        <span className="truncate text-xs font-bold text-white drop-shadow">{label}</span>
        {audioOff && <MicOff className="h-3.5 w-3.5 shrink-0 text-red-400" />}
      </div>
    </motion.div>
  );
}

export default function CallLayer() {
  const {
    me,
    call,
    incomingCall,
    conversations,
    callPeerStates,
    acceptIncomingCall,
    declineIncomingCall,
    cancelCall,
    leaveCall,
    endCallIfActive,
    setCallStatus,
    setPeerState,
  } = useAxStore();
  const { toast } = useToast();
  const ringer = useRinger();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteIds, setRemoteIds] = useState<string[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [now, setNow] = useState(Date.now());

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const conv = useMemo(
    () => conversations.find((c) => c.id === (call?.conversationId ?? incomingCall?.conversationId)),
    [conversations, call, incomingCall]
  );

  const memberInfo = (id: string): AxUser | undefined =>
    conv?.members.find((m) => m.id === id);

  // Reloj de duración
  useEffect(() => {
    if (!call) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [call]);

  const cleanupMedia = useCallback(() => {
    for (const pc of pcsRef.current.values()) {
      try {
        pc.close();
      } catch {
        /* noop */
      }
    }
    pcsRef.current.clear();
    pendingIceRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStreams({});
    setRemoteIds([]);
    setMicOn(true);
    setCamOn(true);
  }, []);

  // Adquirir medios al entrar en llamada
  useEffect(() => {
    if (!call) {
      cleanupMedia();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video:
            call.type === "video"
              ? { width: { ideal: 1280 }, height: { ideal: 720 } }
              : false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch {
        // Sin micrófono/cámara: modo solo escucha con transceivers recvonly
        if (!cancelled) {
          localStreamRef.current = null;
          setLocalStream(null);
          toast({
            description:
              "Sin acceso a micrófono/cámara. Entrarás en modo solo escucha.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [call?.conversationId]);

  const createPeer = useCallback(
    async (remoteId: string, initiator: boolean, conversationId: string, video: boolean) => {
      const socket = getSocket();
      if (!socket || pcsRef.current.has(remoteId)) return;

      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcsRef.current.set(remoteId, pc);
      setRemoteIds((prev) => (prev.includes(remoteId) ? prev : [...prev, remoteId]));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("call:ice", { conversationId, targetUserId: remoteId, candidate: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        if (e.streams[0]) {
          setRemoteStreams((prev) => ({ ...prev, [remoteId]: e.streams[0] }));
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setCallStatus("active");
        }
      };

      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
        }
      } else {
        pc.addTransceiver("audio", { direction: "recvonly" });
        if (video) pc.addTransceiver("video", { direction: "recvonly" });
      }

      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:offer", {
          conversationId,
          targetUserId: remoteId,
          sdp: pc.localDescription,
        });
      }
    },
    [setCallStatus]
  );

  const flushIce = useCallback(async (userId: string) => {
    const pc = pcsRef.current.get(userId);
    if (!pc || !pc.remoteDescription) return;
    const queue = pendingIceRef.current.get(userId) ?? [];
    pendingIceRef.current.set(userId, []);
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* candidato obsoleto */
      }
    }
  }, []);

  // Listeners de señalización
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !me) return;

    const onIncoming = (data: { conversationId: string; type: "audio" | "video"; from: AxUser }) => {
      const state = useAxStore.getState();
      if (state.call) {
        // Ocupado: rechazar automáticamente
        socket.emit("call:decline", { conversationId: data.conversationId });
        return;
      }
      if (state.incomingCall?.conversationId === data.conversationId) return;
      useAxStore.setState({ incomingCall: data });
      ringer.start();
    };

    const onPeerJoined = (data: { conversationId: string; userId: string }) => {
      const state = useAxStore.getState();
      if (state.call?.conversationId !== data.conversationId) return;
      void createPeer(data.userId, true, data.conversationId, state.call.type === "video");
    };

    const onAccepted = (data: { conversationId: string; participantIds: string[] }) => {
      const state = useAxStore.getState();
      if (state.call?.conversationId !== data.conversationId) return;
      // Los participantes existentes nos ofrecerán conexión; solo registramos
      setRemoteIds((prev) => {
        const next = [...prev];
        for (const id of data.participantIds) {
          if (!next.includes(id)) next.push(id);
        }
        return next;
      });
    };

    const onOffer = async (data: {
      conversationId: string;
      fromUserId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      const state = useAxStore.getState();
      if (state.call?.conversationId !== data.conversationId) return;
      let pc = pcsRef.current.get(data.fromUserId);
      if (!pc) {
        await createPeer(
          data.fromUserId,
          false,
          data.conversationId,
          state.call.type === "video"
        );
        pc = pcsRef.current.get(data.fromUserId);
      }
      if (!pc) return;
      try {
        await pc.setRemoteDescription(data.sdp);
        await flushIce(data.fromUserId);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call:answer", {
          conversationId: data.conversationId,
          targetUserId: data.fromUserId,
          sdp: pc.localDescription,
        });
      } catch (e) {
        console.error("offer handling error", e);
      }
    };

    const onAnswer = async (data: {
      conversationId: string;
      fromUserId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      const pc = pcsRef.current.get(data.fromUserId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(data.sdp);
        await flushIce(data.fromUserId);
      } catch (e) {
        console.error("answer handling error", e);
      }
    };

    const onIce = (data: { conversationId: string; fromUserId: string; candidate: RTCIceCandidateInit }) => {
      const state = useAxStore.getState();
      if (state.call?.conversationId !== data.conversationId) return;
      const pc = pcsRef.current.get(data.fromUserId);
      if (pc && pc.remoteDescription) {
        void pc.addIceCandidate(data.candidate).catch(() => undefined);
      } else {
        const q = pendingIceRef.current.get(data.fromUserId) ?? [];
        q.push(data.candidate);
        pendingIceRef.current.set(data.fromUserId, q);
      }
    };

    const onPeerLeft = (data: { conversationId: string; userId: string }) => {
      const state = useAxStore.getState();
      if (state.call?.conversationId !== data.conversationId) return;
      const pc = pcsRef.current.get(data.userId);
      if (pc) {
        try {
          pc.close();
        } catch {
          /* noop */
        }
        pcsRef.current.delete(data.userId);
      }
      pendingIceRef.current.delete(data.userId);
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[data.userId];
        return next;
      });
      setRemoteIds((prev) => prev.filter((id) => id !== data.userId));
      const conv = state.conversations.find((c) => c.id === data.conversationId);
      const info = conv?.members.find((m) => m.id === data.userId);
      if (info) {
        toast({ description: `${info.displayName} salió de la llamada.` });
      }
      // En llamadas 1:1, si el otro cuelga, cerrar también la nuestra
      if (conv?.type === "dm") {
        useAxStore.setState({ call: null, callPeerStates: {} });
        // El servidor terminará la llamada y generará el mensaje del sistema
        const socket = getSocket();
        socket?.emit("call:leave", { conversationId: data.conversationId });
      }
    };

    const onEnded = (data: { conversationId: string }) => {
      endCallIfActive(data.conversationId);
    };

    const onDeclined = (data: { conversationId: string; userId: string; displayName: string }) => {
      const state = useAxStore.getState();
      if (state.call?.conversationId !== data.conversationId) return;
      toast({ description: `${data.displayName} rechazó la llamada.` });
    };

    const onPeerState = (data: { conversationId: string; userId: string; audio?: boolean; video?: boolean }) => {
      const state = useAxStore.getState();
      if (state.call?.conversationId !== data.conversationId) return;
      setPeerState(data.userId, { audio: data.audio, video: data.video });
    };

    const onBusy = (data: { conversationId: string }) => {
      const state = useAxStore.getState();
      if (state.call?.conversationId === data.conversationId) {
        toast({ description: "Ya hay una llamada en curso en este chat." });
        useAxStore.setState({ call: null });
      }
    };

    socket.off("call:incoming", onIncoming);
    socket.on("call:incoming", onIncoming);
    socket.off("call:peer-joined", onPeerJoined);
    socket.on("call:peer-joined", onPeerJoined);
    socket.off("call:accepted", onAccepted);
    socket.on("call:accepted", onAccepted);
    socket.off("call:offer", onOffer);
    socket.on("call:offer", onOffer);
    socket.off("call:answer", onAnswer);
    socket.on("call:answer", onAnswer);
    socket.off("call:ice", onIce);
    socket.on("call:ice", onIce);
    socket.off("call:peer-left", onPeerLeft);
    socket.on("call:peer-left", onPeerLeft);
    socket.off("call:ended", onEnded);
    socket.on("call:ended", onEnded);
    socket.off("call:declined", onDeclined);
    socket.on("call:declined", onDeclined);
    socket.off("call:peer-state", onPeerState);
    socket.on("call:peer-state", onPeerState);
    socket.off("call:busy", onBusy);
    socket.on("call:busy", onBusy);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:peer-joined", onPeerJoined);
      socket.off("call:accepted", onAccepted);
      socket.off("call:offer", onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice", onIce);
      socket.off("call:peer-left", onPeerLeft);
      socket.off("call:ended", onEnded);
      socket.off("call:declined", onDeclined);
      socket.off("call:peer-state", onPeerState);
      socket.off("call:busy", onBusy);
    };
  }, [me?.id, createPeer, flushIce, endCallIfActive, setPeerState, toast, ringer]);

  // Referencia de info de miembros accesible desde los handlers
  // (los handlers consultan el store directamente)

  // Timbre mientras hay llamada entrante
  useEffect(() => {
    if (incomingCall) {
      ringer.start();
    } else {
      ringer.stop();
    }
  }, [incomingCall, ringer]);

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micOn;
    for (const t of stream.getAudioTracks()) t.enabled = next;
    setMicOn(next);
    const socket = getSocket();
    if (socket && call) {
      socket.emit("call:toggle", { conversationId: call.conversationId, audio: next });
    }
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !camOn;
    for (const t of stream.getVideoTracks()) t.enabled = next;
    setCamOn(next);
    const socket = getSocket();
    if (socket && call) {
      socket.emit("call:toggle", { conversationId: call.conversationId, video: next });
    }
  };

  const hangup = () => {
    if (call?.status === "connecting" && call.role === "caller") {
      cancelCall();
    } else {
      leaveCall();
    }
  };

  const durationSec = call ? Math.max(0, Math.floor((now - call.startedAt) / 1000)) : 0;

  return (
    <>
      {/* Llamada entrante */}
      <AnimatePresence>
        {incomingCall && !call && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950/95 p-8 text-center shadow-2xl shadow-black"
            >
              <div className="axc-ring-pulse mx-auto w-fit rounded-full">
                <Avatar
                  displayName={incomingCall.from.displayName}
                  color={incomingCall.from.avatarColor}
                  size={88}
                />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold tracking-wide text-white">
                {incomingCall.from.displayName}
              </h3>
              <p className="mt-1 flex items-center justify-center gap-2 text-sm text-white/50">
                {incomingCall.type === "video" ? (
                  <Video className="h-4 w-4 text-amber-400" />
                ) : (
                  <Phone className="h-4 w-4 text-amber-400" />
                )}
                {incomingCall.type === "video" ? "Videollamada entrante" : "Llamada entrante"}…
              </p>

              <div className="mt-8 flex items-center justify-center gap-6">
                <motion.button
                  type="button"
                  onClick={declineIncomingCall}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Rechazar llamada"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-xl shadow-red-500/30 transition hover:bg-red-400"
                >
                  <PhoneOff className="h-6 w-6" />
                </motion.button>
                <motion.button
                  type="button"
                  onClick={acceptIncomingCall}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Aceptar llamada"
                  animate={{ rotate: [0, -8, 8, -8, 8, 0] }}
                  transition={{ delay: 1.2, duration: 0.5, repeat: Infinity, repeatDelay: 1.4 }}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/30 transition hover:bg-emerald-400"
                >
                  {incomingCall.type === "video" ? (
                    <Video className="h-6 w-6" />
                  ) : (
                    <Phone className="h-6 w-6" />
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Llamada activa */}
      <AnimatePresence>
        {call && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[75] flex flex-col bg-[#050505]/97 backdrop-blur-xl"
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <Volume2 className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="font-display text-sm font-bold tracking-wide text-white">
                    {(conv
                      ? conv.type === "group"
                        ? conv.name ?? "Grupo"
                        : conv.members.find((m) => m.id !== me?.id)?.displayName
                      : "Llamada")?.toUpperCase()}
                  </p>
                  <p className="text-xs text-white/45">
                    {call.status === "connecting"
                      ? call.role === "caller"
                        ? "Llamando…"
                        : "Conectando…"
                      : formatDuration(durationSec)}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                  call.status === "active"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                    : "border-amber-400/40 bg-amber-400/10 text-amber-300"
                }`}
              >
                {call.type === "video" ? "Vídeo" : "Voz"} ·{" "}
                {call.status === "active" ? "En curso" : "Conectando"}
              </span>
            </div>

            {/* Rejilla de vídeos */}
            <div className="flex min-h-0 flex-1 items-center justify-center px-4 sm:px-8">
              <div
                className={`grid h-full w-full max-w-6xl gap-3 ${
                  remoteIds.length === 0
                    ? "grid-cols-1"
                    : remoteIds.length === 1
                      ? "grid-cols-1 sm:grid-cols-2"
                      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                } place-content-center`}
                style={{ gridAutoRows: "minmax(0, 1fr)", maxHeight: "100%" }}
              >
                <VideoTile
                  stream={localStream}
                  muted
                  mirrored
                  label="Tú"
                  color={me?.avatarColor ?? "#fbbf24"}
                  audioOff={!micOn}
                  videoOff={!camOn}
                />
                {remoteIds.map((rid) => {
                  const info = memberInfo(rid);
                  const peerState = callPeerStates[rid];
                  return (
                    <VideoTile
                      key={rid}
                      stream={remoteStreams[rid] ?? null}
                      muted={false}
                      mirrored={false}
                      label={info?.displayName ?? "Participante"}
                      color={info?.avatarColor ?? "#fbbf24"}
                      audioOff={peerState?.audio === false}
                      videoOff={peerState?.video === false}
                      connecting={!remoteStreams[rid]}
                    />
                  );
                })}
              </div>
            </div>

            {/* Controles */}
            <div className="flex items-center justify-center gap-3 px-5 py-6">
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={toggleMic}
                disabled={!localStream}
                aria-label={micOn ? "Silenciar micrófono" : "Activar micrófono"}
                className={`flex h-13 w-13 items-center justify-center rounded-full border p-3.5 transition disabled:opacity-40 ${
                  micOn
                    ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
                    : "border-red-400/50 bg-red-500/20 text-red-400"
                }`}
              >
                {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </motion.button>

              {call.type === "video" && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleCam}
                  disabled={!localStream}
                  aria-label={camOn ? "Apagar cámara" : "Encender cámara"}
                  className={`flex h-13 w-13 items-center justify-center rounded-full border p-3.5 transition disabled:opacity-40 ${
                    camOn
                      ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
                      : "border-red-400/50 bg-red-500/20 text-red-400"
                  }`}
                >
                  {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </motion.button>
              )}

              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={hangup}
                aria-label="Colgar llamada"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-xl shadow-red-500/30 transition hover:bg-red-400"
              >
                <PhoneOff className="h-6 w-6" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
