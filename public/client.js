const socket = io();

const authUser = document.getElementById("authUser");
const authPass = document.getElementById("authPass");
const confirmInput = document.getElementById("auth-confirm");
const emailInput = document.getElementById("auth-email");
const authError = document.getElementById("authError");

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const forgotBtn = document.getElementById("forgot-btn");
const logoutBtn = document.getElementById("logout-btn");

function setAuthError(msg) {
  if (!msg) {
    authError.classList.add("hidden");
    authError.textContent = "";
  } else {
    authError.classList.remove("hidden");
    authError.textContent = msg;
  }
}

if (localStorage.getItem("rivals2_user")) {
  document.getElementById("auth-panel").classList.add("hidden");
  logoutBtn.classList.remove("hidden");
}

loginBtn.onclick = () => {
  socket.emit("login", {
    username: authUser.value,
    password: authPass.value
  }, res => {
    if (!res.ok) return setAuthError(res.error);
    localStorage.setItem("rivals2_user", res.username);
    location.reload();
  });
};

registerBtn.onclick = () => {
  if (authPass.value !== confirmInput.value) return setAuthError("Passwords do not match");
  socket.emit("register", {
    username: authUser.value,
    password: authPass.value,
    email: emailInput.value
  }, res => {
    if (!res.ok) return setAuthError(res.error);
    setAuthError("Registered! Now login.");
  });
};

forgotBtn.onclick = () => {
  socket.emit("requestPasswordReset", { email: emailInput.value }, res => {
    alert(res.ok ? "Reset email sent" : "Email not found");
  });
};

logoutBtn.onclick = () => {
  localStorage.removeItem("rivals2_user");
  location.reload();
};
