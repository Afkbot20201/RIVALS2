
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// --- Game state ---

const rooms = {};
const ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateRoomCode() {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

function createRoom() {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms[code]);
  rooms[code] = {
    code,
    hostId: null,
    status: "lobby", // lobby | running
    players: {},     // socketId -> player
    bullets: [],     // { id, x, y, vx, vy, ownerId }
    lastBulletId: 0
  };
  return rooms[code];
}

const TICK_RATE = 30;
const PLAYER_SPEED = 220; // units per second
const BULLET_SPEED = 420;
const PLAYER_RADIUS = 18;
const BULLET_RADIUS = 5;
const ARENA_WIDTH = 1200;
const ARENA_HEIGHT = 700;
const PLAYER_MAX_HP = 100;
const BULLET_DAMAGE = 25;

// --- Helpers ---

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randomSpawn() {
  const margin = 60;
  return {
    x: margin + Math.random() * (ARENA_WIDTH - margin * 2),
    y: margin + Math.random() * (ARENA_HEIGHT - margin * 2)
  };
}

function removePlayerFromRoom(socketId) {
  for (const code of Object.keys(rooms)) {
    const room = rooms[code];
    if (room.players[socketId]) {
      delete room.players[socketId];
      // reassign host if needed
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
            score: p.score,
            isHost: p.id === room.hostId
          }))
        });
      }
    }
  }
}

// --- Socket handlers ---

io.on("connection", socket => {
  console.log("Client connected", socket.id);

  socket.on("createRoom", ({ name }, cb) => {
    if (!name || typeof name !== "string" || !name.trim()) {
      return cb && cb({ ok: false, error: "Name is required." });
    }
    const room = createRoom();
    const spawn = randomSpawn();
    const player = {
      id: socket.id,
      name: name.trim().slice(0, 20),
      x: spawn.x,
      y: spawn.y,
      angle: 0,
      hp: PLAYER_MAX_HP,
      score: 0,
      input: { up: false, down: false, left: false, right: false },
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
        score: p.score,
        isHost: p.id === room.hostId
      }))
    });
  });

  socket.on("joinRoom", ({ name, roomCode }, cb) => {
    const code = (roomCode || "").toUpperCase().trim();
    const room = rooms[code];
    if (!room) {
      return cb && cb({ ok: false, error: "Room not found." });
    }
    if (room.status !== "lobby") {
      return cb && cb({ ok: false, error: "Game already started in this room." });
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return cb && cb({ ok: false, error: "Name is required." });
    }

    const spawn = randomSpawn();
    const player = {
      id: socket.id,
      name: name.trim().slice(0, 20),
      x: spawn.x,
      y: spawn.y,
      angle: 0,
      hp: PLAYER_MAX_HP,
      score: 0,
      input: { up: false, down: false, left: false, right: false },
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
        score: p.score,
        isHost: p.id === room.hostId
      }))
    });
  });

  socket.on("startGame", ({ roomCode }) => {
    const code = (roomCode || "").toUpperCase().trim();
    const room = rooms[code];
    if (!room) return;
    if (room.hostId !== socket.id) return;
    room.status = "running";

    for (const p of Object.values(room.players)) {
      const spawn = randomSpawn();
      p.x = spawn.x;
      p.y = spawn.y;
      p.hp = PLAYER_MAX_HP;
      p.score = 0;
    }
    room.bullets = [];
    room.lastBulletId = 0;

    io.to(room.code).emit("gameStarted");
  });

  socket.on("playerInput", ({ roomCode, input }) => {
    const code = (roomCode || "").toUpperCase().trim();
    const room = rooms[code];
    if (!room || room.status !== "running") return;
    const p = room.players[socket.id];
    if (!p) return;

    if (input && typeof input === "object") {
      const { up, down, left, right, angle } = input;
      p.input = {
        up: !!up,
        down: !!down,
        left: !!left,
        right: !!right
      };
      if (typeof angle === "number" && isFinite(angle)) {
        p.angle = angle;
      }
    }
  });

  socket.on("shoot", ({ roomCode, angle }) => {
    const code = (roomCode || "").toUpperCase().trim();
    const room = rooms[code];
    if (!room || room.status !== "running") return;
    const p = room.players[socket.id];
    if (!p) return;

    const a = typeof angle === "number" && isFinite(angle) ? angle : p.angle;
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    const bulletId = ++room.lastBulletId;
    const spawnDistance = PLAYER_RADIUS + 10;
    const bullet = {
      id: bulletId,
      x: p.x + cos * spawnDistance,
      y: p.y + sin * spawnDistance,
      vx: cos * BULLET_SPEED,
      vy: sin * BULLET_SPEED,
      ownerId: p.id
    };
    room.bullets.push(bullet);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected", socket.id);
    removePlayerFromRoom(socket.id);
  });
});

// --- Game loop ---

const dt = 1 / TICK_RATE;

setInterval(() => {
  const now = Date.now();
  for (const code of Object.keys(rooms)) {
    const room = rooms[code];
    if (room.status !== "running") continue;

    // Update players
    for (const p of Object.values(room.players)) {
      let dx = 0;
      let dy = 0;
      if (p.input.up) dy -= 1;
      if (p.input.down) dy += 1;
      if (p.input.left) dx -= 1;
      if (p.input.right) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= len;
        dy /= len;
      }

      p.x += dx * PLAYER_SPEED * dt;
      p.y += dy * PLAYER_SPEED * dt;

      p.x = clamp(p.x, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
      p.y = clamp(p.y, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);
    }

    // Update bullets
    const aliveBullets = [];
    for (const b of room.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < -50 || b.x > ARENA_WIDTH + 50 || b.y < -50 || b.y > ARENA_HEIGHT + 50) {
        continue;
      }

      let hit = false;
      for (const p of Object.values(room.players)) {
        if (p.id === b.ownerId || p.hp <= 0) continue;
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const distSq = dx * dx + dy * dy;
        const r = PLAYER_RADIUS + BULLET_RADIUS;
        if (distSq <= r * r) {
          hit = true;
          p.hp -= BULLET_DAMAGE;
          if (p.hp <= 0) {
            p.hp = 0;
            const killer = room.players[b.ownerId];
            if (killer) {
              killer.score += 1;
            }
            const spawn = randomSpawn();
            p.x = spawn.x;
            p.y = spawn.y;
            p.hp = PLAYER_MAX_HP;
          }
          break;
        }
      }
      if (!hit) aliveBullets.push(b);
    }
    room.bullets = aliveBullets;

    // Broadcast state
    const state = {
      players: Object.values(room.players).map(p => ({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        angle: p.angle,
        hp: p.hp,
        score: p.score
      })),
      bullets: room.bullets.map(b => ({
        id: b.id,
        x: b.x,
        y: b.y
      })),
      arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT },
      serverTime: now
    };

    io.to(code).emit("gameState", state);
  }
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
