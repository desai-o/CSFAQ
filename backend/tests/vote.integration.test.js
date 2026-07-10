const request = require("supertest");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

describe("vote integration", () => {
  let app;
  let db;
  const testDbPath = path.join(__dirname, "test_vote_integration.sqlite");

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

  test("aggregates vote counts on target answers correctly when votes are toggled", async () => {
    const { isMongoAvailable } = require("../db/mongo");
    const User = require("../models/User");
    const Answer = require("../models/Answer");

    let userId;
    let answerId;

    if (isMongoAvailable()) {
      // Create user and answer in MongoDB
      const user = await User.create({
        name: "Voter",
        email: "voter@example.com",
        password: "hashed_password"
      });
      userId = user._id.toString();

      const answer = await Answer.create({
        questionId: "test-question",
        content: "Voteable Answer Content",
        author: "Author Name",
        userId: "author-id",
        votes: 0
      });
      answerId = answer._id.toString();
    } else {
      // Create user and answer in SQLite
      userId = "101";
      await db.run(
        `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
        101,
        "Voter",
        "voter@example.com",
        "hashed_password",
        "student"
      );

      const res = await db.run(
        `
        INSERT INTO answers (question_id, content, author, user_id, votes)
        VALUES (?, ?, ?, ?, 0)
        `,
        "test-question",
        "Voteable Answer Content",
        "Author Name",
        "author-id"
      );
      answerId = String(res.lastID);
    }

    const token = jwt.sign({ id: userId }, "test_secret");

    // 1. Upvote it
    const upvoteRes = await request(app)
      .post("/api/votes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        targetType: "answer",
        targetId: answerId,
        value: 1
      });

    expect(upvoteRes.status).toBe(201);

    // Verify answers.votes === 1
    if (isMongoAvailable()) {
      const storedAnswer = await Answer.findById(answerId);
      expect(storedAnswer.votes).toBe(1);
    } else {
      const storedAnswer = await db.get("SELECT * FROM answers WHERE id = ?", answerId);
      expect(storedAnswer.votes).toBe(1);
    }

    // 2. Toggle same vote off
    const toggleOffRes = await request(app)
      .post("/api/votes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        targetType: "answer",
        targetId: answerId,
        value: 1
      });

    expect(toggleOffRes.status).toBe(200);

    // Verify answers.votes === 0
    if (isMongoAvailable()) {
      const storedAnswer = await Answer.findById(answerId);
      expect(storedAnswer.votes).toBe(0);
      
      // Cleanup Mongo
      await User.deleteOne({ _id: userId });
      await Answer.deleteOne({ _id: answerId });
    } else {
      const storedAnswer = await db.get("SELECT * FROM answers WHERE id = ?", answerId);
      expect(storedAnswer.votes).toBe(0);
    }
  });
});
