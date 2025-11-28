const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcrypt");

// ===== MongoDB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  created: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);

// ===== Server =====
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));

// ===== Game Config =====
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

// ===== Socket.IO =====
io.on("connection", socket => {

  // --- Mongo Auth ---
  socket.on("register", async ({ username, password }, cb) => {
    try {
      if (!username || !password) return cb({ ok:false, error:"Missing fields" });

      const exist = await User.findOne({ username });
      if (exist) return cb({ ok:false, error:"Username already taken" });

      const hash = await bcrypt.hash(password, 10);
      await User.create({ username, password: hash });

      cb({ ok:true });
    } catch (err) {
      console.error(err);
      cb({ ok:false, error:"Server error" });
    }
  });

  socket.on("login", async ({ username, password }, cb) => {
    try {
      const user = await User.findOne({ username });
      if (!user) return cb({ ok:false, error:"Invalid login" });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return cb({ ok:false, error:"Invalid login" });

      socket.username = username;
      cb({ ok:true, username });
    } catch (err) {
      console.error(err);
      cb({ ok:false, error:"Server error" });
    }
  });

  console.log("Client connected", socket.id);

  socket.on("createRoom", ({ name }, cb) => {
    if (!socket.username) return cb({ ok:false, error:"Not logged in" });
    const room = createRoom();
    const spawn = randomPos();
    const player = {
      id: socket.id,
      name: socket.username,
      x: spawn.x,
      y: spawn.y,
      angle: 0,
      hp: PLAYER_MAX_HP,
      score: 0,
      input: { up:false, down:false, left:false, right:false }
    };
    room.players[socket.id] = player;
    room.hostId = socket.id;
    socket.join(room.code);

    cb({
      ok: true,
      roomCode: room.code,
      playerId: socket.id,
      isHost: true,
      arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT }
    });

    io.to(room.code).emit("lobbyUpdate", {
      players: Object.values(room.players),
      hostId: room.hostId
    });
  });

  socket.on("joinRoom", ({ roomCode }, cb) => {
    if (!socket.username) return cb({ ok:false, error:"Not logged in" });

    const code = (roomCode || "").trim().toUpperCase();
    const room = rooms[code];
    if (!room) return cb({ ok:false, error:"Room not found" });
    if (room.status !== "lobby") return cb({ ok:false, error:"Game already started" });

    const spawn = randomPos();
    const player = {
      id: socket.id,
      name: socket.username,
      x: spawn.x,
      y: spawn.y,
      angle: 0,
      hp: PLAYER_MAX_HP,
      score: 0,
      input: { up:false, down:false, left:false, right:false }
    };

    room.players[socket.id] = player;
    socket.join(code);

    cb({
      ok: true,
      roomCode: code,
      playerId: socket.id,
      isHost: socket.id === room.hostId,
      arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT }
    });

    io.to(code).emit("lobbyUpdate", {
      players: Object.values(room.players),
      hostId: room.hostId
    });
  });

  socket.on("startGame", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id) return;

    room.status = "running";
    room.bullets = [];
    room.lastBulletId = 0;

    for (const p of Object.values(room.players)) {
      const spawn = randomPos();
      p.x = spawn.x;
      p.y = spawn.y;
      p.hp = PLAYER_MAX_HP;
    }

    io.to(roomCode).emit("gameStarted");
  });

  socket.on("playerInput", ({ roomCode, input }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const p = room.players[socket.id];
    if (!p) return;
    p.input = input;
    if (typeof input.angle === "number") p.angle = input.angle;
  });

  socket.on("shoot", ({ roomCode, angle }) => {
    const room = rooms[roomCode];
    const p = room?.players[socket.id];
    if (!room || !p || room.status !== "running") return;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    room.bullets.push({
      id: ++room.lastBulletId,
      x: p.x + cos * (PLAYER_RADIUS + 8),
      y: p.y + sin * (PLAYER_RADIUS + 8),
      vx: cos * BULLET_SPEED,
      vy: sin * BULLET_SPEED,
      ownerId: p.id
    });
  });

  socket.on("disconnect", () => {
    removePlayer(socket.id);
  });
});

// ===== Game Loop =====
setInterval(() => {
  for (const room of Object.values(rooms)) {
    if (room.status !== "running") continue;

    for (const p of Object.values(room.players)) {
      const i = p.input || {};
      let dx = (i.right||0) - (i.left||0);
      let dy = (i.down||0) - (i.up||0);
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;

      p.x = clamp(p.x + dx * PLAYER_SPEED * DT, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
      p.y = clamp(p.y + dy * PLAYER_SPEED * DT, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);
    }

    const alive = [];
    for (const b of room.bullets) {
      b.x += b.vx * DT;
      b.y += b.vy * DT;

      let hit = false;
      for (const p of Object.values(room.players)) {
        if (p.id === b.ownerId || p.hp <= 0) continue;
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        if (dx*dx + dy*dy <= (PLAYER_RADIUS+BULLET_RADIUS)**2) {
          p.hp -= BULLET_DAMAGE;
          if (p.hp <= 0) {
            p.hp = PLAYER_MAX_HP;
            p.score++;
            Object.assign(p, randomPos());
          }
          hit = true;
          break;
        }
      }

      if (!hit) alive.push(b);
    }
    room.bullets = alive;

    io.to(room.code).emit("gameState", {
      players: Object.values(room.players),
      bullets: room.bullets,
      arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT }
    });
  }
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log("Rivals 2 server listening on", PORT);
});


// === FIXED SPAWN POSITIONS FOR ROUNDS ===
const FIXED_SPAWNS = [
  { x: 400, y: 100 },
  { x: 400, y: 500 }
];
