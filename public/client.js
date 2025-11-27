
const socket = io();

const loginTab = document.getElementById("tab-login");
const registerTab = document.getElementById("tab-register");
const forgotTab = document.getElementById("tab-forgot");

const loginPane = document.getElementById("login-tab");
const registerPane = document.getElementById("register-tab");
const forgotPane = document.getElementById("forgot-tab");

function showTab(tab) {
  [loginPane, registerPane, forgotPane].forEach(p => p.classList.add("hidden"));
  [loginTab, registerTab, forgotTab].forEach(b => b.classList.remove("active"));
  tab.pane.classList.remove("hidden");
  tab.btn.classList.add("active");
}

loginTab.onclick = () => showTab({ pane: loginPane, btn: loginTab });
registerTab.onclick = () => showTab({ pane: registerPane, btn: registerTab });
forgotTab.onclick = () => showTab({ pane: forgotPane, btn: forgotTab });

const authError = document.getElementById("authError");
function setError(msg){
  if(!msg){authError.classList.add("hidden");authError.textContent="";}
  else{authError.classList.remove("hidden");authError.textContent=msg;}
}

document.getElementById("loginBtn").onclick = () => {
  socket.emit("login", {
    username: document.getElementById("login-user").value,
    password: document.getElementById("login-pass").value
  }, res => {
    if(!res.ok) return setError(res.error);
    localStorage.setItem("rivals2_user", res.username);
    location.reload();
  });
};

document.getElementById("registerBtn").onclick = () => {
  const pass = document.getElementById("reg-pass").value;
  const conf = document.getElementById("reg-confirm").value;
  if(pass !== conf) return setError("Passwords do not match");

  socket.emit("register", {
    username: document.getElementById("reg-user").value,
    password: pass,
    email: document.getElementById("reg-email").value
  }, res => {
    if(!res.ok) return setError(res.error);
    setError("Registered! Switch to Login.");
  });
};

document.getElementById("forgotBtn").onclick = () => {
  socket.emit("requestPasswordReset", {
    email: document.getElementById("forgot-email").value
  }, r => alert(r.ok ? "Reset email sent!" : "Email not found"));
};
