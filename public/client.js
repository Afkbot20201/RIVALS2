const socket = io();

const authUser = document.getElementById("authUser");
const authPass = document.getElementById("authPass");
const regUser = document.getElementById("regUser");
const regPass = document.getElementById("regPass");
const regConfirm = document.getElementById("regConfirm");
const rememberMe = document.getElementById("rememberMe");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authPanel = document.getElementById("auth-panel");
const authError = document.getElementById("authError");

const saved = localStorage.getItem("rememberedUser");

if (saved) {
  authPanel.style.display = "none";
  logoutBtn.classList.remove("hidden");
}

document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".auth-content").forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  };
});

loginBtn.onclick = () => {
  socket.emit("login", { username: authUser.value, password: authPass.value }, res => {
    if (!res.ok) {
      authError.textContent = res.error;
      authError.classList.remove("hidden");
      return;
    }

    if (rememberMe.checked) {
      localStorage.setItem("rememberedUser", res.username);
    }

    authPanel.style.display = "none";
    logoutBtn.classList.remove("hidden");
  });
};

registerBtn.onclick = () => {
  if (regPass.value !== regConfirm.value) {
    authError.textContent = "Passwords do not match.";
    authError.classList.remove("hidden");
    return;
  }

  socket.emit("register", { username: regUser.value, password: regPass.value }, res => {
    if (!res.ok) {
      authError.textContent = res.error;
      authError.classList.remove("hidden");
    }
  });
};

logoutBtn.onclick = () => {
  localStorage.removeItem("rememberedUser");
  location.reload();
};
