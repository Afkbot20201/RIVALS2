
const socket = io();

const loginUser = document.getElementById("loginUser");
const loginPass = document.getElementById("loginPass");
const regUser = document.getElementById("regUser");
const regPass = document.getElementById("regPass");
const regPass2 = document.getElementById("regPass2");
const rememberMe = document.getElementById("rememberMe");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const authError = document.getElementById("authError");
const logoutBtn = document.getElementById("logoutBtn");
const playerNameInput = document.getElementById("playerName");

document.querySelectorAll(".auth-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".auth-tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab + "Tab").classList.add("active");
  });
});

function setAuthError(msg) {
  if (!msg) {
    authError.classList.add("hidden");
    authError.textContent = "";
  } else {
    authError.classList.remove("hidden");
    authError.textContent = msg;
  }
}

const savedToken = localStorage.getItem("sessionToken");
if (savedToken) {
  socket.emit("resumeSession", savedToken, res => {
    if (res.ok) afterLogin(res.username);
    else localStorage.removeItem("sessionToken");
  });
}

function afterLogin(username) {
  playerNameInput.value = username;
  playerNameInput.disabled = true;
  document.getElementById("auth-panel").style.display = "none";
  logoutBtn.classList.remove("hidden");
}

loginBtn.addEventListener("click", () => {
  socket.emit("login", {
    username: loginUser.value,
    password: loginPass.value
  }, res => {
    if (!res.ok) return setAuthError(res.error);

    if (rememberMe.checked) {
      localStorage.setItem("sessionToken", res.token);
    }
    afterLogin(res.username);
  });
});

registerBtn.addEventListener("click", () => {
  if (regPass.value !== regPass2.value) return setAuthError("Passwords do not match");

  socket.emit("register", {
    username: regUser.value,
    password: regPass.value
  }, res => {
    if (!res.ok) return setAuthError(res.error);
    setAuthError("Registered! You can now log in.");
  });
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("sessionToken");
  location.reload();
});
