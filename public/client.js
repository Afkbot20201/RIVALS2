
// === FORCE GAME TO USE LOGGED-IN USERNAME ===
const savedUser = localStorage.getItem("rivals2_user");
if (savedUser) {
  const display = document.getElementById("currentUsername");
  if (display) display.value = savedUser;
}

// Override any old createRoom behavior
if (typeof createRoomBtn !== "undefined") {
  createRoomBtn.onclick = () => {
    socket.emit("createRoom", {}, res => {
      if (!res.ok) alert(res.error || "Failed to create room");
    });
  };
}

// Override join logic to NOT use custom username input
if (typeof joinRoomBtn !== "undefined") {
  joinRoomBtn.onclick = () => {
    socket.emit("joinRoom", {
      roomCode: roomCode.value.trim()
    }, res => {
      if (!res.ok) alert("Failed to join room");
    });
  };
}
