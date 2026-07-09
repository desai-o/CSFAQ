const request = require("supertest");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

describe("answer authorization integration", () => {
  let app;
  let db;
  const testDbPath = path.join(__dirname, "test_answer_auth.sqlite");

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test_secret";
    process.env.SQLITE_PATH = testDbPath;
    
    jest.resetModules();

    const { connectSQLite, getSQLiteDb } = require("../db/sqlite");
    await connectSQLite();
    db = getSQLiteDb();

    const { connectMongo } = require("../db/mongo");
    await connectMongo();

    app = require("../server");
  });

  afterAll(async () => {
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

  test("stores correct userId and ignores spoofed values when authenticated", async () => {
    const { isMongoAvailable } = require("../db/mongo");
    const User = require("../models/User");
    const Answer = require("../models/Answer");
    const FAQ = require("../models/FAQ");

    let userAId;
    if (isMongoAvailable()) {
      // Create a user in Mongo
      const userA = await User.create({
        name: "User A",
        email: "user_a@example.com",
        password: "hashed_password"
      });
      userAId = userA._id.toString();

      await FAQ.create({
        _id: "test-question-123",
        question: "What is this?",
        answer: "This is a test question.",
        userId: userAId
      });
    } else {
      // Create a user in SQLite
      userAId = "42";
      await db.run(
        `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
        42,
        "User A",
        "user_a@example.com",
        "hashed_password",
        "student"
      );

      await db.run(
        `INSERT INTO faqs (mongo_id, question, answer) VALUES (?, ?, ?)`,
        "test-question-123",
        "What is this?",
        "This is a test question."
      );
    }

    const token = jwt.sign({ id: userAId }, "test_secret");

    const response = await request(app)
      .post("/api/answers")
      .set("Authorization", `Bearer ${token}`)
      .set("user-id", "spoofed-user-header")
      .send({
        questionId: "test-question-123",
        content: "This is a valid answer.",
        author: "Spoofed Author",
        userId: "spoofed-user-id"
      });

    if (response.status !== 201) {
      console.log("Response error body:", response.body);
    }
    expect(response.status).toBe(201);
    
    if (isMongoAvailable()) {
      const storedAnswer = await Answer.findOne({ questionId: "test-question-123" });
      expect(storedAnswer).toBeDefined();
      expect(storedAnswer.userId).toBe(userAId);
      expect(storedAnswer.author).toBe("User A");
      // Cleanup
      await User.deleteOne({ _id: userAId });
      await FAQ.deleteOne({ _id: "test-question-123" });
      await Answer.deleteOne({ _id: storedAnswer._id });
    } else {
      const storedAnswer = await db.get(
        "SELECT * FROM answers WHERE question_id = ?",
        "test-question-123"
      );
      expect(storedAnswer).toBeDefined();
      expect(storedAnswer.user_id).toBe(userAId);
      expect(storedAnswer.author).toBe("User A");
    }
  });
});
