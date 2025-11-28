const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = {};

io.on("connection", socket => {
  socket.on("register", ({ username, password }, cb) => {
    if (users[username]) return cb({ ok: false, error: "User exists" });
    users[username] = password;
    cb({ ok: true });
  });

  socket.on("login", ({ username, password }, cb) => {
    if (!users[username] || users[username] !== password)
      return cb({ ok: false, error: "Invalid login" });
    cb({ ok: true, username });
  });
});

app.use(express.static("public"));

server.listen(10000, () => console.log("Rivals 2 running on 10000"));
