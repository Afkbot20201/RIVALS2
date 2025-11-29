
const socket = io();
let scene, camera, renderer;
let players = {};
let roomCode = null;
let keys = {};

const canvas = document.getElementById("gameCanvas");

document.getElementById("create").onclick = () => {
  socket.emit("createRoom");
};

document.getElementById("start").onclick = () => {
  socket.emit("startGame", roomCode);
};

function init3D() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 6, 10);

  renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5);
  scene.add(light);

  const baseGeo = new THREE.PlaneGeometry(100, 100);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.rotation.x = -Math.PI / 2;
  scene.add(base);

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

socket.on("roomJoined", data => {
  roomCode = data.code;
  alert("Joined room: " + data.code);
});

socket.on("gameStarted", () => {
  init3D();
});

socket.on("gameState", serverPlayers => {
  for (let id in serverPlayers) {
    if (!players[id]) {
      const geo = new THREE.BoxGeometry(1, 2, 1);
      const mat = new THREE.MeshStandardMaterial({ color: id === socket.id ? 0x00ff00 : 0xff0000 });
      const mesh = new THREE.Mesh(geo, mat);
      players[id] = mesh;
      scene.add(mesh);
    }
    players[id].position.set(serverPlayers[id].x, 1, serverPlayers[id].z);
  }
});

window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

setInterval(() => {
  if (!roomCode) return;
  const me = players[socket.id];
  if (!me) return;

  let speed = 0.2;
  if (keys["w"]) me.position.z -= speed;
  if (keys["s"]) me.position.z += speed;
  if (keys["a"]) me.position.x -= speed;
  if (keys["d"]) me.position.x += speed;

  socket.emit("move", { code: roomCode, x: me.position.x, z: me.position.z });

  camera.position.x = me.position.x;
  camera.position.z = me.position.z + 10;
}, 50);
