
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
  lastLogin: Date
});

const User = mongoose.model("User", UserSchema);

const rooms = {};

io.on("connection", socket => {

  socket.on("register", async ({ username, password }, cb) => {
    try {
      const hash = await bcrypt.hash(password, 10);
      await User.create({ username, password: hash });
      cb({ ok: true });
    } catch {
      cb({ ok: false });
    }
  });

  socket.on("login", async ({ username, password }, cb) => {
    const user = await User.findOne({ username });
    if (!user) return cb({ ok: false });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return cb({ ok: false });

    user.lastLogin = new Date();
    await user.save();

    socket.username = username;
    cb({ ok: true, username });
  });

  socket.on("createRoom", cb => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[code] = { host: socket.id, players: {} };
    socket.join(code);
    rooms[code].players[socket.id] = { x: 0, z: 0 };
    cb(code);
  });

  socket.on("joinRoom", (code, cb) => {
    if (!rooms[code]) return cb(false);
    socket.join(code);
    rooms[code].players[socket.id] = { x: 0, z: 0 };
    cb(true);
  });

  socket.on("startGame", code => {
    io.to(code).emit("gameStarted");
  });

  socket.on("move", ({ code, x, z }) => {
    if (!rooms[code]) return;
    if (!rooms[code].players[socket.id]) return;
    rooms[code].players[socket.id] = { x, z };
    io.to(code).emit("gameState", rooms[code].players);
  });
});

server.listen(process.env.PORT || 3000);
