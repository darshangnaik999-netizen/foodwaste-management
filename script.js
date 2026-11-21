
// ==========================================
// SUSTAINFOOD AI - MAIN JAVASCRIPT
// ==========================================

const STORAGE = {
  records: "sustainfood_records",
  menu: "sustainfood_menu",
  inventory: "sustainfood_inventory",
  donations: "sustainfood_donations"
};

function loadData(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

let records = loadData(STORAGE.records);
let menuItems = loadData(STORAGE.menu);
let inventory = loadData(STORAGE.inventory);
let donations = loadData(STORAGE.donations);

let foodChartInstance = null;
let wasteChartInstance = null;

const $ = id => document.getElementById(id);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date) {
  if (!date) return "-";
  return new Date(date + "T00:00:00").toLocaleDateString("en-IN");
}

// ==========================================
// PAGE NAVIGATION
// ==========================================

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  const titles = {
    dashboard: "Dashboard",
    prediction: "AI Prediction",
    records: "Food Records",
    menu: "Menu Planner",
    inventory: "Inventory Management",
    donations: "Food Donations",
    analytics: "Analytics"
  };

  $("pageTitle").textContent = titles[pageId] || "Dashboard";

  if (pageId === "analytics") updateAnalytics();
  if (pageId === "inventory") renderInventory();
  if (pageId === "donations") renderDonations();
}

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

// ==========================================
// DASHBOARD
// ==========================================

function getTotals() {
  return records.reduce((totals, record) => {
    totals.prepared += Number(record.prepared);
    totals.consumed += Number(record.consumed);
    totals.leftover += Number(record.prepared) - Number(record.consumed);
    return totals;
  }, { prepared: 0, consumed: 0, leftover: 0 });
}

function updateDashboard() {
  const totals = getTotals();
  const waste = totals.prepared > 0
    ? (totals.leftover / totals.prepared) * 100
    : 0;

  $("preparedTotal").textContent = totals.prepared;
  $("consumedTotal").textContent = totals.consumed;
  $("leftoverTotal").textContent = totals.leftover;
  $("wastePercent").textContent = waste.toFixed(1) + "%";

  // Use the most recent record to provide a simple dashboard estimate.
  const latest = [...records].sort((a, b) =>
    b.date.localeCompare(a.date)
  )[0];

  $("dashboardPrediction").textContent =
    latest ? Math.ceil(Number(latest.attendance) * 0.9) : "--";

  const recent = [...records]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  $("recentRecords").innerHTML = recent.length
    ? recent.map(record => {
        const leftover = Number(record.prepared) - Number(record.consumed);
        return `
          <tr>
            <td>${formatDate(record.date)}</td>
            <td>${escapeHTML(record.menu)}</td>
            <td>${record.prepared}</td>
            <td>${record.consumed}</td>
            <td>${leftover}</td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="5">No records yet. Add your first food record.</td></tr>`;

  updateFoodChart();
}

function refreshDashboard() {
  updateDashboard();
  renderRecords();
  updateAnalytics();
}

$("currentDate").textContent = new Date().toLocaleDateString("en-IN", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric"
});

// ==========================================
// FOOD RECORDS
// ==========================================

$("recordDate").value = today();

$("recordForm").addEventListener("submit", function(event) {
  event.preventDefault();

  const prepared = Number($("recordPrepared").value);
  const consumed = Number($("recordConsumed").value);
  const attendance = Number($("recordAttendance").value);

  if (consumed > prepared) {
    alert("Consumed food cannot be greater than prepared food.");
    return;
  }

  const record = {
    id: Date.now(),
    date: $("recordDate").value,
    menu: $("recordMenu").value.trim(),
    attendance,
    prepared,
    consumed
  };

  records.push(record);
  saveData(STORAGE.records, records);

  this.reset();
  $("recordDate").value = today();

  refreshDashboard();
  alert("Food record saved successfully!");
});

function renderRecords() {
  $("recordsTable").innerHTML = records.length
    ? [...records].sort((a, b) => b.date.localeCompare(a.date))
      .map(record => {
        const leftover = Number(record.prepared) - Number(record.consumed);
        return `
          <tr>
            <td>${formatDate(record.date)}</td>
            <td>${escapeHTML(record.menu)}</td>
            <td>${record.attendance}</td>
            <td>${record.prepared}</td>
            <td>${record.consumed}</td>
            <td>${leftover}</td>
            <td><button class="delete-btn" onclick="deleteRecord(${record.id})">Delete</button></td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="7">No food records available.</td></tr>`;
}

function deleteRecord(id) {
  if (!confirm("Delete this food record?")) return;
  records = records.filter(record => record.id !== id);
  saveData(STORAGE.records, records);
  refreshDashboard();
}

// ==========================================
// AI FOOD PREDICTION - DEMO CALCULATION
// ==========================================

$("predictionForm").addEventListener("submit", function(event) {
  event.preventDefault();

  const attendance = Number($("attendance").value);
  const previous = Number($("previousConsumption").value);
  const adjustment = Number($("demandChange").value);

  if (attendance <= 0 || previous < 0) {
    alert("Please enter valid attendance and consumption values.");
    return;
  }

  // Transparent demonstration formula:
  // 60% attendance-based estimate + 40% previous consumption.
  const attendanceEstimate = attendance * 0.9;
  const baseEstimate = (attendanceEstimate * 0.6) + (previous * 0.4);
  const prediction = Math.max(
    0,
    Math.ceil(baseEstimate * (1 + adjustment / 100))
  );

  $("predictionResult").textContent = prediction + " meals";
  $("predictionExplanation").textContent =
    `For ${attendance} expected attendees and ${$("mealType").value.toLowerCase()}, ` +
    `the suggested preparation is approximately ${prediction} meals. ` +
    `Menu: ${$("predictionMenu").value}.`;

  $("dashboardPrediction").textContent = prediction;
});

// ==========================================
// FOOD CONSUMPTION CHART
// ==========================================

function updateFoodChart() {
  const canvas = $("foodChart");
  if (!canvas || typeof Chart === "undefined") return;

  const latest = [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);

  const labels = latest.map(record => formatDate(record.date));
  const prepared = latest.map(record => Number(record.prepared));
  const consumed = latest.map(record => Number(record.consumed));

  if (foodChartInstance) foodChartInstance.destroy();

  foodChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Prepared",
          data: prepared,
          backgroundColor: "#8bd5a8",
          borderRadius: 5
        },
        {
          label: "Consumed",
          data: consumed,
          backgroundColor: "#168653",
          borderRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// ==========================================
// ANALYTICS
// ==========================================

function updateAnalytics() {
  const canvas = $("wasteChart");
  const totals = getTotals();

  const waste = totals.prepared
    ? (totals.leftover / totals.prepared) * 100
    : 0;

  $("analyticsPrepared").textContent = totals.prepared;
  $("analyticsConsumed").textContent = totals.consumed;
  $("analyticsLeftover").textContent = totals.leftover;
  $("analyticsWaste").textContent = waste.toFixed(1) + "%";

  if (!canvas || typeof Chart === "undefined") return;

  if (wasteChartInstance) wasteChartInstance.destroy();

  wasteChartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Consumed", "Leftover"],
      datasets: [{
        data: [totals.consumed, totals.leftover],
        backgroundColor: ["#168653", "#f2b45d"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } }
    }
  });
}

// ==========================================
// MENU PLANNER
// ==========================================

$("menuForm").addEventListener("submit", function(event) {
  event.preventDefault();

  const name = $("menuName").value.trim();
  const category = $("menuCategory").value;

  if (!name) return;

  menuItems.push({ id: Date.now(), name, category });
  saveData(STORAGE.menu, menuItems);

  this.reset();
  renderMenu();
});

function renderMenu() {
  $("menuList").innerHTML = menuItems.length
    ? menuItems.map(item => `
        <div class="menu-item">
          <div>
            <strong>🍲 ${escapeHTML(item.name)}</strong>
            <small>${escapeHTML(item.category)}</small>
          </div>
          <button class="delete-btn" onclick="deleteMenu(${item.id})">Remove</button>
        </div>
      `).join("")
    : `<div class="panel">No menu items added yet.</div>`;
}

function deleteMenu(id) {
  menuItems = menuItems.filter(item => item.id !== id);
  saveData(STORAGE.menu, menuItems);
  renderMenu();
}

// ==========================================
// INVENTORY MANAGEMENT
// ==========================================

$("inventoryForm").addEventListener("submit", function(event) {
  event.preventDefault();

  inventory.push({
    id: Date.now(),
    name: $("ingredientName").value.trim(),
    quantity: Number($("ingredientQty").value),
    unit: $("ingredientUnit").value,
    expiry: $("ingredientExpiry").value
  });

  saveData(STORAGE.inventory, inventory);
  this.reset();
  renderInventory();
});

function renderInventory() {
  $("inventoryTable").innerHTML = inventory.length
    ? inventory.map(item => {
        const daysLeft = Math.ceil(
          (new Date(item.expiry + "T00:00:00") - new Date(today() + "T00:00:00"))
          / 86400000
        );

        let status = "Good";
        if (daysLeft < 0) status = "Expired";
        else if (daysLeft <= 7) status = "Expiring soon";
        if (Number(item.quantity) === 0) status = "Out of stock";

        return `
          <tr>
            <td>${escapeHTML(item.name)}</td>
            <td>${item.quantity} ${escapeHTML(item.unit)}</td>
            <td>${formatDate(item.expiry)}</td>
            <td>${status}</td>
            <td><button class="delete-btn" onclick="deleteIngredient(${item.id})">Delete</button></td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="5">No ingredients added.</td></tr>`;
}

function deleteIngredient(id) {
  inventory = inventory.filter(item => item.id !== id);
  saveData(STORAGE.inventory, inventory);
  renderInventory();
}

// ==========================================
// SURPLUS FOOD DONATIONS
// ==========================================

$("donationForm").addEventListener("submit", function(event) {
  event.preventDefault();

  donations.push({
    id: Date.now(),
    food: $("donationFood").value.trim(),
    quantity: Number($("donationQty").value),
    expiry: $("donationExpiry").value,
    contact: $("donationContact").value.trim()
  });

  saveData(STORAGE.donations, donations);
  this.reset();
  renderDonations();
  alert("Surplus food entry saved!");
});

function renderDonations() {
  $("donationList").innerHTML = donations.length
    ? donations.map(item => `
        <div class="donation-item">
          <div>
            <strong>♡ ${escapeHTML(item.food)} — ${item.quantity} meals</strong>
            <small>Available until: ${new Date(item.expiry).toLocaleString("en-IN")}</small>
            <small>Contact: ${escapeHTML(item.contact)}</small>
          </div>
          <button class="delete-btn" onclick="deleteDonation(${item.id})">Remove</button>
        </div>
      `).join("")
    : `<div class="panel">No surplus food entries yet.</div>`;
}

function deleteDonation(id) {
  donations = donations.filter(item => item.id !== id);
  saveData(STORAGE.donations, donations);
  renderDonations();
}

// ==========================================
// EXPORT FOOD RECORDS TO CSV
// ==========================================

$("exportRecords").addEventListener("click", function() {
  if (!records.length) {
    alert("There are no records to export.");
    return;
  }

  const header = ["Date", "Menu", "Attendance", "Prepared", "Consumed", "Leftover"];
  const rows = records.map(record => [
    record.date,
    record.menu,
    record.attendance,
    record.prepared,
    record.consumed,
    Number(record.prepared) - Number(record.consumed)
  ]);

  const csv = [header, ...rows]
    .map(row => row.map(value =>
      `"${String(value).replace(/"/g, '""')}"`
    ).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sustainfood-records.csv";
  link.click();
  URL.revokeObjectURL(url);
});

// ==========================================
// SMALL UTILITIES
// ==========================================

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

$("logoutBtn").addEventListener("click", () => {
  alert("This is a project demo. No real account session is connected.");
});

// ==========================================
// INITIAL PAGE LOAD
// ==========================================

renderRecords();
renderMenu();
renderInventory();
renderDonations();
refreshDashboard();

// ==========================================
// DEMO ADMIN LOGIN
// ==========================================

// Demo credentials only.
// This is NOT secure authentication.
const DEMO_USERNAME = "admin";
const DEMO_PASSWORD = "food123";

$("loginForm").addEventListener("submit", function(event) {
  event.preventDefault();

  const username = $("adminUsername").value.trim();
  const password = $("adminPassword").value;

  if (
    username === DEMO_USERNAME &&
    password === DEMO_PASSWORD
  ) {
    $("loginScreen").style.display = "none";
    document.body.classList.remove("login-active");
    $("loginError").textContent = "";
    showPage("dashboard");
  } else {
    $("loginError").textContent =
      "Invalid username or password. Try again.";
  }
});

$("logoutBtn").addEventListener("click", function() {
  $("loginScreen").style.display = "flex";
  document.body.classList.add("login-active");
  $("loginForm").reset();
  $("loginError").textContent = "";
});

// Show login when website first opens
$("loginScreen").style.display = "flex";
document.body.classList.add("login-active");
