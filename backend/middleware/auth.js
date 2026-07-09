const jwt = require("jsonwebtoken");
const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const User = require("../models/User");

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  return process.env.JWT_SECRET;
}

async function resolveUserById(decodedId) {
  if (isMongoAvailable()) {
    const user = await User.findById(decodedId).select("-password -passwordHash");

    if (user) {
      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || "student",
        questionsCount: user.questionsCount || 0,
        answersCount: user.answersCount || 0,
        reputation: user.reputation || 0,
        storage: "mongodb"
      };
    }
  }

  const db = getSQLiteDb();

  const sqliteUser = await db.get(
    `
    SELECT *
    FROM users
    WHERE mongo_id = ?
       OR id = ?
    `,
    decodedId,
    decodedId
  );

  if (!sqliteUser) return null;

  return {
    id: sqliteUser.mongo_id || String(sqliteUser.id),
    sqliteId: sqliteUser.id,
    name: sqliteUser.name,
    email: sqliteUser.email,
    role: sqliteUser.role || "student",
    questionsCount: sqliteUser.questions_count || 0,
    answersCount: sqliteUser.answers_count || 0,
    reputation: sqliteUser.reputation || 0,
    storage: "sqlite"
  };
}

async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = {
        id: "anonymous",
        role: "anonymous",
        name: "Anonymous"
      };
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, getJwtSecret());

    const user = await resolveUserById(decoded.id);

    if (!user) {
      req.user = {
        id: "anonymous",
        role: "anonymous",
        name: "Anonymous"
      };
      return next();
    }

    req.user = user;
    return next();
  } catch (error) {
    req.user = {
      id: "anonymous",
      role: "anonymous",
      name: "Anonymous"
    };
    return next();
  }
}

async function requireAuth(req, res, next) {
  await optionalAuth(req, res, () => {
    if (!req.user || req.user.id === "anonymous") {
      return res.status(401).json({
        status: "error",
        code: "AUTH_REQUIRED",
        message: "Authentication required"
      });
    }

    return next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        code: "FORBIDDEN",
        message: "Insufficient permissions"
      });
    }

    return next();
  };
}

module.exports = {
  optionalAuth,
  requireAuth,
  requireRole
};
