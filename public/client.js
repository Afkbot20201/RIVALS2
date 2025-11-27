const socket = io();
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let state = { players: {}, bullets: [] };

socket.on("state", s => state = s);

function render() {
  ctx.clearRect(0,0,800,600);
  Object.values(state.players).forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI*2);
    ctx.fill();
  });
  state.bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI*2);
    ctx.fill();
  });
  requestAnimationFrame(render);
}
render();
