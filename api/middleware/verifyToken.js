"use strict";
const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const header = req.headers?.authorization;
  if (typeof header !== "string" || !/^Bearer [^\s]+$/.test(header)) {
    return res.status(401).json({
      success: false,
      error: header ? "Nieprawidłowy format tokena." : "Brak tokena."
    });
  }
  // Fail closed on absent server secret; never accept a caller-provided key.
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ success: false, error: "Uwierzytelnianie niedostępne." });
  }
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET, {
      algorithms: ["HS256"]
    });
    if (!decoded || typeof decoded !== "object" ||
        typeof decoded.id !== "string" || !decoded.id.trim()) {
      return res.status(401).json({ success: false, error: "Token jest nieważny." });
    }
    // Controllers must re-check roles/tenant membership in the database.
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ success: false, error: "Token jest nieważny." });
  }
}

module.exports = verifyToken;
