
const socket = io();

const auth = document.getElementById("auth");
const lobby = document.getElementById("lobby");
const game = document.getElementById("game");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const userInput = document.getElementById("auth-username");
const passInput = document.getElementById("auth-password");
const authError = document.getElementById("authError");
const userLabel = document.getElementById("userLabel");

const playBtn = document.getElementById("playBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const roomInput = document.getElementById("roomCode");
const playersEl = document.getElementById("players");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let roomCode, playerId;
let gameState;
let keys = {};
let mouse = {x:0,y:0};

loginBtn.onclick = () => {
  socket.emit("login", { username: userInput.value, password: passInput.value }, res => {
    if (!res.ok) return authError.textContent = res.error;
    auth.classList.add("hidden");
    lobby.classList.remove("hidden");
    userLabel.textContent = res.username;
  });
};

registerBtn.onclick = () => {
  socket.emit("register", { username: userInput.value, password: passInput.value }, res => {
    if (!res.ok) return authError.textContent = res.error;
    authError.textContent = "Registered! Now login.";
  });
};

playBtn.onclick = () => {
  socket.emit("createRoom", {}, res => {
    roomCode = res.roomCode;
    playerId = res.playerId;
  });
};

joinBtn.onclick = () => {
  socket.emit("joinRoom", { roomCode: roomInput.value }, res => {
    roomCode = res.roomCode;
    playerId = res.playerId;
  });
};

startBtn.onclick = () => socket.emit("startGame", { roomCode });

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
  lobby.classList.add("hidden");
  game.classList.remove("hidden");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

socket.on("gameState", s => {
  gameState = s;
  draw();
});

canvas.onmousemove = e => {
  mouse.x = e.offsetX;
  mouse.y = e.offsetY;
};

canvas.onclick = () => {
  const me = gameState.players.find(p => p.id === playerId);
  const angle = Math.atan2(mouse.y - canvas.height/2, mouse.x - canvas.width/2);
  socket.emit("shoot", { roomCode, angle });
};

window.onkeydown = e => keys[e.key] = true;
window.onkeyup = e => keys[e.key] = false;

setInterval(()=>{
  socket.emit("playerInput",{
    roomCode,
    input:{
      up: keys["w"],
      down: keys["s"],
      left: keys["a"],
      right: keys["d"]
    }
  });
},30);

function draw(){
  if(!gameState) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  gameState.players.forEach(p=>{
    ctx.beginPath();
    ctx.arc(p.x/2,p.y/2,12,0,Math.PI*2);
    ctx.fillStyle = p.id===playerId?"cyan":"magenta";
    ctx.fill();
  });
}
