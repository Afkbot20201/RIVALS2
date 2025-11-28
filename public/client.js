
(() => {
  const socket = io();


  const authUser = document.getElementById("authUser");
  const authPass = document.getElementById("authPass");
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

  loginBtn.addEventListener("click", () => {
    socket.emit("login", {
      username: authUser.value.trim(),
      password: authPass.value
    }, res => {
      if (!res.ok) {
        setAuthError(res.error);
        return;
      }
      setAuthError("");
      currentUsername = res.username;
      playerNameInput.value = res.username;
      playerNameInput.disabled = true;
      const authPanel = document.getElementById("auth-panel");
      if (authPanel) authPanel.style.display = "none";
    });
  });

  registerBtn.addEventListener("click", () => {
    socket.emit("register", {
      username: authUser.value.trim(),
      password: authPass.value
    }, res => {
      if (!res.ok) {
        setAuthError(res.error);
        return;
      }
      setAuthError("Registered! You can now log in.");
    });
  });

  function setLobbyError(msg) {
    if (!msg) {
      lobbyErrorEl.classList.add("hidden");
      lobbyErrorEl.textContent = "";
    } else {
      lobbyErrorEl.classList.remove("hidden");
      lobbyErrorEl.textContent = msg;
    }
  }

  function updateRoomMeta() {
    if (!currentRoomCode) {
      roomMetaEl.textContent = "";
      return;
    }
    roomMetaEl.textContent = "Share your room code so friends can join: " + currentRoomCode;
  }

  function renderPlayersList(players, hostId) {
    playersListEl.innerHTML = "";
    if (!players || !players.length) {
      const li = document.createElement("li");
      li.style.justifyContent = "center";
      li.style.fontSize = "12px";
      li.style.color = "#94a3b8";
      li.textContent = "Waiting for players...";
      playersListEl.appendChild(li);
      return;
    }
    for (const p of players) {
      const li = document.createElement("li");
      const left = document.createElement("div");
      left.className = "name";
      const avatar = document.createElement("div");
      avatar.className = "player-avatar";
      avatar.textContent = (p.name[0] || "?").toUpperCase();
      const nameSpan = document.createElement("span");
      nameSpan.textContent = p.name;
      left.appendChild(avatar);
      left.appendChild(nameSpan);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.gap = "8px";
      right.style.fontSize = "11px";
      right.style.color = "#94a3b8";
      const score = document.createElement("span");
      score.textContent = p.score ?? 0;
      right.appendChild(score);
      if (p.id === hostId) {
        const hostBadge = document.createElement("span");
        hostBadge.textContent = "Host";
        hostBadge.style.borderRadius = "999px";
        hostBadge.style.border = "1px solid rgba(56,189,248,0.7)";
        hostBadge.style.padding = "2px 8px";
        hostBadge.style.fontSize = "10px";
        right.appendChild(hostBadge);
      }
      li.appendChild(left);
      li.appendChild(right);
      playersListEl.appendChild(li);
    }
  }

  function switchToGame() {
    lobbyPanel.classList.add("hidden");
    gamePanel.classList.remove("hidden");
    resizeCanvas();
  }

  function switchToLobby() {
    gamePanel.classList.add("hidden");
    lobbyPanel.classList.remove("hidden");
  }

  function updateTasksFromPlayer(player) {
    if (!player) return;
    const duels = currentRoomCode ? 1 : 0;
    const elims = player.score || 0;
    const wins = 0;

    const playRatio = Math.min(1, duels / 5);
    const elimRatio = Math.min(1, elims / 15);
    const winRatio = Math.min(1, wins / 2);

    taskPlayFill.style.width = (playRatio * 100) + "%";
    taskElimFill.style.width = (elimRatio * 100) + "%";
    taskWinFill.style.width = (winRatio * 100) + "%";

    taskPlayText.textContent = duels + " / 5";
    taskElimText.textContent = elims + " / 15";
    taskWinText.textContent = wins + " / 2";
  }

  socket.on("lobbyUpdate", ({ players, hostId }) => {
    renderPlayersList(players || [], hostId);
    startGameBtn.disabled = !(hostId === currentPlayerId && players && players.length > 0);
  });

  socket.on("gameStarted", () => {
    switchToGame();
    gameOverlay.classList.add("hidden");
  });

  socket.on("gameState", state => {
    gameState = state;
    arena = state.arena || arena;
    const me = state.players.find(p => p.id === currentPlayerId);
    if (me) {
      const hpRatio = me.hp / 100;
      hpBarFill.style.transform = "scaleX(" + hpRatio + ")";
      scoreLabel.textContent = me.score;
      updateTasksFromPlayer(me);
    }
    renderScoreboard(state);
  });

  function renderScoreboard(state) {
    scoreboardList.innerHTML = "";
    if (!state || !state.players || !state.players.length) return;
    const sorted = [...state.players].sort((a,b)=>b.score-a.score);
    for (const p of sorted) {
      const li = document.createElement("li");
      if (p.id === currentPlayerId) li.classList.add("me");
      const left = document.createElement("div");
      left.className = "name";
      const avatar = document.createElement("div");
      avatar.className = "player-avatar";
      avatar.textContent = (p.name[0] || "?").toUpperCase();
      const nameSpan = document.createElement("span");
      nameSpan.textContent = p.name;
      left.appendChild(avatar);
      left.appendChild(nameSpan);
      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.gap = "8px";
      const score = document.createElement("span");
      score.textContent = p.score ?? 0;
      score.style.fontSize = "12px";
      right.appendChild(score);
      const hp = document.createElement("span");
      hp.textContent = p.hp + " HP";
      hp.style.fontSize = "11px";
      right.appendChild(hp);
      li.appendChild(left);
      li.appendChild(right);
      scoreboardList.appendChild(li);
    }
  }

  function handleCreateRoom() {
    if (!currentUsername) { setLobbyError("Please log in first."); return; }
    const name = playerNameInput.value.trim();
    if (!name) {
      setLobbyError("Please enter a player name.");
      return;
    }
    setLobbyError("");
    createRoomBtn.disabled = true;
    joinRoomBtn.disabled = true;
    socket.emit("createRoom", { name }, resp => {
      createRoomBtn.disabled = false;
      joinRoomBtn.disabled = false;
      if (!resp || !resp.ok) {
        setLobbyError(resp?.error || "Failed to create room.");
        return;
      }
      currentRoomCode = resp.roomCode;
      currentPlayerId = resp.playerId;
      isHost = resp.isHost;
      arena = resp.arena || arena;
      roomCodeLabel.textContent = currentRoomCode;
      updateRoomMeta();
    });
  }

  function handleJoinRoom() {
    if (!currentUsername) { setLobbyError("Please log in first."); return; }
    const name = playerNameInput.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!name) {
      setLobbyError("Please enter a player name.");
      return;
    }
    if (!code) {
      setLobbyError("Please enter a room code.");
      return;
    }
    setLobbyError("");
    createRoomBtn.disabled = true;
    joinRoomBtn.disabled = true;
    socket.emit("joinRoom", { name, roomCode: code }, resp => {
      createRoomBtn.disabled = false;
      joinRoomBtn.disabled = false;
      if (!resp || !resp.ok) {
        setLobbyError(resp?.error || "Failed to join room.");
        return;
      }
      currentRoomCode = resp.roomCode;
      currentPlayerId = resp.playerId;
      isHost = resp.isHost;
      arena = resp.arena || arena;
      roomCodeLabel.textContent = currentRoomCode;
      updateRoomMeta();
    });
  }

  function handleStartGame() {
    if (!currentRoomCode || !isHost) return;
    socket.emit("startGame", { roomCode: currentRoomCode });
    gameOverlay.textContent = "Loading arena...";
    gameOverlay.classList.remove("hidden");
  }

  function handleLeaveGame() {
    window.location.reload();
  }

  createRoomBtn.addEventListener("click", handleCreateRoom);
  joinRoomBtn.addEventListener("click", handleJoinRoom);
  startGameBtn.addEventListener("click", handleStartGame);
  leaveGameBtn.addEventListener("click", handleLeaveGame);

  playerNameInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      if (roomCodeInput.value.trim()) handleJoinRoom();
      else handleCreateRoom();
    }
  });
  roomCodeInput.addEventListener("keydown", e => {
    if (e.key === "Enter") handleJoinRoom();
  });

  // controls
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


// ===== ROUND SYSTEM UI =====
const roundLabel = document.getElementById("roundLabel");
const timerLabel = document.getElementById("timerLabel");
const winLabel = document.getElementById("winLabel");

socket.on("roundState", data => {
  if (roundLabel) roundLabel.textContent = data.round;
  if (timerLabel) timerLabel.textContent = data.timeLeft;
});

socket.on("newRound", data => {
  if (roundLabel) roundLabel.textContent = data.round;
  if (winLabel) winLabel.textContent = JSON.stringify(data.wins);
});

socket.on("matchEnd", data => {
  alert("Match Winner: " + data.winnerId);
});
