
(() => {
  const socket = io();

  const authUser = document.getElementById("authUser");
  const authPass = document.getElementById("authPass");
  const loginBtn = document.getElementById("loginBtn");
  const authError = document.getElementById("authError");
  const playerNameInput = document.getElementById("playerName");

  let currentUsername = null;

  const savedToken = localStorage.getItem("authToken");
  if (savedToken) {
    socket.emit("tokenLogin", { token: savedToken }, res => {
      if (res.ok) {
        currentUsername = res.username;
        playerNameInput.value = res.username;
        playerNameInput.disabled = true;
        document.getElementById("auth-panel").style.display = "none";
      } else {
        localStorage.removeItem("authToken");
      }
    });
  }

  loginBtn.addEventListener("click", () => {
    socket.emit("login", {
      username: authUser.value.trim(),
      password: authPass.value
    }, res => {
      if (!res.ok) {
        authError.textContent = res.error || "Login failed";
        authError.classList.remove("hidden");
        return;
      }

      localStorage.setItem("authToken", res.token);
      currentUsername = res.username;
      playerNameInput.value = res.username;
      playerNameInput.disabled = true;
      document.getElementById("auth-panel").style.display = "none";
    });
  });

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("authToken");
      location.reload();
    });
  }
})();
