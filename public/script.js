// script.js — talks to the Node.js + MySQL backend
const API = "http://localhost:3000/api";

let users = [];          // array of user objects from DB
let currentUser = null;  // { id, name, balance }
let barChart, pieChart;
let currentFilter = { month: "", year: "" };

// ─────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("expenseDate").value = new Date().toISOString().split("T")[0];
  await loadUsers();
});

// ─────────────────────────────────────────
//  USERS
// ─────────────────────────────────────────
async function loadUsers() {
  try {
    const res = await fetch(`${API}/users`);
    users = await res.json();
    updateUserDropdown();
    if (users.length > 0) {
      currentUser = users[0];
      await loadExpensesAndRender();
    }
  } catch (err) {
    showError("Cannot connect to server. Is the backend running?");
  }
}

function updateUserDropdown() {
  const userSelect = document.getElementById("userSelect");
  userSelect.innerHTML = "";
  users.forEach((u) => {
    const option = document.createElement("option");
    option.value = u.id;
    option.text = u.name;
    if (currentUser && u.id === currentUser.id) option.selected = true;
    userSelect.add(option);
  });
  userSelect.onchange = async () => {
    currentUser = users.find((u) => u.id == userSelect.value);
    currentFilter = { month: "", year: "" };
    await loadExpensesAndRender();
  };
}

async function addUser() {
  const name = prompt("Enter User Name:");
  if (!name || !name.trim()) return;

  try {
    const res = await fetch(`${API}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to add user");
      return;
    }
    users.push(data);
    currentUser = data;
    updateUserDropdown();
    await loadExpensesAndRender();
    showSuccessMessage(`User "${data.name}" added successfully!`);
  } catch (err) {
    showError("Server error: " + err.message);
  }
}

// ─────────────────────────────────────────
//  BALANCE
// ─────────────────────────────────────────
async function addBalance() {
  if (!currentUser) { alert("Please select or add a user first!"); return; }
  const val = +document.getElementById("income").value;
  if (val <= 0) { alert("Please enter a valid amount!"); return; }

  try {
    const res = await fetch(`${API}/users/${currentUser.id}/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: val }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }

    currentUser.balance = data.balance;
    updateUserInList(data);
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
let allExpenses = [];   // full expense list for current user
let filteredExpenses = []; // after applying month/year filter

async function loadExpensesAndRender() {
  if (!currentUser) return;
  try {
    // Load ALL expenses for filter dropdowns and chart
    const res = await fetch(`${API}/users/${currentUser.id}/expenses`);
    allExpenses = await res.json();

    // Load summary (balance, monthly, total)
    const summaryRes = await fetch(`${API}/users/${currentUser.id}/summary`);
    const summary = await summaryRes.json();
    currentUser.balance = summary.balance;

    updateFilterDropdowns();
    applyClientFilter();
    renderSummary(summary);
    renderTable();
    renderCharts();
  } catch (err) {
    showError("Failed to load expenses: " + err.message);
  }
}

async function addExpense() {
  const item = document.getElementById("item").value.trim();
  const amount = +document.getElementById("amount").value;
  const category = document.getElementById("category").value;
  const date = document.getElementById("expenseDate").value;

  if (!currentUser) { alert("Please select or add a user first!"); return; }
  if (!item || amount <= 0 || !date) { alert("Please fill all fields with valid data!"); return; }

  try {
    const res = await fetch(`${API}/users/${currentUser.id}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item, amount, category, date }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }

    currentUser.balance = data.user.balance;
    updateUserInList(data.user);

    document.getElementById("item").value = "";
    document.getElementById("amount").value = "";
    document.getElementById("expenseDate").value = new Date().toISOString().split("T")[0];

    await loadExpensesAndRender();
    showSuccessMessage(`Expense "${item}" (₹${amount}) added successfully!`);
  } catch (err) {
    showError("Server error: " + err.message);
  }
}

async function deleteExpense(expenseId, amount) {
  if (!confirm("Are you sure you want to delete this expense?")) return;

  try {
    const res = await fetch(`${API}/users/${currentUser.id}/expenses/${expenseId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }

    currentUser.balance = data.user.balance;
    updateUserInList(data.user);
    await loadExpensesAndRender();
    showSuccessMessage(`Expense deleted and ₹${amount} refunded!`);
  } catch (err) {
    showError("Server error: " + err.message);
  }
}

// ─────────────────────────────────────────
//  FILTERS (client-side on already-loaded data)
// ─────────────────────────────────────────
function updateFilterDropdowns() {
  const months = new Set();
  const years = new Set();

  allExpenses.forEach((e) => {
    const d = new Date(e.date);
    months.add(d.getMonth());   // 0-11
    years.add(d.getFullYear());
  });

  const monthNames = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"];

  const monthFilter = document.getElementById("monthFilter");
  monthFilter.innerHTML = '<option value="">All Months</option>';
  Array.from(months).sort((a,b)=>a-b).forEach((m) => {
    const o = document.createElement("option");
    o.value = m; o.text = monthNames[m];
    if (currentFilter.month !== "" && Number(currentFilter.month) === m) o.selected = true;
    monthFilter.add(o);
  });

  const yearFilter = document.getElementById("yearFilter");
  yearFilter.innerHTML = '<option value="">All Years</option>';
  Array.from(years).sort().forEach((y) => {
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
  filteredExpenses = allExpenses.filter((e) => {
    const d = new Date(e.date);
    const mOk = currentFilter.month === "" || d.getMonth() == currentFilter.month;
    const yOk = currentFilter.year === "" || d.getFullYear() == currentFilter.year;
    return mOk && yOk;
  });
}

// ─────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────
function renderSummary(summary) {
  document.getElementById("balance").innerText = Number(summary.balance).toFixed(2);
  document.getElementById("monthlyExpense").innerText = Number(summary.thisMonthExpenses).toFixed(2);
  document.getElementById("totalExpense").innerText = Number(summary.totalExpenses).toFixed(2);
}

function renderTable() {
  const table = document.getElementById("expenseTable");
  table.innerHTML = "";

  if (filteredExpenses.length === 0) {
    table.innerHTML = '<tr><td colspan="5" class="no-data">No expenses found</td></tr>';
    return;
  }

  [...filteredExpenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((e) => {
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
    ? filteredExpenses
    : allExpenses;

  // Monthly bar chart
  const monthly = {};
  source.forEach((e) => {
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
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true } },
    },
  });

  // Category doughnut chart
  const categories = {};
  source.forEach((e) => {
    categories[e.category] = (categories[e.category] || 0) + Number(e.amount);
  });

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(document.getElementById("categoryChart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(categories),
      datasets: [{
        data: Object.values(categories),
        backgroundColor: ["#FF6384","#36A2EB","#FFCE56","#4CAF50","#9966FF","#FF9F40","#FF6B6B"],
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
    },
  });
}

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────
function updateUserInList(updatedUser) {
  const idx = users.findIndex((u) => u.id === updatedUser.id);
  if (idx !== -1) users[idx] = updatedUser;
}

function showSuccessMessage(message) {
  const msgDiv = document.getElementById("successMessage");
  msgDiv.textContent = message;
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
