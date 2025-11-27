const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  email: { type: String, default: null },
  password: String,
  resetToken: String,
  resetTokenExpiry: Date,
  created: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);

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
      }
    }
  }
}

io.on("connection", socket => {

  socket.on("register", async ({ username, password, email }, cb) => {
    try {
      if (!username || !password) return cb({ ok:false, error:"Missing fields" });
      const exist = await User.findOne({ username });
      if (exist) return cb({ ok:false, error:"Username already taken" });
      const hash = await bcrypt.hash(password, 10);
      await User.create({ username, password: hash, email: email || null });
      cb({ ok:true });
    } catch (e) {
      console.error(e);
      cb({ ok:false });
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
    } catch (e) {
      console.error(e);
      cb({ ok:false });
    }
  });

  console.log("Client connected", socket.id);

  socket.on("createRoom", ({ name }, cb) => {
    if (!socket.username) return cb({ ok:false, error:"Not logged in" });
    const room = createRoom();
    const spawn = randomPos();

    room.players[socket.id] = {
      id: socket.id,
      name: socket.username,
      x: spawn.x,
      y: spawn.y,
      angle: 0,
      hp: PLAYER_MAX_HP,
      score: 0,
      input: { up:false, down:false, left:false, right:false }
    };

    room.hostId = socket.id;
    socket.join(room.code);
    cb({ ok:true, roomCode: room.code, playerId: socket.id, isHost:true });
  });

  socket.on("joinRoom", ({ roomCode }, cb) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return cb({ ok:false });

    const spawn = randomPos();
    room.players[socket.id] = {
      id: socket.id,
      name: socket.username,
      x: spawn.x,
      y: spawn.y,
      angle: 0,
      hp: PLAYER_MAX_HP,
      score: 0,
      input: { up:false, down:false, left:false, right:false }
    };

    socket.join(code);
    cb({ ok:true, playerId: socket.id, isHost:false });
  });

  socket.on("disconnect", () => removePlayer(socket.id));
});

server.listen(PORT, () => {
  console.log("Rivals 2 server listening on", PORT);
});
