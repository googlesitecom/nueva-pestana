"use client";

/**
 * Capa de llamadas de voz/vídeo (WebRTC vía Trystero, sin servidor).
 *
 * - La señalización y los streams los gestiona el motor P2P (p2p.ts):
 *   addStream/onPeerStream negocian las conexiones WebRTC.
 * - El llamante empieza a emitir su stream cuando el primer participante
 *   acepta; el receptor emite nada más aceptar.
 * - Mantiene la misma interfaz visual que la versión con backend.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Volume2 } from "lucide-react";
import { useAxStore, type AxUser } from "@/lib/store";
import { p2p, subscribeP2P } from "@/lib/p2p";
import Avatar from "../avatar";
import { useToast } from "@/hooks/use-toast";

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
    }
    timerRef.current = null;
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

  const hasVideo = Boolean(stream?.getVideoTracks().some((t) => t.enabled));

  return (
    <div className="relative min-h-40 overflow-hidden rounded-2xl border border-white/10 bg-black/60">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full object-cover ${mirrored ? "scale-x-[-1]" : ""} ${
          hasVideo && !videoOff ? "" : "opacity-0"
        }`}
      />
      {(!hasVideo || videoOff) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `${color}22` }}>
            <Avatar displayName={label} color={color} size={56} />
          </span>
          {connecting && (
            <span className="flex items-center gap-1.5 text-xs text-white/50">
              <span className="axc-typing-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
              Conectando…
            </span>
          )}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
        <span className="truncate text-xs font-bold text-white">{label}</span>
        <span className="flex items-center gap-1.5">
          {audioOff && <MicOff className="h-3.5 w-3.5 text-red-400" />}
        </span>
      </div>
    </div>
  );
}

export default function CallLayer() {
  const {
    me,
    conversations,
    call,
    incomingCall,
    callPeerStates,
    callStreams,
    acceptIncomingCall,
    declineIncomingCall,
    cancelCall,
    leaveCall,
    endCallIfActive,
    setPeerState,
  } = useAxStore();
  const { toast } = useToast();
  const ringer = useRinger();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [now, setNow] = useState(Date.now());

  const localStreamRef = useRef<MediaStream | null>(null);
  const streamAddedRef = useRef(false);

  const conv = useMemo(
    () =>
      conversations.find(
        (c) => c.id === (call?.conversationId ?? incomingCall?.conversationId),
      ),
    [conversations, call, incomingCall],
  );

  const memberInfo = (id: string): AxUser | undefined =>
    conv?.members.find((m) => m.id === id);

  // Reloj de duración
  useEffect(() => {
    if (!call) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [call]);

  // Limpiar stream local al terminar la llamada
  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    streamAddedRef.current = false;
    setLocalStream(null);
    setMicOn(true);
    setCamOn(true);
  }, []);

  // Adquirir medios al entrar en llamada
  useEffect(() => {
    if (!call) {
      stopLocalMedia();
      return;
    }
    let cancelled = false;
    streamAddedRef.current = false;
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
        // El receptor emite nada más aceptar; el llamante espera al primer
        // "aceptado" (ver listener de eventos P2P más abajo)
        if (call.role === "callee" && !streamAddedRef.current) {
          streamAddedRef.current = true;
          p2p.addCallStream(call.conversationId, stream);
        }
      } catch {
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
     
  }, [call?.conversationId, call?.role]);

  // Eventos P2P de la llamada (streams y respuestas) + timbre
  useEffect(() => {
    const unsubscribe = subscribeP2P((e) => {
      const currentCall = useAxStore.getState().call;
      if (e.type === "call-accepted" && currentCall) {
        // El primer participante aceptó: el llamante empieza a emitir
        const stream = localStreamRef.current;
        if (stream && !streamAddedRef.current) {
          streamAddedRef.current = true;
          p2p.addCallStream(currentCall.conversationId, stream);
        }
      } else if (e.type === "call-declined" && currentCall) {
        toast({ description: `${e.user.displayName} rechazó la llamada.` });
      } else if (e.type === "call-ended") {
        if (currentCall?.conversationId === e.conversationId) {
          const info = conv?.members.find((m) => m.id === e.user.id);
          if (info) toast({ description: `${info.displayName} colgó la llamada.` });
        }
        endCallIfActive(e.conversationId);
      } else if (e.type === "call-toggle") {
        setPeerState(e.user.id, { audio: e.audio, video: e.video });
      } else if (e.type === "peer-offline") {
        const st = useAxStore.getState();
        if (st.call) {
          const info = st.conversations
            .find((c) => c.id === st.call?.conversationId)
            ?.members.find((m) => m.id === e.user.id);
          if (info) toast({ description: `${info.displayName} salió de la llamada.` });
          // En llamadas 1:1, si el otro se va, cerrar también
          const c = st.conversations.find((x) => x.id === st.call?.conversationId);
          if (c?.type === "dm") {
            useAxStore.setState({ call: null, callPeerStates: {}, callStreams: {} });
          }
        }
      }
    });
    return () => {
      unsubscribe();
    };
     
  }, [conv, toast, endCallIfActive, setPeerState]);

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
    if (call) p2p.sendCallToggle(call.conversationId, next, camOn);
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !camOn;
    for (const t of stream.getVideoTracks()) t.enabled = next;
    setCamOn(next);
    if (call) p2p.sendCallToggle(call.conversationId, micOn, next);
  };

  const hangup = () => {
    const stream = localStreamRef.current;
    if (stream && streamAddedRef.current && call) {
      p2p.removeCallStream(call.conversationId, stream);
    }
    stopLocalMedia();
    if (call?.status === "connecting" && call.role === "caller") {
      cancelCall();
    } else {
      leaveCall();
    }
  };

  const durationSec = call ? Math.max(0, Math.floor((now - call.startedAt) / 1000)) : 0;
  const remoteIds = Object.keys(callStreams);

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
                      stream={callStreams[rid]}
                      muted={false}
                      mirrored={false}
                      label={info?.displayName ?? "Participante"}
                      color={info?.avatarColor ?? "#fbbf24"}
                      audioOff={peerState?.audio === false}
                      videoOff={peerState?.video === false}
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
