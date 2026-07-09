const request = require("supertest");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

describe("answer route regression", () => {
  let app;
  let db;
  let token;
  let userId;
  const testDbPath = path.join(__dirname, "test_answer_regression.sqlite");

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test_secret";
    process.env.SQLITE_PATH = testDbPath;
    
    jest.resetModules();

    const { connectSQLite, getSQLiteDb } = require("../db/sqlite");
    await connectSQLite();
    db = getSQLiteDb();

    const { connectMongo, isMongoAvailable } = require("../db/mongo");
    await connectMongo();

    app = require("../server");

    // Seed User
    if (isMongoAvailable()) {
      const User = require("../models/User");
      const user = await User.create({
        name: "Test User",
        email: "reg_user@example.com",
        password: "hashed_password"
      });
      userId = user._id.toString();
    } else {
      await db.run(
        `INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
        1001,
        "Test User",
        "reg_user@example.com",
        "hashed_password",
        "student"
      );
      userId = "1001";
    }

    token = jwt.sign({ id: userId }, "test_secret");
  });

  afterAll(async () => {
    const { isMongoAvailable } = require("../db/mongo");
    if (isMongoAvailable()) {
      const User = require("../models/User");
      await User.deleteOne({ _id: userId }).catch(() => {});
    }

    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (err) {
        // ignore
      }
    }
  });

  test("POST /api/answers returns exactly one successful response", async () => {
    const { isMongoAvailable } = require("../db/mongo");
    const FAQ = require("../models/FAQ");
    const Answer = require("../models/Answer");

    if (isMongoAvailable()) {
      await FAQ.create({
        _id: "reg-faq-123",
        question: "Is this a regression test?",
        answer: "Yes, it is."
      });
    } else {
      await db.run(
        `INSERT INTO faqs (mongo_id, question, answer) VALUES (?, ?, ?)`,
        "reg-faq-123",
        "Is this a regression test?",
        "Yes, it is."
      );
    }

    const response = await request(app)
      .post("/api/answers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        questionId: "reg-faq-123",
        content: "This is a valid regression answer.",
        author: "Regression User"
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("success");
    expect(response.body.data).toBeDefined();

    if (isMongoAvailable()) {
      await FAQ.deleteOne({ _id: "reg-faq-123" });
      await Answer.deleteOne({ questionId: "reg-faq-123" });
    }
  });

  test("POST /api/answers rejects missing target", async () => {
    const response = await request(app)
      .post("/api/answers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        content: "This is an answer without a target question/query.",
        author: "Regression User"
      });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  test("POST /api/answers rejects non-existing target", async () => {
    const response = await request(app)
      .post("/api/answers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        questionId: "non-existent-faq-id",
        content: "This points to nothing.",
        author: "Regression User"
      });

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("error");
    expect(response.body.code).toBe("QUESTION_NOT_FOUND");
  });
});
