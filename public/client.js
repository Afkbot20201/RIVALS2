
(() => {
  const socket = io();

  const lobbyPanel = document.getElementById("lobby-panel");
  const gamePanel = document.getElementById("game-panel");
  const playerNameInput = document.getElementById("playerName");
  const roomCodeInput = document.getElementById("roomCode");
  const createRoomBtn = document.getElementById("createRoomBtn");
  const joinRoomBtn = document.getElementById("joinRoomBtn");
  const startGameBtn = document.getElementById("startGameBtn");
  const backToLobbyBtn = document.getElementById("backToLobbyBtn");
  const playersListEl = document.getElementById("playersList");
  const roomMetaEl = document.getElementById("roomMeta");
  const lobbyErrorEl = document.getElementById("lobbyError");
  const roomCodeLabel = document.getElementById("roomCodeLabel");
  const hpBarFill = document.getElementById("hpBarFill");
  const scoreLabel = document.getElementById("scoreLabel");
  const scoreboardList = document.getElementById("scoreboardList");
  const gameCanvas = document.getElementById("gameCanvas");
  const gameOverlay = document.getElementById("gameOverlay");

  const ctx = gameCanvas.getContext("2d");

  let currentRoomCode = null;
  let currentPlayerId = null;
  let isHost = false;
  let gameState = null;
  let arena = { width: 1200, height: 700 };

  let keys = { w: false, a: false, s: false, d: false };
  let mousePos = { x: 0, y: 0 };
  let mouseDown = false;

  let lastSentInput = null;
  let lastShootTime = 0;
  const SHOOT_COOLDOWN = 200;

  let canvasRect = null;

  function setLobbyError(msg) {
    if (!msg) {
      lobbyErrorEl.classList.add("hidden");
      lobbyErrorEl.textContent = "";
    } else {
      lobbyErrorEl.textContent = msg;
      lobbyErrorEl.classList.remove("hidden");
    }
  }

  function setRoomMeta(roomCode) {
    if (!roomCode) {
      roomMetaEl.innerHTML = "";
      return;
    }
    roomMetaEl.innerHTML =
      'Room code: <strong>' +
      roomCode +
      "</strong> &nbsp;·&nbsp; Share this with your friends";
  }

  function switchToGame() {
    lobbyPanel.classList.add("hidden");
    gamePanel.classList.remove("hidden");
  }

  function switchToLobby() {
    gamePanel.classList.add("hidden");
    lobbyPanel.classList.remove("hidden");
  }

  function renderPlayersList(players) {
    playersListEl.innerHTML = "";
    if (!players || !players.length) {
      const empty = document.createElement("li");
      empty.textContent = "Waiting for players...";
      empty.style.justifyContent = "center";
      empty.style.fontSize = "12px";
      empty.style.color = "#9ca3af";
      playersListEl.appendChild(empty);
      return;
    }

    for (const p of players) {
      const li = document.createElement("li");
      const left = document.createElement("div");
      left.className = "name";

      const avatar = document.createElement("div");
      avatar.className = "player-avatar";
      avatar.textContent = p.name[0]?.toUpperCase() || "?";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = p.name;

      left.appendChild(avatar);
      left.appendChild(nameSpan);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "8px";
      right.style.fontSize = "11px";
      right.style.color = "#9ca3af";

      if (p.isHost) {
        const host = document.createElement("span");
        host.className = "host-badge";
        host.textContent = "Host";
        right.appendChild(host);
      }

      const score = document.createElement("span");
      score.textContent = p.score ?? 0;
      right.appendChild(score);

      li.appendChild(left);
      li.appendChild(right);
      playersListEl.appendChild(li);
    }
  }

  function renderScoreboard(state) {
    scoreboardList.innerHTML = "";
    if (!state || !state.players || !state.players.length) {
      const li = document.createElement("li");
      li.textContent = "No players";
      li.style.justifyContent = "center";
      li.style.fontSize = "12px";
      li.style.color = "#9ca3af";
      scoreboardList.appendChild(li);
      return;
    }

    const sorted = [...state.players].sort((a, b) => b.score - a.score);

    for (const p of sorted) {
      const li = document.createElement("li");
      if (p.id === currentPlayerId) li.classList.add("me");

      const left = document.createElement("div");
      left.className = "scoreboard-name";

      const avatar = document.createElement("div");
      avatar.className = "player-avatar";
      avatar.textContent = p.name[0]?.toUpperCase() || "?";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = p.name;

      left.appendChild(avatar);
      left.appendChild(nameSpan);

      const score = document.createElement("span");
      score.className = "score-pill";
      score.textContent = p.score ?? 0;

      const hp = document.createElement("span");
      hp.className = "hp-chip";
      hp.textContent = p.hp + " HP";

      li.appendChild(left);
      li.appendChild(score);
      li.appendChild(hp);

      scoreboardList.appendChild(li);
    }
  }

  function getInputState(angle) {
    return {
      up: keys.w,
      down: keys.s,
      left: keys.a,
      right: keys.d,
      angle
    };
  }

  function inputsEqual(a, b) {
    if (!a || !b) return false;
    return (
      a.up === b.up &&
      a.down === b.down &&
      a.left === b.left &&
      a.right === b.right &&
      Math.abs(a.angle - b.angle) < 0.01
    );
  }

  function sendInput() {
    if (!currentRoomCode || !currentPlayerId) return;
    const player = gameState?.players?.find(p => p.id === currentPlayerId);
    const angle = player ? Math.atan2(mousePos.y - player.y, mousePos.x - player.x) : 0;
    const input = getInputState(angle);
    if (lastSentInput && inputsEqual(lastSentInput, input)) return;
    lastSentInput = input;

    socket.emit("playerInput", {
      roomCode: currentRoomCode,
      input
    });
  }

  function worldToScreen(x, y) {
    return {
      x: (x / arena.width) * gameCanvas.width,
      y: (y / arena.height) * gameCanvas.height
    };
  }

  function drawGame() {
    if (!gameState) return;

    const { width, height } = gameCanvas;
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      Math.max(width, height)
    );
    gradient.addColorStop(0, "#020617");
    gradient.addColorStop(1, "#000000");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const pad = 24;
    ctx.strokeStyle = "rgba(148,163,184,0.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
    ctx.setLineDash([]);

    const player = gameState.players.find(p => p.id === currentPlayerId);
    if (player) {
      const hpRatio = player.hp / 100;
      hpBarFill.style.transform = "scaleX(" + hpRatio + ")";
      scoreLabel.textContent = player.score;
    }

    if (gameState.bullets) {
      for (const b of gameState.bullets) {
        const pos = worldToScreen(b.x, b.y);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 8);
        g.addColorStop(0, "rgba(56,189,248,1)");
        g.addColorStop(1, "rgba(8,47,73,0)");
        ctx.fillStyle = g;
        ctx.fill();
      }
    }

    for (const p of gameState.players) {
      const pos = worldToScreen(p.x, p.y);

      const aura = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 30);
      const isMe = p.id === currentPlayerId;
      if (isMe) {
        aura.addColorStop(0, "rgba(56,189,248,0.9)");
        aura.addColorStop(1, "rgba(8,47,73,0)");
      } else {
        aura.addColorStop(0, "rgba(168,85,247,0.8)");
        aura.addColorStop(1, "rgba(76,29,149,0)");
      }
      ctx.fillStyle = aura;
      ctx.fillRect(pos.x - 30, pos.y - 30, 60, 60);

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(p.angle);

      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fillStyle = isMe
        ? "rgba(15,23,42,0.95)"
        : "rgba(15,23,42,0.95)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isMe ? "#38bdf8" : "#a855f7";
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(22, 0);
      ctx.lineWidth = 4;
      ctx.strokeStyle = isMe ? "#7dd3fc" : "#d8b4fe";
      ctx.stroke();

      ctx.restore();

      const barWidth = 40;
      const barHeight = 4;
      const hpRatio = p.hp / 100;
      ctx.fillStyle = "rgba(15,23,42,0.85)";
      ctx.fillRect(pos.x - barWidth / 2, pos.y + 22, barWidth, barHeight);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(pos.x - barWidth / 2, pos.y + 22, barWidth * hpRatio, barHeight);

      ctx.font = "11px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(226,232,240,0.9)";
      ctx.fillText(p.name, pos.x, pos.y - 22);
    }

    renderScoreboard(gameState);
  }

  function gameLoop() {
    drawGame();
    requestAnimationFrame(gameLoop);
  }

  function resizeCanvas() {
    const wrapper = gameCanvas.parentElement;
    const rect = wrapper.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;
    const targetWidth = rect.width;
    const targetHeight = rect.height;
    gameCanvas.width = targetWidth * devicePixelRatio;
    gameCanvas.height = targetHeight * devicePixelRatio;
    gameCanvas.style.width = targetWidth + "px";
    gameCanvas.style.height = targetHeight + "px";
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    canvasRect = gameCanvas.getBoundingClientRect();
  }

  window.addEventListener("resize", resizeCanvas);

  socket.on("lobbyUpdate", payload => {
    renderPlayersList(payload.players || []);
    const host = payload.players?.find(p => p.isHost);
    if (host && host.id === currentPlayerId) {
      isHost = true;
    }
    startGameBtn.disabled = !isHost || !(payload.players && payload.players.length > 0);
  });

  socket.on("gameStarted", () => {
    switchToGame();
    gameOverlay.classList.add("hidden");
  });

  socket.on("gameState", state => {
    gameState = state;
    arena = state.arena || arena;
  });

  function handleCreateRoom() {
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
      arena = resp.arena || arena;
      isHost = resp.isHost;
      roomCodeLabel.textContent = currentRoomCode;
      setRoomMeta(currentRoomCode);
      switchToGame();
      gameOverlay.textContent = "Waiting for the host to start the game...";
      gameOverlay.classList.remove("hidden");
    });
  }

  function handleJoinRoom() {
    const name = playerNameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!name) {
      setLobbyError("Please enter a player name.");
      return;
    }
    if (!roomCode) {
      setLobbyError("Please enter a room code.");
      return;
    }
    setLobbyError("");
    createRoomBtn.disabled = true;
    joinRoomBtn.disabled = true;

    socket.emit("joinRoom", { name, roomCode }, resp => {
      createRoomBtn.disabled = false;
      joinRoomBtn.disabled = false;
      if (!resp || !resp.ok) {
        setLobbyError(resp?.error || "Failed to join room.");
        return;
      }
      currentRoomCode = resp.roomCode;
      currentPlayerId = resp.playerId;
      arena = resp.arena || arena;
      isHost = resp.isHost;
      roomCodeLabel.textContent = currentRoomCode;
      setRoomMeta(currentRoomCode);
      switchToGame();
      gameOverlay.textContent = "Waiting for the host to start the game...";
      gameOverlay.classList.remove("hidden");
    });
  }

  function handleStartGame() {
    if (!isHost || !currentRoomCode) return;
    socket.emit("startGame", { roomCode: currentRoomCode });
  }

  function handleLeaveGame() {
    window.location.reload();
  }

  createRoomBtn.addEventListener("click", handleCreateRoom);
  joinRoomBtn.addEventListener("click", handleJoinRoom);
  roomCodeInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleJoinRoom();
    }
  });
  playerNameInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (roomCodeInput.value.trim()) {
        handleJoinRoom();
      } else {
        handleCreateRoom();
      }
    }
  });
  startGameBtn.addEventListener("click", handleStartGame);
  backToLobbyBtn.addEventListener("click", handleLeaveGame);

  window.addEventListener("keydown", e => {
    if (e.repeat) return;
    switch (e.key.toLowerCase()) {
      case "w":
        keys.w = true;
        break;
      case "a":
        keys.a = true;
        break;
      case "s":
        keys.s = true;
        break;
      case "d":
        keys.d = true;
        break;
    }
    sendInput();
  });

  window.addEventListener("keyup", e => {
    switch (e.key.toLowerCase()) {
      case "w":
        keys.w = false;
        break;
      case "a":
        keys.a = false;
        break;
      case "s":
        keys.s = false;
        break;
      case "d":
        keys.d = false;
        break;
    }
    sendInput();
  });

  function updateMousePos(ev) {
    if (!canvasRect) canvasRect = gameCanvas.getBoundingClientRect();
    const x = ev.clientX - canvasRect.left;
    const y = ev.clientY - canvasRect.top;
    const worldX = (x / canvasRect.width) * arena.width;
    const worldY = (y / canvasRect.height) * arena.height;
    mousePos.x = worldX;
    mousePos.y = worldY;
    sendInput();
  }

  gameCanvas.addEventListener("mousemove", updateMousePos);
  gameCanvas.addEventListener("mousedown", ev => {
    mouseDown = true;
    updateMousePos(ev);
    tryShoot();
  });
  window.addEventListener("mouseup", () => {
    mouseDown = false;
  });

  function tryShoot() {
    if (!mouseDown) return;
    const now = performance.now();
    if (now - lastShootTime < SHOOT_COOLDOWN) return;
    lastShootTime = now;

    const player = gameState?.players?.find(p => p.id === currentPlayerId);
    if (!player) return;

    const angle = Math.atan2(mousePos.y - player.y, mousePos.x - player.x);

    socket.emit("shoot", {
      roomCode: currentRoomCode,
      angle
    });
  }

  setInterval(() => {
    if (mouseDown) {
      tryShoot();
    }
  }, 30);

  setTimeout(resizeCanvas, 0);
  gameLoop();
})();


// --- Chat System ---
const chatInput = document.getElementById("chatInput");
const chatBox = document.getElementById("chatBox");

if (chatInput) {
  chatInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && chatInput.value.trim()) {
      socket.emit("chatMessage", {
        roomCode: currentRoomCode,
        message: chatInput.value.trim()
      });
      chatInput.value = "";
    }
  });
}

socket.on("chatMessage", ({ name, message }) => {
  const div = document.createElement("div");
  div.innerHTML = "<strong>" + name + ":</strong> " + message;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// --- Game Over Screen ---
socket.on("gameOver", ({ winner }) => {
  const overlay = document.getElementById("gameOverlay");
  overlay.innerHTML = "🏆 Winner: " + winner + "<br><br>Returning to lobby...";
  overlay.classList.remove("hidden");
  setTimeout(() => window.location.reload(), 6000);
});
