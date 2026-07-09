const { extractKeywords, withRetry, runSyncPipeline } = require("../services/syncService");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

describe("sync service tests", () => {
  let app;
  let db;
  const testDbPath = path.join(__dirname, "test_sync_service.sqlite");

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.SQLITE_PATH = testDbPath;
    
    jest.resetModules();

    const { connectSQLite, getSQLiteDb } = require("../db/sqlite");
    await connectSQLite();
    db = getSQLiteDb();

    const { connectMongo } = require("../db/mongo");
    await connectMongo();
  });

  afterAll(async () => {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    const { closeSQLite } = require("../db/sqlite");
    await closeSQLite();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (err) {
        // ignore
      }
    }
  });

  describe("extractKeywords", () => {
    test("extracts useful keywords and removes common words", () => {
      const keywords = extractKeywords("How do I upload the signed NOC document?");
      expect(keywords).toContain("upload");
      expect(keywords).toContain("signed");
      expect(keywords).toContain("noc");
      expect(keywords).not.toContain("how");
      expect(keywords).not.toContain("the");
    });
  });

  describe("withRetry helper", () => {
    test("retries operation and succeeds if subsequent attempt works", async () => {
      let calls = 0;
      const operation = async () => {
        calls += 1;
        if (calls < 2) {
          throw new Error("Temporary network fail");
        }
        return "Success";
      };

      const result = await withRetry(operation, { attempts: 3, baseDelayMs: 5 });
      expect(result).toBe("Success");
      expect(calls).toBe(2);
    });

    test("fails if maximum attempts are exceeded", async () => {
      let calls = 0;
      const operation = async () => {
        calls += 1;
        throw new Error("Persistent failure");
      };

      await expect(withRetry(operation, { attempts: 2, baseDelayMs: 5 })).rejects.toThrow("Persistent failure");
      expect(calls).toBe(2);
    });
  });

  describe("pipeline sync checks", () => {
    test("running sync twice does not duplicate FAQs/queries/users/answers", async () => {
      const { isMongoAvailable } = require("../db/mongo");
      if (!isMongoAvailable()) {
        // Skip if MongoDB is not available in test env
        return;
      }

      const User = require("../models/User");
      const FAQ = require("../models/FAQ");

      // 1. Insert a user in SQLite
      await db.run(
        `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
        555,
        "Sync Tester",
        "sync_tester@example.com",
        "hashed",
        "student"
      );

      // 2. Insert FAQ in SQLite
      await db.run(
        `
        INSERT INTO faqs (question, answer, user_id, author_name)
        VALUES (?, ?, ?, ?)
        `,
        "What is the sync service?",
        "It synchronizes SQLite data to MongoDB.",
        "555",
        "Sync Tester"
      );

      // Run sync first time
      await runSyncPipeline();

      // Find user and faq in Mongo
      const mongoUser1 = await User.findOne({ email: "sync_tester@example.com" });
      const mongoFaq1 = await FAQ.findOne({ question: "What is the sync service?" });
      expect(mongoUser1).not.toBeNull();
      expect(mongoFaq1).not.toBeNull();

      // Run sync second time
      await runSyncPipeline();

      // Verify no duplicates created
      const mongoUsers = await User.find({ email: "sync_tester@example.com" });
      const mongoFaqs = await FAQ.find({ question: "What is the sync service?" });
      expect(mongoUsers.length).toBe(1);
      expect(mongoFaqs.length).toBe(1);

      // Clean up
      await User.deleteOne({ _id: mongoUser1._id });
      await FAQ.deleteOne({ _id: mongoFaq1._id });
    });
  });
});
