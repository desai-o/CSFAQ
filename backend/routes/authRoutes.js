const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const { success, fail } = require("../utils/apiResponse");
const { authLimiter } = require("../middleware/rateLimits");

// JWT signature function
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
};

// @route   POST api/auth/signup
// @desc    Register a user
// @access  Public
router.post("/signup", authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || name.trim() === "" || !email || email.trim() === "" || !password || password.trim() === "") {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Please enter all fields"
      });
    }

    if (password.length < 6) {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Password must be at least 6 characters"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists (MongoDB or SQLite)
    let userExists = false;

    if (isMongoAvailable()) {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) userExists = true;
    } else {
      const db = getSQLiteDb();
      const existingUser = await db.get("SELECT * FROM users WHERE email = ?", normalizedEmail);
      if (existingUser) userExists = true;
    }

    if (userExists) {
      return fail(res, {
        statusCode: 400,
        code: "USER_EXISTS",
        message: "User already exists with this email"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let userId = null;
    let savedUser = null;

    if (isMongoAvailable()) {
      // Save to Mongo
      const newUser = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: "student"
      });

      userId = newUser._id.toString();
      savedUser = {
        id: userId,
        name: newUser.name,
        email: newUser.email,
        questionsCount: 0,
        answersCount: 0,
        reputation: 0,
        storage: "mongodb"
      };

      // Also save to SQLite so credentials match offline
      try {
        const db = getSQLiteDb();
        await db.run(
          `INSERT INTO users (mongo_id, name, email, password_hash) VALUES (?, ?, ?, ?)`,
          userId,
          name.trim(),
          normalizedEmail,
          passwordHash
        );
      } catch (sqLiteErr) {
        console.error("Failed to sync new user to SQLite fallback during signup:", sqLiteErr.message);
      }
    } else {
      // Save only to SQLite fallback
      const db = getSQLiteDb();
      const result = await db.run(
        `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`,
        name.trim(),
        normalizedEmail,
        passwordHash
      );

      userId = result.lastID.toString();
      savedUser = {
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        questionsCount: 0,
        answersCount: 0,
        reputation: 0,
        storage: "sqlite"
      };
    }

    // Generate JWT
    const token = generateToken(userId);

    return success(res, {
      statusCode: 201,
      storage: savedUser.storage,
      data: savedUser,
      meta: { token, user: savedUser }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "Signup failed",
      details: error.message
    });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || email.trim() === "" || !password || password.trim() === "") {
      return fail(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Please enter all fields"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    let user = null;
    let isMatch = false;

    if (isMongoAvailable()) {
      user = await User.findOne({ email: normalizedEmail });
      if (user) {
        isMatch = await bcrypt.compare(password, user.passwordHash);
        if (isMatch) {
          const token = generateToken(user._id.toString());
          const userObj = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            questionsCount: user.questionsCount,
            answersCount: user.answersCount,
            reputation: user.reputation,
            storage: "mongodb"
          };
          return success(res, {
            storage: "mongodb",
            data: userObj,
            meta: { token, user: userObj }
          });
        }
      }
    }

    // Fallback or secondary check on SQLite
    const db = getSQLiteDb();
    const sqliteUser = await db.get("SELECT * FROM users WHERE email = ?", normalizedEmail);
    
    if (sqliteUser) {
      isMatch = await bcrypt.compare(password, sqliteUser.password_hash);
      if (isMatch) {
        const userId = sqliteUser.mongo_id || sqliteUser.id.toString();
        const token = generateToken(userId);
        
        // If MongoDB became available and this SQLite user wasn't synced/found there, we could sync it later,
        // but for now, log them in using fallback credentials.
        const userObj = {
          id: userId,
          name: sqliteUser.name,
          email: sqliteUser.email,
          questionsCount: sqliteUser.questions_count,
          answersCount: sqliteUser.answers_count,
          reputation: sqliteUser.reputation,
          storage: "sqlite"
        };
        return success(res, {
          storage: "sqlite",
          data: userObj,
          meta: { token, user: userObj }
        });
      }
    }

    return fail(res, {
      statusCode: 400,
      code: "INVALID_CREDENTIALS",
      message: "Invalid credentials"
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "Login failed",
      details: error.message
    });
  }
});

// @route   GET api/auth/me
// @desc    Get user data
// @access  Private
router.get("/me", requireAuth, async (req, res) => {
  return success(res, {
    storage: req.user.storage || "mongodb",
    data: req.user,
    meta: { user: req.user }
  });
});

module.exports = router;
