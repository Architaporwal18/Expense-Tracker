# 💰 Expense Tracker — Node.js + MySQL Backend

## Project Structure

```
expense-tracker-backend/
├── server.js          ← Express API server
├── db.js              ← MySQL connection pool
├── database.sql       ← DB schema (run once)
├── package.json
├── .env               ← Your DB credentials (edit this)
└── public/            ← Frontend files served by Express
    ├── index.html
    ├── style.css
    └── script.js
```

---

## Setup Instructions

### 1. Install MySQL
Make sure MySQL is installed and running on your machine.

### 2. Create the Database
Open MySQL and run:
```bash
mysql -u root -p < database.sql
```
Or paste the contents of `database.sql` into MySQL Workbench / phpMyAdmin.

### 3. Configure Environment Variables
Edit `.env` with your MySQL credentials:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_password
DB_NAME=expense_tracker
PORT=3000
```

### 4. Install Dependencies
```bash
npm install
```

### 5. Start the Server
```bash
# Production
npm start

# Development (auto-restarts on changes)
npm run dev
```

### 6. Open the App
Visit **http://localhost:3000** in your browser.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users |
| POST | `/api/users` | Create a user `{ name }` |
| DELETE | `/api/users/:id` | Delete a user |
| POST | `/api/users/:id/balance` | Add balance `{ amount }` |
| GET | `/api/users/:id/expenses` | Get expenses (optional `?month=0-11&year=2024`) |
| POST | `/api/users/:id/expenses` | Add expense `{ item, amount, category, date }` |
| DELETE | `/api/users/:userId/expenses/:expenseId` | Delete expense + refund |
| GET | `/api/users/:id/summary` | Get balance + monthly/total totals |
