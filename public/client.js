
(() => {
  const socket = io();

  const loginUser = document.getElementById("loginUser");
  const loginPass = document.getElementById("loginPass");
  const regUser = document.getElementById("regUser");
  const regPass = document.getElementById("regPass");
  const regPass2 = document.getElementById("regPass2");
  const rememberMe = document.getElementById("rememberMe");

  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const authError = document.getElementById("authError");

  const lobbyPanel = document.getElementById("lobby-panel");
  const gamePanel = document.getElementById("game-panel");

  const playerNameInput = document.getElementById("playerName");
  const roomCodeInput = document.getElementById("roomCode");
  const createRoomBtn = document.getElementById("createRoomBtn");
  const joinRoomBtn = document.getElementById("joinRoomBtn");
  const startGameBtn = document.getElementById("startGameBtn");
  const lobbyErrorEl = document.getElementById("lobbyError");
  const roomMetaEl = document.getElementById("roomMeta");
  const playersListEl = document.getElementById("playersList");
  const roomCodeLabel = document.getElementById("roomCodeLabel");
  const hpBarFill = document.getElementById("hpBarFill");
  const scoreLabel = document.getElementById("scoreLabel");
  const leaveGameBtn = document.getElementById("leaveGameBtn");
  const gameOverlay = document.getElementById("gameOverlay");
  const scoreboardList = document.getElementById("scoreboardList");

  const taskPlayFill = document.getElementById("task-play-fill");
  const taskPlayText = document.getElementById("task-play-text");
  const taskElimFill = document.getElementById("task-elim-fill");
  const taskElimText = document.getElementById("task-elim-text");
  const taskWinFill = document.getElementById("task-win-fill");
  const taskWinText = document.getElementById("task-win-text");

  const gameCanvas = document.getElementById("gameCanvas");
  const ctx = gameCanvas.getContext("2d");

  let currentRoomCode = null;
  let currentUsername = null;
  let currentPlayerId = null;
  let isHost = false;
  let arena = { width: 1400, height: 800 };
  let gameState = null;

  const keys = { w: false, a: false, s: false, d: false };
  let mouseWorld = { x: 0, y: 0 };
  let mouseDown = false;
  let lastShootTime = 0;
  const SHOOT_COOLDOWN = 200;

  function setAuthError(msg) {
    if (!msg) {
      authError.classList.add("hidden");
      authError.textContent = "";
    } else {
      authError.classList.remove("hidden");
      authError.textContent = msg;
    }
  }

  const logoutBtn = document.getElementById("logoutBtn");

  document.querySelectorAll(".auth-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".auth-tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".auth-tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab + "Tab").classList.add("active");
      setAuthError("");
    });
  });

  const savedToken = localStorage.getItem("sessionToken");
  if (savedToken) {
    socket.emit("resumeSession", savedToken, res => {
      if (res.ok) afterLogin(res.username);
      else localStorage.removeItem("sessionToken");
    });
  }

  function afterLogin(username) {
    currentUsername = username;
    playerNameInput.value = username;
    playerNameInput.disabled = true;
    document.getElementById("auth-panel").style.display = "none";
    logoutBtn.classList.remove("hidden");
  }

  loginBtn.addEventListener("click", () => {
    socket.emit("login", {
      username: loginUser.value.trim(),
      password: loginPass.value
    }, res => {
      if (!res.ok) {
        setAuthError(res.error);
        return;
      }
      setAuthError("");
      if (rememberMe.checked) {
        localStorage.setItem("sessionToken", res.token);
      }
      afterLogin(res.username);
    });
  });

  registerBtn.addEventListener("click", () => {
    if (regPass.value !== regPass2.value) {
      setAuthError("Passwords do not match.");
      return;
    }

    socket.emit("register", {
      username: regUser.value.trim(),
      password: regPass.value
    }, res => {
      if (!res.ok) {
        setAuthError(res.error);
        return;
      }
      setAuthError("Registered! You can now log in.");
    });
  });

  logoutBtn.addEventListener("click", () => {
    const token = localStorage.getItem("sessionToken");
    socket.emit("logout", token);
    localStorage.removeItem("sessionToken");
    location.reload();
  });

  // --- Rest of original game logic left untouched ---

  window.addEventListener("keydown", e => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "w") keys.w = true;
    if (k === "a") keys.a = true;
    if (k === "s") keys.s = true;
    if (k === "d") keys.d = true;
  });
  window.addEventListener("keyup", e => {
    const k = e.key.toLowerCase();
    if (k === "w") keys.w = false;
    if (k === "a") keys.a = false;
    if (k === "s") keys.s = false;
    if (k === "d") keys.d = false;
  });

  function worldToScreen(x, y) {
    return {
      x: (x / arena.width) * gameCanvas.width,
      y: (y / arena.height) * gameCanvas.height
    };
  }

  function screenToWorld(x, y) {
    return {
      x: (x / gameCanvas.width) * arena.width,
      y: (y / gameCanvas.height) * arena.height
    };
  }

  function sendInput() {
    if (!currentRoomCode || !currentPlayerId) return;
    const me = gameState?.players?.find(p => p.id === currentPlayerId);
    let angle = 0;
    if (me) {
      angle = Math.atan2(mouseWorld.y - me.y, mouseWorld.x - me.x);
    }
    socket.emit("playerInput", {
      roomCode: currentRoomCode,
      input: {
        up: keys.w,
        down: keys.s,
        left: keys.a,
        right: keys.d,
        angle
      }
    });
  }

  function tryShoot() {
    if (!mouseDown) return;
    if (!currentRoomCode || !currentPlayerId) return;
    const now = performance.now();
    if (now - lastShootTime < SHOOT_COOLDOWN) return;
    lastShootTime = now;
    const me = gameState?.players?.find(p => p.id === currentPlayerId);
    if (!me) return;
    const angle = Math.atan2(mouseWorld.y - me.y, mouseWorld.x - me.x);
    socket.emit("shoot", { roomCode: currentRoomCode, angle });
  }

  function resizeCanvas() {
    const rect = gameCanvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    gameCanvas.width = rect.width * dpr;
    gameCanvas.height = rect.height * dpr;
    gameCanvas.style.width = rect.width + "px";
    gameCanvas.style.height = rect.height + "px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  window.addEventListener("resize", resizeCanvas);

  gameCanvas.addEventListener("mousemove", e => {
    const rect = gameCanvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    mouseWorld = screenToWorld(sx, sy);
    sendInput();
  });

  gameCanvas.addEventListener("mousedown", e => {
    mouseDown = true;
    const rect = gameCanvas.getBoundingClientRect();
    mouseWorld = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    sendInput();
    tryShoot();
  });

  window.addEventListener("mouseup", () => {
    mouseDown = false;
  });

  setInterval(() => {
    sendInput();
    tryShoot();
  }, 40);

  function draw() {
    requestAnimationFrame(draw);
    if (!gameState) return;
    const { width, height } = gameCanvas;

    ctx.clearRect(0,0,width,height);

    const grad = ctx.createLinearGradient(0,0,width,height);
    grad.addColorStop(0,"#020617");
    grad.addColorStop(1,"#020617");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,width,height);

    // arena border
    ctx.strokeStyle = "rgba(148,163,184,0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(10,10,width-20,height-20);

    // bullets
    for (const b of gameState.bullets) {
      const pos = worldToScreen(b.x, b.y);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI*2);
      ctx.fillStyle = "#facc15";
      ctx.fill();
    }

    // players
    for (const p of gameState.players) {
      const pos = worldToScreen(p.x, p.y);
      const isMe = p.id === currentPlayerId;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 16, 0, Math.PI*2);
      ctx.fillStyle = isMe ? "#22c55e" : "#38bdf8";
      ctx.fill();

      // hp bar
      const barW = 40;
      const barH = 5;
      const ratio = p.hp / 100;
      ctx.fillStyle = "rgba(15,23,42,0.9)";
      ctx.fillRect(pos.x - barW/2, pos.y - 26, barW, barH);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(pos.x - barW/2, pos.y - 26, barW*ratio, barH);

      // name
      ctx.fillStyle = "rgba(226,232,240,0.9)";
      ctx.font = "11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(p.name, pos.x, pos.y + 26);
    }
  }

  draw();
})();

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("sessionToken");
    location.reload();
  });
