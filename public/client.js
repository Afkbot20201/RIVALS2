
const authPanel = document.getElementById("auth-panel");
const logoutBtn = document.getElementById("logout-btn");

// Tabs
document.querySelectorAll(".tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  };
});

const savedUser = localStorage.getItem("rivals2_user");
if (savedUser) {
  authPanel.classList.add("hidden");
  logoutBtn.classList.remove("hidden");
} else {
  authPanel.classList.remove("hidden");
  logoutBtn.classList.add("hidden");
}

logoutBtn.onclick = () => {
  localStorage.removeItem("rivals2_user");
  location.reload();
};
