// ===== Fixed server.js (no syntax errors, persistent sessions) =====
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

// ---- App / Server ----
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ---- Static Files ----
app.use(express.static("public"));

// ---- In‑Memory Stores (safe fallback if DB fails) ----
// If you already had a DB, you can swap these out later.
const users = {};      // username -> { passwordHash }
const sessions = {};   // token -> username

// ---- Socket Logic ----
io.on("connection", socket => {
  console.log("Client connected");

  // ===== REGISTER =====
  socket.on("register", async (data, cb) => {
    try {
      const { username, password } = data;
      if (!username || !password) {
        return cb({ ok: false, error: "Missing fields" });
      }

      if (users[username]) {
        return cb({ ok: false, error: "Username already exists" });
      }

      const hash = await bcrypt.hash(password, 10);
      users[username] = { passwordHash: hash };

      cb({ ok: true });
    } catch (err) {
      console.error("Register error:", err);
      cb({ ok: false, error: "Server error" });
    }
  });

  // ===== LOGIN =====
  socket.on("login", async (data, cb) => {
    try {
      const { username, password } = data;
      const user = users[username];

      if (!user) {
        return cb({ ok: false, error: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return cb({ ok: false, error: "Invalid credentials" });
      }

      const token = crypto.randomBytes(24).toString("hex");
      sessions[token] = username;
      socket.username = username;

      cb({ ok: true, username, token });
    } catch (err) {
      console.error("Login error:", err);
      cb({ ok: false, error: "Server error" });
    }
  });

  // ===== RESUME SESSION (PERSIST LOGIN AFTER REFRESH) =====
  socket.on("resumeSession", (token, cb) => {
    const username = sessions[token];
    if (!username) return cb({ ok: false });

    socket.username = username;
    cb({ ok: true, username });
  });

  // ===== DISCONNECT =====
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.username);
  });
});

// ---- Start Server ----
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
