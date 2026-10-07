/**
 * Bot P2P para pruebas E2E de axcgames (mismo appId que la web).
 *
 * Se une al lobby con una identidad de prueba, escucha eventos de
 * amistad y responde automáticamente:
 *   - freq  -> facc (acepta solicitudes)
 *   - Al ser amigo, envía un mensaje al DM y (opcional) contesta llamadas.
 *
 * Uso: bun scripts/p2p-bot.mjs [--wait 30000]
 */
import { joinRoom } from "trystero/nostr";

const APP_ID = "axcgames-nueva-pestana-v1";
const LOBBY = "lobby";

const BOT = {
  id: "bot-amigobot-001",
  username: "amigobot",
  displayName: "Amigo Bot",
  avatarColor: "#10b981",
  bio: "bot de pruebas",
  createdAt: new Date().toISOString(),
};

const waitMs = Number(process.argv.find((a) => a.startsWith("--wait"))?.split("=")[1] ?? 30000);

const lobby = joinRoom({ appId: APP_ID }, LOBBY);

const idAct = lobby.makeAction("id");
const freqAct = lobby.makeAction("freq");
const faccAct = lobby.makeAction("facc");
const funfAct = lobby.makeAction("funf");

const friends = new Set();
const peerUsers = new Map(); // peerId -> user

lobby.onPeerJoin = (peerId) => {
  console.log(`[lobby] peer join ${peerId}`);
  void idAct.send(BOT, { target: peerId });
};

lobby.onPeerLeave = (peerId) => {
  console.log(`[lobby] peer leave ${peerId}`);
  const u = peerUsers.get(peerId);
  if (u) console.log(`  (era ${u.username})`);
  peerUsers.delete(peerId);
};

idAct.onMessage = (user, ctx) => {
  if (user.id === BOT.id) return;
  peerUsers.set(ctx.peerId, user);
  console.log(`[lobby] identidad: ${user.displayName} (@${user.username}) id=${user.id}`);
};

freqAct.onMessage = (d, ctx) => {
  if (d.to !== BOT.id) return;
  console.log(`[friend] solicitud de ${d.from.username} -> acepto`);
  friends.add(d.from.id);
  void faccAct.send({ from: BOT, to: d.from.id }, { target: ctx.peerId });
  // Crear sala DM y enviar un mensaje de bienvenida
  const dmId = `dm:${[d.from.id, BOT.id].sort().join(":")}`;
  const dmRoom = joinRoom({ appId: APP_ID }, dmId);
  const msgAct = dmRoom.makeAction("msg");
  dmRoom.onPeerJoin = (peerId) => {
    console.log(`[dm] peer join`);
    setTimeout(() => {
      const m = {
        id: crypto.randomUUID(),
        conversationId: dmId,
        senderId: BOT.id,
        content: "¡Hola! Soy amigobot, tu amigo de pruebas 🤖",
        type: "text",
        createdAt: new Date().toISOString(),
        sender: BOT,
      };
      void msgAct.send(m, { target: peerId });
      console.log("[dm] mensaje de bienvenida enviado");
    }, 1500);
  };
  msgAct.onMessage = (m) => {
    console.log(`[dm] mensaje recibido de ${m.sender.displayName}: ${m.content}`);
  };
};

faccAct.onMessage = (d) => {
  if (d.to !== BOT.id) return;
  console.log(`[friend] ${d.from.username} aceptó mi solicitud`);
  friends.add(d.from.id);
};

funfAct.onMessage = (d) => {
  if (d.from === BOT.id) return;
  console.log(`[friend] eliminado por ${d.from}`);
};

console.log(`Bot @${BOT.username} conectando al lobby (${APP_ID})…`);

const started = Date.now();
setInterval(() => {
  const peers = Object.keys(lobby.getPeers());
  console.log(`[status] t+${Math.round((Date.now() - started) / 1000)}s peers=${peers.length}`);
}, 5000);

setTimeout(() => {
  console.log("[exit] tiempo de espera agotado");
  process.exit(0);
}, waitMs);
