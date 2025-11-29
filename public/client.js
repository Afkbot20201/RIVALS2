
const socket = io();

let scene, camera, renderer;
let players = {};
let code = null;
let myId = null;
let keys = {};

const canvas = document.getElementById("gameCanvas");

function init3D() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10151c);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);

  renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5);
  scene.add(light);

  const baseplateGeo = new THREE.PlaneGeometry(50, 50);
  const baseplateMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
  const baseplate = new THREE.Mesh(baseplateGeo, baseplateMat);
  baseplate.rotation.x = -Math.PI / 2;
  scene.add(baseplate);

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

socket.on("roomJoined", (d) => {
  code = d.code;
});

socket.on("gameStarted", () => {
  init3D();
});

socket.on("gameState", (serverPlayers) => {
  for (let id in serverPlayers) {
    if (!players[id]) {
      const geo = new THREE.BoxGeometry(1, 2, 1);
      const mat = new THREE.MeshStandardMaterial({ color: id === socket.id ? 0x00ff00 : 0xff0000 });
      players[id] = new THREE.Mesh(geo, mat);
      scene.add(players[id]);
    }
    players[id].position.set(serverPlayers[id].x, 1, serverPlayers[id].z);
  }
});

window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

setInterval(() => {
  if (!code) return;
  let p = players[socket.id];
  if (!p) return;

  let speed = 0.2;
  if (keys["w"]) p.position.z -= speed;
  if (keys["s"]) p.position.z += speed;
  if (keys["a"]) p.position.x -= speed;
  if (keys["d"]) p.position.x += speed;

  socket.emit("move", { code, x: p.position.x, z: p.position.z });

  camera.position.x = p.position.x;
  camera.position.z = p.position.z + 8;
}, 50);
