
    let data = JSON.parse(localStorage.getItem("expenseData")) || {users:{}};
    let currentUser = null;
    let barChart, pieChart;
    let currentFilter = { month: '', year: '' };

    // Set today's date as default
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];

    function updateUserDropdown() {
      let userSelect = document.getElementById("userSelect");
      userSelect.innerHTML = "";
      for (let u in data.users) {
        let option = document.createElement("option");
        option.value = u; option.text = u;
        if (u === currentUser) option.selected = true;
        userSelect.add(option);
      }
      userSelect.onchange = () => { 
        currentUser = userSelect.value; 
        updateFilterDropdowns();
        render(); 
      };
      
      // Auto-select first user if no current user
      if (!currentUser && Object.keys(data.users).length > 0) {
        currentUser = Object.keys(data.users)[0];
      }
    }

    function updateFilterDropdowns() {
      if (!currentUser) return;
      
      let months = new Set();
      let years = new Set();
      
      data.users[currentUser].expenses.forEach(e => {
        let date = new Date(e.date);
        months.add(date.getMonth());
        years.add(date.getFullYear());
      });

      // Update month filter
      let monthFilter = document.getElementById("monthFilter");
      monthFilter.innerHTML = '<option value="">All Months</option>';
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
      
      Array.from(months).sort().forEach(month => {
        let option = document.createElement("option");
        option.value = month;
        option.text = monthNames[month];
        monthFilter.add(option);
      });

      // Update year filter
      let yearFilter = document.getElementById("yearFilter");
      yearFilter.innerHTML = '<option value="">All Years</option>';
      Array.from(years).sort().forEach(year => {
        let option = document.createElement("option");
        option.value = year;
        option.text = year;
        yearFilter.add(option);
      });
    }

    function addUser() {
      let name = prompt("Enter User Name:");
      if (!name || data.users[name]) {
        if (data.users[name]) alert("User already exists!");
        return;
      }
      data.users[name] = {balance: 0, expenses: []};
      currentUser = name;
      save(); 
      updateUserDropdown(); 
      updateFilterDropdowns();
      render();
      showSuccessMessage(`User "${name}" added successfully!`);
    }

    function addBalance() {
      let val = +document.getElementById("income").value;
      if (!currentUser) {
        alert("Please select or add a user first!");
        return;
      }
      if (val <= 0) {
        alert("Please enter a valid amount!");
        return;
      }
      data.users[currentUser].balance += val;
      document.getElementById("income").value = ""; // Clear input
      save(); 
      render();
      showSuccessMessage(`₹${val} added to balance!`);
    }

    function addExpense() {
      let item = document.getElementById("item").value;
      let amount = +document.getElementById("amount").value;
      let category = document.getElementById("category").value;
      let date = document.getElementById("expenseDate").value;
      
      if (!currentUser) {
        alert("Please select or add a user first!");
        return;
      }
      if (!item || amount <= 0 || !date) {
        alert("Please fill all fields with valid data!");
        return;
      }
      
      data.users[currentUser].expenses.push({item, amount, category, date});
      data.users[currentUser].balance -= amount;
      
      // Clear all input fields
      document.getElementById("item").value = "";
      document.getElementById("amount").value = "";
      document.getElementById("expenseDate").value = new Date().toISOString().split('T')[0];
      
      save(); 
      updateFilterDropdowns();
      render();
      showSuccessMessage(`Expense "${item}" (₹${amount}) added successfully!`);
    }

    function deleteExpense(index) {
      if (!confirm("Are you sure you want to delete this expense?")) return;
      
      let expense = getFilteredExpenses()[index];
      let originalIndex = data.users[currentUser].expenses.findIndex(e => 
        e.item === expense.item && e.amount === expense.amount && e.date === expense.date
      );
      
      data.users[currentUser].balance += expense.amount; // Refund amount
      data.users[currentUser].expenses.splice(originalIndex, 1);
      
      save();
      updateFilterDropdowns();
      render();
      showSuccessMessage(`Expense deleted and ₹${expense.amount} refunded!`);
    }

    function getFilteredExpenses() {
      if (!currentUser) return [];
      
      return data.users[currentUser].expenses.filter(e => {
        let date = new Date(e.date);
        let monthMatch = currentFilter.month === '' || date.getMonth() == currentFilter.month;
        let yearMatch = currentFilter.year === '' || date.getFullYear() == currentFilter.year;
        return monthMatch && yearMatch;
      });
    }

    function applyFilters() {
      currentFilter.month = document.getElementById("monthFilter").value;
      currentFilter.year = document.getElementById("yearFilter").value;
      render();
    }

    function clearFilters() {
      currentFilter = { month: '', year: '' };
      document.getElementById("monthFilter").value = '';
      document.getElementById("yearFilter").value = '';
      render();
    }

    function render() {
      if (!currentUser) return;
      
      // Update balance and summary
      document.getElementById("balance").innerText = data.users[currentUser].balance.toFixed(2);
      
      // Calculate this month's expenses
      let thisMonth = new Date().getMonth();
      let thisYear = new Date().getFullYear();
      let thisMonthExpenses = data.users[currentUser].expenses
        .filter(e => {
          let date = new Date(e.date);
          return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
        })
        .reduce((sum, e) => sum + e.amount, 0);
      
      document.getElementById("monthlyExpense").innerText = thisMonthExpenses.toFixed(2);
      
      // Calculate total expenses
      let totalExpenses = data.users[currentUser].expenses.reduce((sum, e) => sum + e.amount, 0);
      document.getElementById("totalExpense").innerText = totalExpenses.toFixed(2);
      
      // Update filter info
      let filterInfo = "";
      if (currentFilter.month !== '' || currentFilter.year !== '') {
        const monthNames = ["January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"];
        let monthText = currentFilter.month !== '' ? monthNames[currentFilter.month] : 'All Months';
        let yearText = currentFilter.year !== '' ? currentFilter.year : 'All Years';
        filterInfo = `(Filtered: ${monthText} ${yearText !== 'All Years' ? yearText : ''})`;
      }
      document.getElementById("filterInfo").innerText = filterInfo;
      
      // Render expense table
      let table = document.getElementById("expenseTable");
      table.innerHTML = "";
      let filteredExpenses = getFilteredExpenses();
      
      if (filteredExpenses.length === 0) {
        table.innerHTML = '<tr><td colspan="5" class="no-data">No expenses found</td></tr>';
      } else {
        filteredExpenses
          .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date, newest first
          .forEach((e, index) => {
            table.innerHTML += `<tr>
              <td>${e.item}</td>
              <td>${e.category}</td>
              <td>₹${e.amount}</td>
              <td>${new Date(e.date).toLocaleDateString()}</td>
              <td><button onclick="deleteExpense(${index})" style="background: #dc3545; padding: 4px 8px; font-size: 0.8em;">Delete</button></td>
            </tr>`;
          });
      }
      
      renderCharts();
    }

    function renderCharts() {
      let expenses = currentFilter.month !== '' || currentFilter.year !== '' 
        ? getFilteredExpenses() 
        : data.users[currentUser].expenses;

      // Monthly Expenses Chart
      let monthly = {};
      expenses.forEach(e => {
        let month = e.date.slice(0, 7); // yyyy-mm
        monthly[month] = (monthly[month] || 0) + e.amount;
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
          plugins: {
            legend: { display: true }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });

      // Category Breakdown Chart
      let categories = {};
      expenses.forEach(e => {
        categories[e.category] = (categories[e.category] || 0) + e.amount;
      });

      if (pieChart) pieChart.destroy();
      pieChart = new Chart(document.getElementById("categoryChart"), {
        type: "doughnut",
        data: {
          labels: Object.keys(categories),
          datasets: [{
            data: Object.values(categories), 
            backgroundColor: [
              "#FF6384", "#36A2EB", "#FFCE56", "#4CAF50", "#9966FF", "#FF9F40", "#FF6B6B"
            ]
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }

    function showSuccessMessage(message) {
      let msgDiv = document.getElementById("successMessage");
      msgDiv.textContent = message;
      msgDiv.style.display = "block";
      setTimeout(() => {
        msgDiv.style.display = "none";
      }, 3000);
    }

    function save() {
      localStorage.setItem("expenseData", JSON.stringify(data));
    }

    // Initialize
    updateUserDropdown();
    updateFilterDropdowns();
    render();