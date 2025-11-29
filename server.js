
require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

mongoose.connect(process.env.MONGO_URI);

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  created: { type: Date, default: Date.now },
  lastLogin: Date
});

const User = mongoose.model("User", UserSchema);

const rooms = {};

io.on("connection", (socket) => {

  socket.on("register", async ({ username, password }, cb) => {
    try {
      const hashed = await bcrypt.hash(password, 10);
      const user = new User({ username, password: hashed });
      await user.save();
      cb({ ok: true });
    } catch (err) {
      cb({ ok: false, error: "User already exists" });
    }
  });

  socket.on("login", async ({ username, password }, cb) => {
    const user = await User.findOne({ username });
    if (!user) return cb({ ok: false });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return cb({ ok: false });

    socket.username = username;
    user.lastLogin = new Date();
    await user.save();

    cb({ ok: true, username });
  });

  socket.on("createRoom", () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[code] = {
      host: socket.id,
      players: {}
    };
    socket.join(code);
    rooms[code].players[socket.id] = { x: 0, y: 0, z: 0 };
    socket.emit("roomJoined", { code, host: true });
    io.to(code).emit("roomUpdate", rooms[code]);
  });

  socket.on("joinRoom", (code) => {
    if (!rooms[code]) return;
    socket.join(code);
    rooms[code].players[socket.id] = { x: 0, y: 0, z: 0 };
    socket.emit("roomJoined", { code, host: false });
    io.to(code).emit("roomUpdate", rooms[code]);
  });

  socket.on("startGame", (code) => {
    io.to(code).emit("gameStarted");
  });

  socket.on("move", ({ code, x, z }) => {
    if (rooms[code] && rooms[code].players[socket.id]) {
      rooms[code].players[socket.id].x = x;
      rooms[code].players[socket.id].z = z;
      io.to(code).emit("gameState", rooms[code].players);
    }
  });

  socket.on("disconnect", () => {
    for (let code in rooms) {
      delete rooms[code].players[socket.id];
      io.to(code).emit("roomUpdate", rooms[code]);
    }
  });
});

server.listen(process.env.PORT || 3000);
