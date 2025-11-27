const socket = io();
const authUser = document.getElementById("authUser");
const authPass = document.getElementById("authPass");
const confirmInput = document.getElementById("auth-confirm");
const emailInput = document.getElementById("auth-email");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const forgotBtn = document.getElementById("forgot-btn");
const logoutBtn = document.getElementById("logout-btn");
const authPanel = document.getElementById("auth-panel");
const authError = document.getElementById("authError");
const confirmRow = document.getElementById("confirmRow");
const emailRow = document.getElementById("emailRow");

function setAuthError(msg) {
  if (!msg) { authError.classList.add("hidden"); }
  else { authError.classList.remove("hidden"); authError.textContent = msg; }
}

function showRegister() {
  confirmRow.classList.remove("hidden");
  emailRow.classList.remove("hidden");
  forgotBtn.classList.add("hidden");
}

function showLogin() {
  confirmRow.classList.add("hidden");
  emailRow.classList.add("hidden");
  forgotBtn.classList.remove("hidden");
}

registerBtn.onclick = () => {
  showRegister();
  if (authPass.value !== confirmInput.value) {
    setAuthError("Passwords do not match");
    return;
  }

  socket.emit("register", {
    username: authUser.value.trim(),
    password: authPass.value,
    email: emailInput.value.trim()
  }, res => {
    if (!res.ok) return setAuthError(res.error);
    setAuthError("Registered! You can log in.");
    showLogin();
  });
};

loginBtn.onclick = () => {
  showLogin();
  socket.emit("login", {
    username: authUser.value.trim(),
    password: authPass.value
  }, res => {
    if (!res.ok) return setAuthError(res.error);
    localStorage.setItem("rivals2_user", res.username);
    authPanel.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
  });
};

forgotBtn.onclick = () => {
  socket.emit("requestPasswordReset", { email: emailInput.value.trim() }, res => {
    alert(res.ok ? "Reset email sent!" : "Email not found.");
  });
};

logoutBtn.onclick = () => {
  localStorage.removeItem("rivals2_user");
  location.reload();
};

if (localStorage.getItem("rivals2_user")) {
  authPanel.classList.add("hidden");
  logoutBtn.classList.remove("hidden");
}
