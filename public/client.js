
const socket = io();
let roomCode = null;
let scene, camera, renderer, players = {};
let keys = {};

document.getElementById("login").onclick = () => {
  socket.emit("login", {
    username: user.value,
    password: pass.value
  }, res => {
    if (res.ok) {
      auth.style.display = "none";
      lobby.style.display = "block";
    }
  });
};

document.getElementById("register").onclick = () => {
  socket.emit("register", {
    username: user.value,
    password: pass.value
  });
};

document.getElementById("create").onclick = () => {
  socket.emit("createRoom", code => {
    roomCode = code;
    alert("Room created: " + code);
  });
};

document.getElementById("join").onclick = () => {
  socket.emit("joinRoom", roomInput.value, success => {
    if (success) {
      roomCode = roomInput.value;
      alert("Joined room!");
    }
  });
};

document.getElementById("start").onclick = () => {
  if (roomCode) socket.emit("startGame", roomCode);
};

socket.on("gameStarted", () => {
  init3D();
});

function init3D() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 6, 10);
  renderer = new THREE.WebGLRenderer({ canvas: gameCanvas });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5);
  scene.add(light);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

socket.on("gameState", serverPlayers => {
  for (let id in serverPlayers) {
    if (!players[id]) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 1),
        new THREE.MeshStandardMaterial({ color: id === socket.id ? 0x00ff00 : 0xff0000 })
      );
      players[id] = box;
      scene.add(box);
    }
    players[id].position.set(serverPlayers[id].x, 1, serverPlayers[id].z);
  }
});

window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

setInterval(() => {
  if (!roomCode || !players[socket.id]) return;

  const me = players[socket.id];
  let speed = 0.2;
  if (keys["w"]) me.position.z -= speed;
  if (keys["s"]) me.position.z += speed;
  if (keys["a"]) me.position.x -= speed;
  if (keys["d"]) me.position.x += speed;

  socket.emit("move", { code: roomCode, x: me.position.x, z: me.position.z });
}, 50);
