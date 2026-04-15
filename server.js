// // server.js - Main Express server
// const express = require("express");
// const cors = require("cors");
// require("dotenv").config();

// const db = require("./db");

// const app = express();
// app.use(cors());
// app.use(express.json());

// // Serve static frontend files
// app.use(express.static("public"));

// const PORT = process.env.PORT || 3000;

// // ─────────────────────────────────────────
// //  USER ROUTES
// // ─────────────────────────────────────────

// // GET all users
// app.get("/api/users", async (req, res) => {
//   try {
//     const [rows] = await db.query("SELECT * FROM users ORDER BY name ASC");
//     res.json(rows);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // POST create a new user
// app.post("/api/users", async (req, res) => {
//   const { name } = req.body;
//   if (!name || !name.trim()) {
//     return res.status(400).json({ error: "User name is required" });
//   }
//   try {
//     const [result] = await db.query(
//       "INSERT INTO users (name, balance) VALUES (?, 0)",
//       [name.trim()]
//     );
//     const [newUser] = await db.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
//     res.status(201).json(newUser[0]);
//   } catch (err) {
//     if (err.code === "ER_DUP_ENTRY") {
//       return res.status(409).json({ error: "User already exists" });
//     }
//     res.status(500).json({ error: err.message });
//   }
// });

// // DELETE a user
// app.delete("/api/users/:id", async (req, res) => {
//   try {
//     await db.query("DELETE FROM users WHERE id = ?", [req.params.id]);
//     res.json({ message: "User deleted successfully" });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // ─────────────────────────────────────────
// //  BALANCE ROUTES
// // ─────────────────────────────────────────

// // POST add balance to a user
// app.post("/api/users/:id/balance", async (req, res) => {
//   const { amount } = req.body;
//   const userId = req.params.id;

//   if (!amount || isNaN(amount) || Number(amount) <= 0) {
//     return res.status(400).json({ error: "Valid positive amount is required" });
//   }
//   try {
//     await db.query(
//       "UPDATE users SET balance = balance + ? WHERE id = ?",
//       [Number(amount), userId]
//     );
//     const [user] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
//     if (user.length === 0) return res.status(404).json({ error: "User not found" });
//     res.json(user[0]);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // ─────────────────────────────────────────
// //  EXPENSE ROUTES
// // ─────────────────────────────────────────

// // GET expenses for a user (with optional month/year filters)
// app.get("/api/users/:id/expenses", async (req, res) => {
//   const userId = req.params.id;
//   const { month, year } = req.query;

//   let query = "SELECT * FROM expenses WHERE user_id = ?";
//   const params = [userId];

//   if (month !== undefined && month !== "") {
//     // MySQL MONTH() returns 1-12; frontend sends 0-11
//     query += " AND MONTH(date) = ?";
//     params.push(Number(month) + 1);
//   }
//   if (year !== undefined && year !== "") {
//     query += " AND YEAR(date) = ?";
//     params.push(Number(year));
//   }

//   query += " ORDER BY date DESC";

//   try {
//     const [rows] = await db.query(query, params);
//     res.json(rows);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // POST add an expense for a user
// app.post("/api/users/:id/expenses", async (req, res) => {
//   const userId = req.params.id;
//   const { item, amount, category, date } = req.body;

//   if (!item || !amount || !category || !date) {
//     return res.status(400).json({ error: "All fields are required" });
//   }
//   if (isNaN(amount) || Number(amount) <= 0) {
//     return res.status(400).json({ error: "Amount must be a positive number" });
//   }

//   const conn = await db.getConnection();
//   try {
//     await conn.beginTransaction();

//     // Check user has enough balance (optional soft check)
//     const [users] = await conn.query("SELECT balance FROM users WHERE id = ?", [userId]);
//     if (users.length === 0) {
//       await conn.rollback();
//       return res.status(404).json({ error: "User not found" });
//     }

//     // Insert expense
//     const [result] = await conn.query(
//       "INSERT INTO expenses (user_id, item, amount, category, date) VALUES (?, ?, ?, ?, ?)",
//       [userId, item.trim(), Number(amount), category, date]
//     );

//     // Deduct from balance
//     await conn.query(
//       "UPDATE users SET balance = balance - ? WHERE id = ?",
//       [Number(amount), userId]
//     );

//     await conn.commit();

//     const [newExpense] = await conn.query("SELECT * FROM expenses WHERE id = ?", [result.insertId]);
//     const [updatedUser] = await conn.query("SELECT * FROM users WHERE id = ?", [userId]);

//     res.status(201).json({ expense: newExpense[0], user: updatedUser[0] });
//   } catch (err) {
//     await conn.rollback();
//     res.status(500).json({ error: err.message });
//   } finally {
//     conn.release();
//   }
// });

// // DELETE an expense (and refund balance)
// app.delete("/api/users/:userId/expenses/:expenseId", async (req, res) => {
//   const { userId, expenseId } = req.params;

//   const conn = await db.getConnection();
//   try {
//     await conn.beginTransaction();

//     const [expenses] = await conn.query(
//       "SELECT * FROM expenses WHERE id = ? AND user_id = ?",
//       [expenseId, userId]
//     );
//     if (expenses.length === 0) {
//       await conn.rollback();
//       return res.status(404).json({ error: "Expense not found" });
//     }

//     const expense = expenses[0];

//     // Delete expense
//     await conn.query("DELETE FROM expenses WHERE id = ?", [expenseId]);

//     // Refund amount to balance
//     await conn.query(
//       "UPDATE users SET balance = balance + ? WHERE id = ?",
//       [expense.amount, userId]
//     );

//     await conn.commit();

//     const [updatedUser] = await conn.query("SELECT * FROM users WHERE id = ?", [userId]);
//     res.json({ message: "Expense deleted", refunded: expense.amount, user: updatedUser[0] });
//   } catch (err) {
//     await conn.rollback();
//     res.status(500).json({ error: err.message });
//   } finally {
//     conn.release();
//   }
// });

// // ─────────────────────────────────────────
// //  SUMMARY ROUTE
// // ─────────────────────────────────────────

// // GET summary stats for a user
// app.get("/api/users/:id/summary", async (req, res) => {
//   const userId = req.params.id;
//   try {
//     const [users] = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
//     if (users.length === 0) return res.status(404).json({ error: "User not found" });

//     const user = users[0];

//     // This month total
//     const [monthRows] = await db.query(
//       `SELECT COALESCE(SUM(amount), 0) AS total
//        FROM expenses
//        WHERE user_id = ?
//          AND MONTH(date) = MONTH(CURDATE())
//          AND YEAR(date)  = YEAR(CURDATE())`,
//       [userId]
//     );

//     // All-time total
//     const [totalRows] = await db.query(
//       "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ?",
//       [userId]
//     );

//     res.json({
//       balance: user.balance,
//       thisMonthExpenses: monthRows[0].total,
//       totalExpenses: totalRows[0].total,
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // ─────────────────────────────────────────
// //  START SERVER
// // ─────────────────────────────────────────
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });
// server.js - Express server with JWT Authentication
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const db = require("./db");
const authMiddleware = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// ─────────────────────────────────────────
//  AUTH ROUTES (Public - no token needed)
// ─────────────────────────────────────────

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password, displayName } = req.body;

  if (!username || !email || !password || !displayName) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    // Check if username or email already exists
    const [existing] = await db.query(
      "SELECT id FROM users WHERE username = ? OR email = ?",
      [username, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Username or email already taken" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const [result] = await db.query(
      "INSERT INTO users (name, username, email, password_hash, balance) VALUES (?, ?, ?, ?, 0)",
      [displayName.trim(), username.trim().toLowerCase(), email.trim().toLowerCase(), passwordHash]
    );

    // Generate token
    const token = jwt.sign(
      { id: result.insertId, username: username.trim().toLowerCase(), email: email.trim().toLowerCase() },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: "Account created successfully!",
      token,
      user: { id: result.insertId, username, email, displayName }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: "Username/email and password are required" });
  }

  try {
    // Find user by username or email
    const [users] = await db.query(
      "SELECT * FROM users WHERE username = ? OR email = ?",
      [usernameOrEmail.toLowerCase(), usernameOrEmail.toLowerCase()]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = users[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: "Login successful!",
      token,
      user: { id: user.id, username: user.username, email: user.email, displayName: user.name }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VERIFY TOKEN (used by frontend on page load)
app.get("/api/auth/verify", authMiddleware, async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, name, username, email, balance FROM users WHERE id = ?",
      [req.user.id]
    );
    if (users.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ user: users[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
//  PROTECTED ROUTES (Token required)
// ─────────────────────────────────────────

// GET current user profile + summary
app.get("/api/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await db.query(
      "SELECT id, name, username, email, balance FROM users WHERE id = ?",
      [userId]
    );
    if (users.length === 0) return res.status(404).json({ error: "User not found" });

    const [monthRows] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
       WHERE user_id = ? AND MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE())`,
      [userId]
    );
    const [totalRows] = await db.query(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ?",
      [userId]
    );

    res.json({
      ...users[0],
      thisMonthExpenses: monthRows[0].total,
      totalExpenses: totalRows[0].total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD BALANCE
app.post("/api/balance", authMiddleware, async (req, res) => {
  const { amount } = req.body;
  const userId = req.user.id;

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: "Valid positive amount is required" });
  }
  try {
    await db.query("UPDATE users SET balance = balance + ? WHERE id = ?", [Number(amount), userId]);
    const [user] = await db.query("SELECT balance FROM users WHERE id = ?", [userId]);
    res.json({ balance: user[0].balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET EXPENSES
app.get("/api/expenses", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { month, year } = req.query;

  let query = "SELECT * FROM expenses WHERE user_id = ?";
  const params = [userId];

  if (month !== undefined && month !== "") {
    query += " AND MONTH(date) = ?";
    params.push(Number(month) + 1);
  }
  if (year !== undefined && year !== "") {
    query += " AND YEAR(date) = ?";
    params.push(Number(year));
  }
  query += " ORDER BY date DESC";

  try {
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD EXPENSE
app.post("/api/expenses", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { item, amount, category, date } = req.body;

  if (!item || !amount || !category || !date) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      "INSERT INTO expenses (user_id, item, amount, category, date) VALUES (?, ?, ?, ?, ?)",
      [userId, item.trim(), Number(amount), category, date]
    );
    await conn.query("UPDATE users SET balance = balance - ? WHERE id = ?", [Number(amount), userId]);

    await conn.commit();

    const [newExpense] = await conn.query("SELECT * FROM expenses WHERE id = ?", [result.insertId]);
    const [updatedUser] = await conn.query("SELECT balance FROM users WHERE id = ?", [userId]);

    res.status(201).json({ expense: newExpense[0], balance: updatedUser[0].balance });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// DELETE EXPENSE
app.delete("/api/expenses/:expenseId", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { expenseId } = req.params;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [expenses] = await conn.query(
      "SELECT * FROM expenses WHERE id = ? AND user_id = ?",
      [expenseId, userId]
    );
    if (expenses.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Expense not found" });
    }

    const expense = expenses[0];
    await conn.query("DELETE FROM expenses WHERE id = ?", [expenseId]);
    await conn.query("UPDATE users SET balance = balance + ? WHERE id = ?", [expense.amount, userId]);

    await conn.commit();

    const [updatedUser] = await conn.query("SELECT balance FROM users WHERE id = ?", [userId]);
    res.json({ message: "Expense deleted", refunded: expense.amount, balance: updatedUser[0].balance });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ─────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
