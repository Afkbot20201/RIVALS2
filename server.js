const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));
const PORT = process.env.PORT || 3000;

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_SPEED = 4;
const BULLET_SPEED = 10;
const BULLET_LIFETIME = 60;
const HIT_RADIUS = 20;
const rooms = {};

function createRoomCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoom(hostSocket, name) {
  let code;
  do { code = createRoomCode(); } while (rooms[code]);

  rooms[code] = {
    id: code,
    hostId: hostSocket.id,
    players: {},
    bullets: [],
    started: false
  };

  addPlayerToRoom(code, hostSocket, name);
  return rooms[code];
}

function addPlayerToRoom(roomCode, socket, name) {
  const room = rooms[roomCode];
  socket.join(roomCode);
  socket.data.roomCode = roomCode;

  room.players[socket.id] = {
    id: socket.id,
    name,
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
    vx: 0,
    vy: 0,
    hp: 3,
    score: 0
  };
}

io.on("connection", socket => {
  socket.on("createRoom", ({ name }) => {
    const room = createRoom(socket, name);
    socket.emit("roomCreated", { roomCode: room.id, room, isHost: true });
    io.to(room.id).emit("roomInfo", room);
  });

  socket.on("joinRoom", ({ roomCode, name }) => {
    const room = rooms[roomCode];
    if (!room) return socket.emit("joinError", { message: "Room not found" });
    addPlayerToRoom(roomCode, socket, name);
    socket.emit("joinedRoom", { roomCode, room, isHost: false });
    io.to(room.id).emit("roomInfo", room);
  });

  socket.on("startGame", () => {
    const room = rooms[socket.data.roomCode];
    if (room && room.hostId === socket.id) {
      room.started = true;
      io.to(room.id).emit("gameStarted");
    }
  });

  socket.on("move", ({ vx, vy }) => {
    const room = rooms[socket.data.roomCode];
    if (!room || !room.started) return;
    const p = room.players[socket.id];
    if (!p) return;
    p.vx = vx * PLAYER_SPEED;
    p.vy = vy * PLAYER_SPEED;
  });

  socket.on("shoot", ({ direction }) => {
    const room = rooms[socket.data.roomCode];
    if (!room || !room.started) return;
    const p = room.players[socket.id];
    if (!p) return;

    let vx = 0, vy = 0;
    if (direction === "up") vy = -BULLET_SPEED;
    if (direction === "down") vy = BULLET_SPEED;
    if (direction === "left") vx = -BULLET_SPEED;
    if (direction === "right") vx = BULLET_SPEED;

    room.bullets.push({
      x: p.x,
      y: p.y,
      vx,
      vy,
      life: 0,
      ownerId: socket.id
    });
  });
});

setInterval(() => {
  Object.values(rooms).forEach(room => {
    if (!room.started) return;

    Object.values(room.players).forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
    });

    room.bullets = room.bullets.filter(b => b.life++ < BULLET_LIFETIME);
    io.to(room.id).emit("state", room);
  });
}, 1000 / 30);

server.listen(PORT, () => console.log("Running on port", PORT));
