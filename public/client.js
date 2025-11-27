
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

let roomCode, playerId, isHost = false;
let gameState;
let keys = {};

playBtn.onclick = () => {
  socket.emit("createRoom", { name: nameInput.value }, res => {
    roomCode = res.roomCode;
    playerId = res.playerId;
    isHost = true;
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

function draw() {
  if (!gameState) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  gameState.players.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x/2, p.y/2, 12, 0, Math.PI*2);
    ctx.fillStyle = p.id === playerId ? "cyan" : "purple";
    ctx.fill();
  });
}

window.onkeydown = e => keys[e.key] = true;
window.onkeyup = e => keys[e.key] = false;

setInterval(()=>{
  socket.emit("playerInput",{
    roomCode,
    input:{
      up: keys["w"],
      down: keys["s"],
      left: keys["a"],
      right: keys["d"],
      angle: 0
    }
  });
},30);
