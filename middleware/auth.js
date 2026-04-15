// middleware/auth.js - JWT authentication middleware
const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: "Access denied. Please login first." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, email }
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token. Please login again." });
  }
}

module.exports = authMiddleware;
