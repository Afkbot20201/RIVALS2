
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
const { Resend } = require("resend");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const client = new MongoClient(process.env.MONGO_URI);
const resend = new Resend(process.env.RESEND_API_KEY);

let usersCollection;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db("rivals2");
    usersCollection = db.collection("users");
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Error:", err);
  }
}
connectDB();

app.use(express.json());
app.use(express.static("public"));

const sessions = {};

io.on("connection", socket => {
  console.log("User connected");

  socket.on("register", async (data, cb) => {
    try {
      const { username, password, email } = data;

      if (!username || !password)
        return cb({ ok: false, error: "Missing credentials" });

      const existing = await usersCollection.findOne({ username });
      if (existing)
        return cb({ ok: false, error: "Username already exists" });

      const hash = await bcrypt.hash(password, 10);

      await usersCollection.insertOne({
        username,
        password: hash,
        email,
        createdAt: new Date()
      });

      cb({ ok: true });
    } catch (err) {
      console.error(err);
      cb({ ok: false, error: "Registration failed" });
    }
  });

  socket.on("login", async (data, cb) => {
    try {
      const { username, password } = data;
      const user = await usersCollection.findOne({ username });

      if (!user) return cb({ ok: false, error: "User not found" });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return cb({ ok: false, error: "Wrong password" });

      const sessionToken = crypto.randomBytes(32).toString("hex");
      sessions[sessionToken] = username;

      cb({ ok: true, username, token: sessionToken });
    } catch (err) {
      console.error(err);
      cb({ ok: false, error: "Login failed" });
    }
  });

  socket.on("requestPasswordReset", async (data, cb) => {
    try {
      const { email } = data;
      if (!email) return cb({ ok: false });

      const user = await usersCollection.findOne({ email });
      if (!user) return cb({ ok: false });

      const token = crypto.randomBytes(32).toString("hex");
      const expiry = Date.now() + 1000 * 60 * 15;

      await usersCollection.updateOne(
        { email },
        { $set: { resetToken: token, resetExpiry: expiry } }
      );

      const resetLink = `${process.env.RENDER_EXTERNAL_URL || "http://localhost:10000"}/reset.html?token=${token}`;

      await resend.emails.send({
        from: "Rivals2 <no-reply@rivals2.dev>",
        to: email,
        subject: "Password Reset",
        html: `<p>Reset your password:</p><a href="${resetLink}">${resetLink}</a>`
      });

      cb({ ok: true });
    } catch (err) {
      console.error(err);
      cb({ ok: false });
    }
  });

  const rooms = {};

  socket.on("createRoom", (_, cb) => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    rooms[code] = [socket.id];
    socket.join(code);
    cb({ ok: true, roomCode: code });
    io.to(code).emit("roomUpdate", rooms[code]);
  });

  socket.on("joinRoom", (data, cb) => {
    const { roomCode } = data;
    if (!rooms[roomCode]) return cb({ ok: false });

    rooms[roomCode].push(socket.id);
    socket.join(roomCode);
    cb({ ok: true });
    io.to(roomCode).emit("roomUpdate", rooms[roomCode]);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () =>
  console.log("Rivals 2 server listening on", PORT)
);
