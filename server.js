
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

const TICK_RATE = 30;
const DT = 1 / TICK_RATE;

const ARENA_WIDTH = 1400;
const ARENA_HEIGHT = 800;
const PLAYER_SPEED = 260;
const BULLET_SPEED = 520;
const PLAYER_RADIUS = 18;
const BULLET_RADIUS = 5;
const PLAYER_MAX_HP = 100;
const BULLET_DAMAGE = 25;

function randomPos() {
  const margin = 80;
  return {
    x: margin + Math.random() * (ARENA_WIDTH - margin * 2),
    y: margin + Math.random() * (ARENA_HEIGHT - margin * 2)
  };
}

function createRoom() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 7).toUpperCase();
  } while (rooms[code]);
  rooms[code] = {
    code,
    hostId: null,
    status: "lobby",
    players: {},
    bullets: [],
    lastBulletId: 0
  };
  return rooms[code];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function removePlayer(socketId) {
  for (const code of Object.keys(rooms)) {
    const room = rooms[code];
    if (room.players[socketId]) {
      delete room.players[socketId];
      if (room.hostId === socketId) {
        const ids = Object.keys(room.players);
        room.hostId = ids.length ? ids[0] : null;
      }
      if (Object.keys(room.players).length === 0) {
        delete rooms[code];
      } else {
        io.to(code).emit("lobbyUpdate", {
          players: Object.values(room.players).map(p => ({
            id: p.id,
            name: p.name,
            score: p.score
          })),
          hostId: room.hostId
        });
      }
    }
  }
}

io.on("connection", socket => {
  console.log("Client connected", socket.id);

  socket.on("createRoom", ({ name }, cb) => {
    if (!name || !name.trim()) return cb && cb({ ok: false, error: "Name required" });
    const room = createRoom();
    const spawn = randomPos();
    const player = {
      id: socket.id,
      name: name.trim().slice(0, 20),
      x: spawn.x,
      y: spawn.y,
      angle: 0,
      hp: PLAYER_MAX_HP,
      score: 0,
      input: { up: false, down: false, left: false, right: false }
    };
    room.players[socket.id] = player;
    room.hostId = socket.id;
    socket.join(room.code);
    cb && cb({
      ok: true,
      roomCode: room.code,
      playerId: socket.id,
      isHost: true,
      arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT }
    });
    io.to(room.code).emit("lobbyUpdate", {
      players: Object.values(room.players).map(p => ({
        id: p.id,
        name: p.name,
        score: p.score
      })),
      hostId: room.hostId
    });
  });

  socket.on("joinRoom", ({ name, roomCode }, cb) => {
    const code = (roomCode || "").trim().toUpperCase();
    const room = rooms[code];
    if (!room) return cb && cb({ ok: false, error: "Room not found" });
    if (room.status !== "lobby") return cb && cb({ ok: false, error: "Game already started" });
    if (!name || !name.trim()) return cb && cb({ ok: false, error: "Name required" });

    const spawn = randomPos();
    const player = {
      id: socket.id,
      name: name.trim().slice(0, 20),
      x: spawn.x,
      y: spawn.y,
      angle: 0,
      hp: PLAYER_MAX_HP,
      score: 0,
      input: { up: false, down: false, left: false, right: false }
    };
    room.players[socket.id] = player;
    socket.join(room.code);
    cb && cb({
      ok: true,
      roomCode: room.code,
      playerId: socket.id,
      isHost: socket.id === room.hostId,
      arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT }
    });
    io.to(room.code).emit("lobbyUpdate", {
      players: Object.values(room.players).map(p => ({
        id: p.id,
        name: p.name,
        score: p.score
      })),
      hostId: room.hostId
    });
  });

  socket.on("startGame", ({ roomCode }) => {
    const code = (roomCode || "").trim().toUpperCase();
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    room.status = "running";
    room.bullets = [];
    room.lastBulletId = 0;
    for (const p of Object.values(room.players)) {
      const spawn = randomPos();
      p.x = spawn.x;
      p.y = spawn.y;
      p.hp = PLAYER_MAX_HP;
      p.score = p.score || 0;
      p.input = { up: false, down: false, left: false, right: false };
    }
    io.to(room.code).emit("gameStarted");
  });

  socket.on("playerInput", ({ roomCode, input }) => {
    const code = (roomCode || "").trim().toUpperCase();
    const room = rooms[code];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p) return;
    if (input && typeof input === "object") {
      p.input = {
        up: !!input.up,
        down: !!input.down,
        left: !!input.left,
        right: !!input.right
      };
      if (typeof input.angle === "number" && Number.isFinite(input.angle)) {
        p.angle = input.angle;
      }
    }
  });

  socket.on("shoot", ({ roomCode, angle }) => {
    const code = (roomCode || "").trim().toUpperCase();
    const room = rooms[code];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p || room.status !== "running") return;
    const a = typeof angle === "number" && Number.isFinite(angle) ? angle : p.angle;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const bullet = {
      id: ++room.lastBulletId,
      x: p.x + cos * (PLAYER_RADIUS + 8),
      y: p.y + sin * (PLAYER_RADIUS + 8),
      vx: cos * BULLET_SPEED,
      vy: sin * BULLET_SPEED,
      ownerId: p.id
    };
    room.bullets.push(bullet);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected", socket.id);
    removePlayer(socket.id);
  });
});

setInterval(() => {
  for (const code of Object.keys(rooms)) {
    const room = rooms[code];
    if (room.status !== "running") continue;

    // update players
    for (const p of Object.values(room.players)) {
      const i = p.input || {};
      let dx = 0, dy = 0;
      if (i.up) dy -= 1;
      if (i.down) dy += 1;
      if (i.left) dx -= 1;
      if (i.right) dx += 1;
      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= len;
        dy /= len;
      }
      p.x += dx * PLAYER_SPEED * DT;
      p.y += dy * PLAYER_SPEED * DT;
      p.x = clamp(p.x, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
      p.y = clamp(p.y, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);
    }

    // update bullets
    const alive = [];
    for (const b of room.bullets) {
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      if (
        b.x < -50 || b.x > ARENA_WIDTH + 50 ||
        b.y < -50 || b.y > ARENA_HEIGHT + 50
      ) {
        continue;
      }
      let hit = false;
      for (const p of Object.values(room.players)) {
        if (p.id === b.ownerId || p.hp <= 0) continue;
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const rr = PLAYER_RADIUS + BULLET_RADIUS;
        if (dx * dx + dy * dy <= rr * rr) {
          hit = true;
          p.hp -= BULLET_DAMAGE;
          if (p.hp <= 0) {
            p.hp = 0;
            const killer = room.players[b.ownerId];
            if (killer) killer.score = (killer.score || 0) + 1;
            // respawn
            const spawn = randomPos();
            p.x = spawn.x;
            p.y = spawn.y;
            p.hp = PLAYER_MAX_HP;
          }
          break;
        }
      }
      if (!hit) alive.push(b);
    }
    room.bullets = alive;

    const state = {
      players: Object.values(room.players).map(p => ({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        angle: p.angle,
        hp: p.hp,
        score: p.score || 0
      })),
      bullets: room.bullets.map(b => ({
        id: b.id,
        x: b.x,
        y: b.y
      })),
      arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT }
    };

    io.to(code).emit("gameState", state);
  }
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log("Rivals 2 server listening on", PORT);
});
