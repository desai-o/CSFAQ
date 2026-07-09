const request = require("supertest");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

describe("question upvote persistence", () => {
  let app;
  let db;
  const testDbPath = path.join(__dirname, "test_question_upvote.sqlite");

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

  /**
   * Reads the persisted upvote count for a question of a known type.
   * Mirrors the route handler's `readQuestionUpvotes` helper — there is no
   * longer a cross-collection fall-through here either. The test must know
   * whether the question is an FAQ or a UserQuery and pass that in.
   */
  async function readPersistedQuestionUpvotes(questionType, targetId) {
    const { isMongoAvailable } = require("../db/mongo");
    if (isMongoAvailable()) {
      if (questionType === "faq") {
        const FAQ = require("../models/FAQ");
        const faq = await FAQ.findById(targetId);
        return { upvotes: faq?.upvotes ?? null, storage: "mongodb" };
      }
      const UserQuery = require("../models/UserQuery");
      const q = await UserQuery.findById(targetId);
      return { upvotes: q?.upvotes ?? null, storage: "mongodb" };
    }
    if (questionType === "faq") {
      const row = await db.get(
        "SELECT upvotes FROM faqs WHERE id = ? OR CAST(id AS TEXT) = ? LIMIT 1",
        targetId,
        String(targetId)
      );
      return { upvotes: row?.upvotes ?? null, storage: "sqlite" };
    }
    const row = await db.get(
      "SELECT upvotes FROM user_queries WHERE id = ? OR CAST(id AS TEXT) = ? LIMIT 1",
      targetId,
      String(targetId)
    );
    return { upvotes: row?.upvotes ?? null, storage: "sqlite" };
  }

  test("toggling a question vote increments and decrements the persisted upvotes count", async () => {
    const { isMongoAvailable } = require("../db/mongo");
    const User = require("../models/User");
    const FAQ = require("../models/FAQ");

    let userId;
    let questionId;

    if (isMongoAvailable()) {
      const user = await User.create({
        name: "Question Voter",
        email: "qvoter@example.com",
        password: "hashed_password"
      });
      userId = user._id.toString();

      const question = await FAQ.create({
        question: "How do I test question upvotes?",
        answer: "Read the test source.",
        category: "Programming",
        tags: ["testing"],
        upvotes: 0
      });
      questionId = question._id.toString();
    } else {
      userId = "201";
      await db.run(
        `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
        201,
        "Question Voter",
        "qvoter@example.com",
        "hashed_password",
        "student"
      );

      const result = await db.run(
        `
        INSERT INTO faqs (question, answer, category, tags, upvotes, user_id)
        VALUES (?, ?, ?, ?, 0, ?)
        `,
        "How do I test question upvotes?",
        "Read the test source.",
        "Programming",
        "testing",
        "201"
      );
      questionId = String(result.lastID);
    }

    const token = jwt.sign({ id: userId }, "test_secret");

    // ── Initial state ──────────────────────────────────────────────────────
    const initial = await readPersistedQuestionUpvotes("faq", questionId);
    expect(initial.upvotes).toBe(0);

    // ── 1. Upvote — count should jump to 1 ──────────────────────────────────
    const upvoteRes = await request(app)
      .post("/api/votes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        targetType: "question",
        targetId: questionId,
        value: 1,
        questionType: "faq"
      });

    expect(upvoteRes.status).toBe(201);
    expect(upvoteRes.body).toBeDefined();
    expect(upvoteRes.body?.data?.meta?.voteCount ?? upvoteRes.body?.meta?.voteCount ?? null).toBe(1);

    const afterUpvote = await readPersistedQuestionUpvotes("faq", questionId);
    expect(afterUpvote.upvotes).toBe(1);

    // ── 2. Toggle off — count should drop back to 0 ─────────────────────────
    const toggleOffRes = await request(app)
      .post("/api/votes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        targetType: "question",
        targetId: questionId,
        value: 1,
        questionType: "faq"
      });

    expect(toggleOffRes.status).toBe(200);
    const afterToggleOff = await readPersistedQuestionUpvotes("faq", questionId);
    expect(afterToggleOff.upvotes).toBe(0);

    // ── 3. Upvote again — count should rise to 1 again ──────────────────────
    const reUpvoteRes = await request(app)
      .post("/api/votes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        targetType: "question",
        targetId: questionId,
        value: 1,
        questionType: "faq"
      });

    expect(reUpvoteRes.status).toBe(201);
    const afterReUpvote = await readPersistedQuestionUpvotes("faq", questionId);
    expect(afterReUpvote.upvotes).toBe(1);

    // ── Cleanup ────────────────────────────────────────────────────────────
    if (isMongoAvailable()) {
      await User.deleteOne({ _id: userId });
      await FAQ.deleteOne({ _id: questionId });
    } else {
      await db.run("DELETE FROM faqs WHERE id = ?", questionId);
    }
  });

  test("separate users toggling votes accumulate correctly on the same question", async () => {
    const { isMongoAvailable } = require("../db/mongo");
    const User = require("../models/User");
    const FAQ = require("../models/FAQ");

    let questionId;
    let aliceId;
    let bobId;

    if (isMongoAvailable()) {
      const alice = await User.create({
        name: "Alice",
        email: "alice@example.com",
        password: "hashed"
      });
      aliceId = alice._id.toString();

      const bob = await User.create({
        name: "Bob",
        email: "bob@example.com",
        password: "hashed"
      });
      bobId = bob._id.toString();

      const question = await FAQ.create({
        question: "Do upvotes accumulate per user?",
        answer: "Yes.",
        category: "Programming",
        tags: ["testing"],
        upvotes: 0
      });
      questionId = question._id.toString();
    } else {
      aliceId = "301";
      bobId = "302";
      await db.run(
        `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
        aliceId,
        "Alice",
        "alice@example.com",
        "hashed",
        "student"
      );
      await db.run(
        `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
        bobId,
        "Bob",
        "bob@example.com",
        "hashed",
        "student"
      );
      const result = await db.run(
        `INSERT INTO faqs (question, answer, category, tags, upvotes, user_id) VALUES (?, ?, ?, ?, 0, ?)`,
        "Do upvotes accumulate per user?",
        "Yes.",
        "Programming",
        "testing",
        aliceId
      );
      questionId = String(result.lastID);
    }

    const aliceToken = jwt.sign({ id: aliceId }, "test_secret");
    const bobToken = jwt.sign({ id: bobId }, "test_secret");

    // Alice upvotes
    await request(app)
      .post("/api/votes")
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({ targetType: "question", targetId: questionId, value: 1, questionType: "faq" });

    let persisted = await readPersistedQuestionUpvotes("faq", questionId);
    expect(persisted.upvotes).toBe(1);

    // Bob upvotes
    await request(app)
      .post("/api/votes")
      .set("Authorization", `Bearer ${bobToken}`)
      .send({ targetType: "question", targetId: questionId, value: 1, questionType: "faq" });

    persisted = await readPersistedQuestionUpvotes("faq", questionId);
    expect(persisted.upvotes).toBe(2);

    // Alice toggles off — count should drop to 1
    await request(app)
      .post("/api/votes")
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({ targetType: "question", targetId: questionId, value: 1, questionType: "faq" });

    persisted = await readPersistedQuestionUpvotes("faq", questionId);
    expect(persisted.upvotes).toBe(1);

    // Cleanup
    if (isMongoAvailable()) {
      await User.deleteOne({ _id: aliceId });
      await User.deleteOne({ _id: bobId });
      await FAQ.deleteOne({ _id: questionId });
    } else {
      await db.run("DELETE FROM faqs WHERE id = ?", questionId);
    }
  });

  test("UserQuery upvote counts persist via the dedicated community-question helper", async () => {
    const { isMongoAvailable } = require("../db/mongo");
    const User = require("../models/User");
    const UserQuery = require("../models/UserQuery");

    let userId;
    let queryId;

    if (isMongoAvailable()) {
      const user = await User.create({
        name: "Query Voter",
        email: "qvoter2@example.com",
        password: "hashed"
      });
      userId = user._id.toString();

      const query = await UserQuery.create({
        question: "How are queries upvoted?",
        description: "Test the UserQuery path.",
        category: "Programming",
        tags: ["testing"],
        upvotes: 0
      });
      queryId = query._id.toString();
    } else {
      userId = "401";
      await db.run(
        `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
        userId,
        "Query Voter",
        "qvoter2@example.com",
        "hashed",
        "student"
      );
      const result = await db.run(
        `INSERT INTO user_queries (question, description, category, tags, upvotes, user_id) VALUES (?, ?, ?, ?, 0, ?)`,
        "How are queries upvoted?",
        "Test the UserQuery path.",
        "Programming",
        "testing",
        userId
      );
      queryId = String(result.lastID);
    }

    const token = jwt.sign({ id: userId }, "test_secret");

    const upvoteRes = await request(app)
      .post("/api/votes")
      .set("Authorization", `Bearer ${token}`)
      .send({ targetType: "question", targetId: queryId, value: 1, questionType: "query" });

    expect(upvoteRes.status).toBe(201);

    const persisted = await readPersistedQuestionUpvotes("query", queryId);
    expect(persisted.upvotes).toBe(1);

    // Cleanup
    if (isMongoAvailable()) {
      await User.deleteOne({ _id: userId });
      await UserQuery.deleteOne({ _id: queryId });
    } else {
      await db.run("DELETE FROM user_queries WHERE id = ?", queryId);
    }
  });

  test("questionType routes the vote to exactly one collection (no cross-collection fall-through)", async () => {
    const { isMongoAvailable } = require("../db/mongo");
    const User = require("../models/User");
    const FAQ = require("../models/FAQ");
    const UserQuery = require("../models/UserQuery");

    let userId;
    let faqId;
    let queryId;

    if (isMongoAvailable()) {
      const user = await User.create({
        name: "Both Voter",
        email: "both.voter@example.com",
        password: "hashed"
      });
      userId = user._id.toString();

      const faq = await FAQ.create({
        question: "FAQ side",
        answer: ".",
        category: "Programming",
        tags: [],
        upvotes: 0
      });
      faqId = faq._id.toString();

      const query = await UserQuery.create({
        question: "Query side",
        description: ".",
        category: "Programming",
        tags: [],
        upvotes: 0
      });
      queryId = query._id.toString();
    } else {
      userId = "501";
      await db.run(
        `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
        userId,
        "Both Voter",
        "both.voter@example.com",
        "hashed",
        "student"
      );
      const faqResult = await db.run(
        `INSERT INTO faqs (question, answer, category, tags, upvotes, user_id) VALUES (?, ?, ?, ?, 0, ?)`,
        "FAQ side",
        ".",
        "Programming",
        "",
        userId
      );
      faqId = String(faqResult.lastID);
      const queryResult = await db.run(
        `INSERT INTO user_queries (question, description, category, tags, upvotes, user_id) VALUES (?, ?, ?, ?, 0, ?)`,
        "Query side",
        ".",
        "Programming",
        "",
        userId
      );
      queryId = String(queryResult.lastID);
    }

    const token = jwt.sign({ id: userId }, "test_secret");

    // Upvote the FAQ with questionType: "faq" — FAQ count goes up, UserQuery stays 0.
    await request(app)
      .post("/api/votes")
      .set("Authorization", `Bearer ${token}`)
      .send({ targetType: "question", targetId: faqId, value: 1, questionType: "faq" });

    expect((await readPersistedQuestionUpvotes("faq", faqId)).upvotes).toBe(1);
    expect((await readPersistedQuestionUpvotes("query", queryId)).upvotes).toBe(0);

    // Upvote the UserQuery with questionType: "query" — only the UserQuery count moves.
    await request(app)
      .post("/api/votes")
      .set("Authorization", `Bearer ${token}`)
      .send({ targetType: "question", targetId: queryId, value: 1, questionType: "query" });

    expect((await readPersistedQuestionUpvotes("faq", faqId)).upvotes).toBe(1);
    expect((await readPersistedQuestionUpvotes("query", queryId)).upvotes).toBe(1);

    // Cleanup
    if (isMongoAvailable()) {
      await User.deleteOne({ _id: userId });
      await FAQ.deleteOne({ _id: faqId });
      await UserQuery.deleteOne({ _id: queryId });
    } else {
      await db.run("DELETE FROM faqs WHERE id = ?", faqId);
      await db.run("DELETE FROM user_queries WHERE id = ?", queryId);
    }
  });

  test("question votes without a questionType are rejected with 400", async () => {
    const { isMongoAvailable } = require("../db/mongo");
    const User = require("../models/User");
    const FAQ = require("../models/FAQ");

    let userId;
    let questionId;

    if (isMongoAvailable()) {
      const user = await User.create({
        name: "Strict Voter",
        email: "strict@example.com",
        password: "hashed"
      });
      userId = user._id.toString();

      const question = await FAQ.create({
        question: "Must we always pass questionType?",
        answer: "Yes.",
        category: "Programming",
        tags: [],
        upvotes: 0
      });
      questionId = question._id.toString();
    } else {
      userId = "601";
      await db.run(
        `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
        userId,
        "Strict Voter",
        "strict@example.com",
        "hashed",
        "student"
      );
      const result = await db.run(
        `INSERT INTO faqs (question, answer, category, tags, upvotes, user_id) VALUES (?, ?, ?, ?, 0, ?)`,
        "Must we always pass questionType?",
        "Yes.",
        "Programming",
        "",
        userId
      );
      questionId = String(result.lastID);
    }

    const token = jwt.sign({ id: userId }, "test_secret");

    const res = await request(app)
      .post("/api/votes")
      .set("Authorization", `Bearer ${token}`)
      .send({ targetType: "question", targetId: questionId, value: 1 });

    expect(res.status).toBe(400);
    expect((await readPersistedQuestionUpvotes("faq", questionId)).upvotes).toBe(0);

    // Cleanup
    if (isMongoAvailable()) {
      await User.deleteOne({ _id: userId });
      await FAQ.deleteOne({ _id: questionId });
    } else {
      await db.run("DELETE FROM faqs WHERE id = ?", questionId);
    }
  });
});
