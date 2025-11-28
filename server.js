
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const users = {};
const sessions = {};

io.on("connection", socket => {

  socket.on("register", async (data, cb) => {
    try {
      const { username, password } = data;
      if (!username || !password) return cb({ ok: false, error: "Missing fields" });
      if (users[username]) return cb({ ok: false, error: "Username already exists" });

      const hash = await bcrypt.hash(password, 10);
      users[username] = { passwordHash: hash };
      cb({ ok: true });
    } catch {
      cb({ ok: false, error: "Server error" });
    }
  });

  socket.on("login", async (data, cb) => {
    try {
      const { username, password } = data;
      const user = users[username];
      if (!user) return cb({ ok: false, error: "Invalid credentials" });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return cb({ ok: false, error: "Invalid credentials" });

      const token = crypto.randomBytes(24).toString("hex");
      sessions[token] = username;
      socket.username = username;
      cb({ ok: true, username, token });
    } catch {
      cb({ ok: false, error: "Server error" });
    }
  });

  socket.on("resumeSession", (token, cb) => {
    const username = sessions[token];
    if (!username) return cb({ ok: false });
    socket.username = username;
    cb({ ok: true, username });
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));
