
const socket = io();
const lobby = document.getElementById("lobby");
const game = document.getElementById("game");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const playBtn = document.getElementById("playBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");

const nameInput = document.getElementById("name");
const roomCodeInput = document.getElementById("roomCode");
const playersEl = document.getElementById("players");
const roomInfo = document.getElementById("roomInfo");

let roomCode, playerId;
let gameState;
let keys = {};
let mouse = { x:0, y:0 };

playBtn.onclick = () => {
  socket.emit("createRoom", { name: nameInput.value }, res => {
    roomCode = res.roomCode;
    playerId = res.playerId;
    roomInfo.textContent = "Room: " + roomCode;
  });
};

joinBtn.onclick = () => {
  socket.emit("joinRoom", { name: nameInput.value, roomCode: roomCodeInput.value }, res => {
    roomCode = res.roomCode;
    playerId = res.playerId;
    roomInfo.textContent = "Room: " + roomCode;
  });
};

startBtn.onclick = () => {
  socket.emit("startGame", { roomCode });
};

socket.on("lobbyUpdate", data => {
  playersEl.innerHTML = "";
  data.players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p.name;
    playersEl.appendChild(li);
  });
  startBtn.style.display = data.hostId === playerId ? "block" : "none";
});

socket.on("gameStarted", () => {
  lobby.style.display = "none";
  game.style.display = "block";
  resize();
});

socket.on("gameState", state => {
  gameState = state;
  draw();
});

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.onresize = resize;

canvas.onmousemove = e => {
  mouse.x = e.offsetX;
  mouse.y = e.offsetY;
};

canvas.onclick = () => {
  if (!gameState) return;
  const me = gameState.players.find(p => p.id === playerId);
  if (!me) return;
  const angle = Math.atan2(mouse.y - canvas.height/2, mouse.x - canvas.width/2);
  socket.emit("shoot", { roomCode, angle });
};

function draw() {
  if (!gameState) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);

  gameState.bullets.forEach(b => {
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(b.x/2, b.y/2, 4, 0, Math.PI*2);
    ctx.fill();
  });

  gameState.players.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x/2, p.y/2, 12, 0, Math.PI*2);
    ctx.fillStyle = p.id === playerId ? "cyan" : "magenta";
    ctx.fill();
  });
}

window.onkeydown = e => keys[e.key] = true;
window.onkeyup = e => keys[e.key] = false;

setInterval(() => {
  socket.emit("playerInput", {
    roomCode,
    input:{
      up: keys["w"],
      down: keys["s"],
      left: keys["a"],
      right: keys["d"]
    }
  });
}, 30);
