/**
 * K8s Python Demo — Frontend Logic
 * Calls the FastAPI backend through the Kubernetes Service.
 *
 * The backend URL is resolved via the Nginx reverse-proxy rule
 * defined in nginx.conf:  /api/* → http://python-backend-svc:8000
 */

const API_BASE = "/api";

// ---------- Helpers ----------

function renderJSON(elementId, data) {
  const el = document.getElementById(elementId);
  el.innerHTML = "";
  el.textContent = JSON.stringify(data, null, 2);
}

function showError(elementId, err) {
  const el = document.getElementById(elementId);
  el.innerHTML = `<span style="color:#ff4d6a">Error: ${err.message}</span>`;
}

// Deterministic color from hostname string
function hostnameColor(hostname) {
  let hash = 0;
  for (const ch of hostname) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 55%)`;
}

// ---------- API Calls ----------

async function callApi() {
  try {
    const res = await fetch(`${API_BASE}/hello`);
    const data = await res.json();
    renderJSON("response", data);
  } catch (e) {
    showError("response", e);
  }
}

async function loadItems() {
  try {
    const res = await fetch(`${API_BASE}/items`);
    const data = await res.json();
    const itemList = document.getElementById("itemList");
    if (data.error) {
        itemList.innerHTML = `<li style="color:#ff4d6a">Error: ${data.error}</li>`;
        return;
    }
    itemList.innerHTML = data.map(item => `<li>${item}</li>`).join("");
  } catch (e) {
    const itemList = document.getElementById("itemList");
    itemList.innerHTML = `<li style="color:#ff4d6a">Error: ${e.message}</li>`;
  }
}

async function addItem() {
  const nameInput = document.getElementById("itemName");
  const name = nameInput.value;
  if (!name) return;
  
  try {
    await fetch(`${API_BASE}/items?name=${encodeURIComponent(name)}`, { method: "POST" });
    nameInput.value = "";
    loadItems(); // Refresh the list
  } catch (e) {
    console.error("Failed to add item:", e);
  }
}

// Load items initially
document.addEventListener("DOMContentLoaded", () => {
    loadItems();
});

async function fetchInfo() {
  try {
    const res = await fetch(`${API_BASE}/info`);
    const data = await res.json();
    renderJSON("info", data);
  } catch (e) {
    showError("info", e);
  }
}

async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    renderJSON("health", data);
  } catch (e) {
    showError("health", e);
  }
}

// ---------- Load-Balancing Demo ----------

async function loadBalanceDemo() {
  const grid = document.getElementById("lb-results");
  grid.innerHTML = "";

  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch(`${API_BASE}/hello`);
      const data = await res.json();
      const chip = document.createElement("div");
      chip.className = "lb-chip";
      chip.style.animationDelay = `${i * 0.06}s`;
      chip.style.borderColor = hostnameColor(data.hostname);
      chip.style.color = hostnameColor(data.hostname);
      chip.textContent = data.hostname;
      grid.appendChild(chip);
    } catch (e) {
      const chip = document.createElement("div");
      chip.className = "lb-chip";
      chip.style.borderColor = "#ff4d6a";
      chip.style.color = "#ff4d6a";
      chip.textContent = "error";
      grid.appendChild(chip);
    }
  }
}
