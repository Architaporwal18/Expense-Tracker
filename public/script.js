// script.js — with JWT Authentication
const API = "http://localhost:3000/api";

let currentUser = null;
let barChart, pieChart;
let currentFilter = { month: "", year: "" };
let allExpenses = [];
let filteredExpenses = [];

// ─────────────────────────────────────────
//  AUTH HELPERS
// ─────────────────────────────────────────
function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getToken()}`
  };
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

// ─────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Check if logged in
  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // Verify token is valid
  try {
    const res = await fetch(`${API}/auth/verify`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) {
      logout();
      return;
    }
    const data = await res.json();
    currentUser = data.user;
  } catch (err) {
    showError("Cannot connect to server.");
    return;
  }

  // Set today's date
  document.getElementById("expenseDate").value = new Date().toISOString().split("T")[0];

  // Show user info in header
  updateUserHeader();

  // Load data
  await loadExpensesAndRender();
});

function updateUserHeader() {
  const nameEl = document.getElementById("userName");
  const avatarEl = document.getElementById("userAvatar");
  if (nameEl) nameEl.textContent = currentUser.name || currentUser.username;
  if (avatarEl) avatarEl.textContent = (currentUser.name || currentUser.username || "U")[0].toUpperCase();
}

// ─────────────────────────────────────────
//  LOAD DATA
// ─────────────────────────────────────────
async function loadExpensesAndRender() {
  if (!currentUser) return;
  try {
    const [expRes, profRes] = await Promise.all([
      fetch(`${API}/expenses`, { headers: authHeaders() }),
      fetch(`${API}/profile`,  { headers: authHeaders() })
    ]);

    if (expRes.status === 401 || expRes.status === 403) { logout(); return; }

    allExpenses = await expRes.json();
    const profile = await profRes.json();
    currentUser = { ...currentUser, ...profile };

    updateFilterDropdowns();
    applyClientFilter();
    renderSummary();
    renderTable();
    renderCharts();
  } catch (err) {
    showError("Failed to load data: " + err.message);
  }
}

// ─────────────────────────────────────────
//  BALANCE
// ─────────────────────────────────────────
async function addBalance() {
  const val = +document.getElementById("income").value;
  if (val <= 0) { alert("Please enter a valid amount!"); return; }

  try {
    const res = await fetch(`${API}/balance`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ amount: val })
    });
    if (res.status === 401) { logout(); return; }
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }

    currentUser.balance = data.balance;
    document.getElementById("income").value = "";
    await loadExpensesAndRender();
    showSuccessMessage(`₹${val} added to balance!`);
  } catch (err) {
    showError("Server error: " + err.message);
  }
}

// ─────────────────────────────────────────
//  EXPENSES
// ─────────────────────────────────────────
async function addExpense() {
  const item = document.getElementById("item").value.trim();
  const amount = +document.getElementById("amount").value;
  const category = document.getElementById("category").value;
  const date = document.getElementById("expenseDate").value;

  if (!item || amount <= 0 || !date) { alert("Please fill all fields with valid data!"); return; }

  try {
    const res = await fetch(`${API}/expenses`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ item, amount, category, date })
    });
    if (res.status === 401) { logout(); return; }
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }

    currentUser.balance = data.balance;
    document.getElementById("item").value = "";
    document.getElementById("amount").value = "";
    document.getElementById("expenseDate").value = new Date().toISOString().split("T")[0];

    await loadExpensesAndRender();
    showSuccessMessage(`Expense "${item}" (₹${amount}) added!`);
  } catch (err) {
    showError("Server error: " + err.message);
  }
}

async function deleteExpense(expenseId, amount) {
  if (!confirm("Are you sure you want to delete this expense?")) return;

  try {
    const res = await fetch(`${API}/expenses/${expenseId}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (res.status === 401) { logout(); return; }
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }

    currentUser.balance = data.balance;
    await loadExpensesAndRender();
    showSuccessMessage(`Expense deleted and ₹${amount} refunded!`);
  } catch (err) {
    showError("Server error: " + err.message);
  }
}

// ─────────────────────────────────────────
//  FILTERS
// ─────────────────────────────────────────
function updateFilterDropdowns() {
  const months = new Set();
  const years = new Set();

  allExpenses.forEach(e => {
    const d = new Date(e.date);
    months.add(d.getMonth());
    years.add(d.getFullYear());
  });

  const monthNames = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"];

  const monthFilter = document.getElementById("monthFilter");
  monthFilter.innerHTML = '<option value="">All Months</option>';
  Array.from(months).sort((a,b)=>a-b).forEach(m => {
    const o = document.createElement("option");
    o.value = m; o.text = monthNames[m];
    if (currentFilter.month !== "" && Number(currentFilter.month) === m) o.selected = true;
    monthFilter.add(o);
  });

  const yearFilter = document.getElementById("yearFilter");
  yearFilter.innerHTML = '<option value="">All Years</option>';
  Array.from(years).sort().forEach(y => {
    const o = document.createElement("option");
    o.value = y; o.text = y;
    if (currentFilter.year !== "" && Number(currentFilter.year) === y) o.selected = true;
    yearFilter.add(o);
  });
}

function applyFilters() {
  currentFilter.month = document.getElementById("monthFilter").value;
  currentFilter.year = document.getElementById("yearFilter").value;
  applyClientFilter();
  renderTable();
  renderCharts();
  updateFilterInfo();
}

function clearFilters() {
  currentFilter = { month: "", year: "" };
  document.getElementById("monthFilter").value = "";
  document.getElementById("yearFilter").value = "";
  applyClientFilter();
  renderTable();
  renderCharts();
  updateFilterInfo();
}

function applyClientFilter() {
  filteredExpenses = allExpenses.filter(e => {
    const d = new Date(e.date);
    const mOk = currentFilter.month === "" || d.getMonth() == currentFilter.month;
    const yOk = currentFilter.year === "" || d.getFullYear() == currentFilter.year;
    return mOk && yOk;
  });
}

// ─────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────
function renderSummary() {
  document.getElementById("balance").innerText = Number(currentUser.balance || 0).toFixed(2);
  document.getElementById("monthlyExpense").innerText = Number(currentUser.thisMonthExpenses || 0).toFixed(2);
  document.getElementById("totalExpense").innerText = Number(currentUser.totalExpenses || 0).toFixed(2);
}

function renderTable() {
  const table = document.getElementById("expenseTable");
  table.innerHTML = "";

  if (filteredExpenses.length === 0) {
    table.innerHTML = '<tr><td colspan="5" class="no-data">No expenses found</td></tr>';
    updateFilterInfo(); return;
  }

  [...filteredExpenses]
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .forEach(e => {
      table.innerHTML += `<tr>
        <td>${e.item}</td>
        <td>${e.category}</td>
        <td>₹${Number(e.amount).toFixed(2)}</td>
        <td>${new Date(e.date).toLocaleDateString()}</td>
        <td><button onclick="deleteExpense(${e.id}, ${e.amount})" style="background:#dc3545;padding:4px 8px;font-size:0.8em;">Delete</button></td>
      </tr>`;
    });
  updateFilterInfo();
}

function updateFilterInfo() {
  const monthNames = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"];
  let info = "";
  if (currentFilter.month !== "" || currentFilter.year !== "") {
    const mText = currentFilter.month !== "" ? monthNames[currentFilter.month] : "All Months";
    const yText = currentFilter.year !== "" ? currentFilter.year : "";
    info = `(Filtered: ${mText} ${yText})`;
  }
  document.getElementById("filterInfo").innerText = info;
}

function renderCharts() {
  const source = (currentFilter.month !== "" || currentFilter.year !== "")
    ? filteredExpenses : allExpenses;

  const monthly = {};
  source.forEach(e => {
    const month = e.date.toString().slice(0, 7);
    monthly[month] = (monthly[month] || 0) + Number(e.amount);
  });

  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById("expenseChart"), {
    type: "bar",
    data: {
      labels: Object.keys(monthly).sort(),
      datasets: [{
        label: "Monthly Expenses (₹)",
        data: Object.values(monthly),
        backgroundColor: "rgba(102, 126, 234, 0.6)",
        borderColor: "rgba(102, 126, 234, 1)",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true } }
    }
  });

  const categories = {};
  source.forEach(e => {
    categories[e.category] = (categories[e.category] || 0) + Number(e.amount);
  });

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(document.getElementById("categoryChart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(categories),
      datasets: [{
        data: Object.values(categories),
        backgroundColor: ["#FF6384","#36A2EB","#FFCE56","#4CAF50","#9966FF","#FF9F40","#FF6B6B"]
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } }
    }
  });
}

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────
function showSuccessMessage(message) {
  const msgDiv = document.getElementById("successMessage");
  msgDiv.textContent = message;
  msgDiv.style.background = "#d4edda";
  msgDiv.style.color = "#155724";
  msgDiv.style.borderColor = "#c3e6cb";
  msgDiv.style.display = "block";
  setTimeout(() => { msgDiv.style.display = "none"; }, 3000);
}

function showError(message) {
  console.error(message);
  const msgDiv = document.getElementById("successMessage");
  msgDiv.textContent = "⚠️ " + message;
  msgDiv.style.background = "#f8d7da";
  msgDiv.style.color = "#721c24";
  msgDiv.style.borderColor = "#f5c6cb";
  msgDiv.style.display = "block";
  setTimeout(() => { msgDiv.style.display = "none"; }, 5000);
}
