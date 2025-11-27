
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));

const rooms = {};
const TICK = 30;
const PLAYER_SPEED = 240;
const BULLET_SPEED = 520;
const PLAYER_HP = 100;
const BULLET_DAMAGE = 25;
const ARENA = { width: 1200, height: 700 };

function randomPos() {
  return { x: 80 + Math.random() * (ARENA.width - 160), y: 80 + Math.random() * (ARENA.height - 160) };
}

function createRoom() {
  const code = Math.random().toString(36).substring(2, 7).toUpperCase();
  rooms[code] = { code, players: {}, bullets: [], hostId: null, status: "lobby" };
  return rooms[code];
}

io.on("connection", socket => {

  socket.on("createRoom", ({ name }, cb) => {
    const room = createRoom();
    const spawn = randomPos();
    room.players[socket.id] = { id: socket.id, name, x: spawn.x, y: spawn.y, hp: PLAYER_HP, score: 0, input: {} };
    room.hostId = socket.id;
    socket.join(room.code);
    cb({ ok: true, roomCode: room.code, playerId: socket.id, isHost: true, arena: ARENA });
    io.to(room.code).emit("lobbyUpdate", { players: Object.values(room.players), hostId: room.hostId });
  });

  socket.on("joinRoom", ({ name, roomCode }, cb) => {
    const room = rooms[roomCode];
    if (!room || room.status !== "lobby") return cb({ ok: false });
    const spawn = randomPos();
    room.players[socket.id] = { id: socket.id, name, x: spawn.x, y: spawn.y, hp: PLAYER_HP, score: 0, input: {} };
    socket.join(room.code);
    cb({ ok: true, roomCode: room.code, playerId: socket.id, isHost: false, arena: ARENA });
    io.to(room.code).emit("lobbyUpdate", { players: Object.values(room.players), hostId: room.hostId });
  });

  socket.on("startGame", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id) return;
    room.status = "running";
    room.bullets = [];
    Object.values(room.players).forEach(p => p.hp = PLAYER_HP);
    io.to(room.code).emit("gameStarted");
  });

  socket.on("playerInput", ({ roomCode, input }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].input = input;
  });

  socket.on("shoot", ({ roomCode, angle }) => {
    const room = rooms[roomCode];
    const p = room?.players[socket.id];
    if (!p) return;
    room.bullets.push({
      x: p.x + Math.cos(angle) * 20,
      y: p.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      owner: p.id
    });
  });

  socket.on("disconnect", () => {
    for (const code in rooms) {
      const room = rooms[code];
      delete room.players[socket.id];
      if (Object.keys(room.players).length === 0) delete rooms[code];
      else io.to(code).emit("lobbyUpdate", { players: Object.values(room.players), hostId: room.hostId });
    }
  });
});

setInterval(() => {
  for (const code in rooms) {
    const room = rooms[code];
    if (room.status !== "running") continue;

    for (const p of Object.values(room.players)) {
      const i = p.input || {};
      if (i.up) p.y -= PLAYER_SPEED / TICK;
      if (i.down) p.y += PLAYER_SPEED / TICK;
      if (i.left) p.x -= PLAYER_SPEED / TICK;
      if (i.right) p.x += PLAYER_SPEED / TICK;

      p.x = Math.max(20, Math.min(ARENA.width - 20, p.x));
      p.y = Math.max(20, Math.min(ARENA.height - 20, p.y));
    }

    room.bullets = room.bullets.filter(b => {
      b.x += b.vx / TICK;
      b.y += b.vy / TICK;

      for (const p of Object.values(room.players)) {
        if (p.id === b.owner || p.hp <= 0) continue;
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        if (dx * dx + dy * dy < 18 * 18) {
          p.hp -= BULLET_DAMAGE;
          if (p.hp <= 0) {
            p.hp = PLAYER_HP;
            const killer = Object.values(room.players).find(k => k.id === b.owner);
            if (killer) killer.score++;
            const respawn = randomPos();
            p.x = respawn.x;
            p.y = respawn.y;
          }
          return false;
        }
      }

      return b.x > 0 && b.y > 0 && b.x < ARENA.width && b.y < ARENA.height;
    });

    io.to(code).emit("gameState", {
      players: Object.values(room.players),
      bullets: room.bullets,
      arena: ARENA
    });
  }
}, 1000 / TICK);

server.listen(PORT, () => console.log("Rivals 2 (Roblox style) running on", PORT));
