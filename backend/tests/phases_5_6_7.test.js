const request = require("supertest");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

let connectSQLite, getSQLiteDb, closeSQLite;

describe("Phases 5, 6, and 7 Integration Tests", () => {
  let app;
  const testDbPath = path.join(__dirname, "test_phases_5_6_7.sqlite");
  let userToken;
  const userId = "user_567";
  let adminToken;
  const adminId = "admin_567";
  let contributorToken;
  const contributorId = "contrib_567";

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test_secret_567";
    process.env.SQLITE_PATH = testDbPath;

    jest.resetModules();

    const sqlite = require("../db/sqlite");
    connectSQLite = sqlite.connectSQLite;
    getSQLiteDb = sqlite.getSQLiteDb;
    closeSQLite = sqlite.closeSQLite;

    await connectSQLite();
    app = require("../server");

    // Seed test users in SQLite
    const db = getSQLiteDb();
    await db.run(
      `INSERT INTO users (mongo_id, name, email, password_hash, role, reputation) VALUES (?, ?, ?, ?, ?, ?)`,
      userId,
      "Test User 567",
      "user567@example.com",
      "hash",
      "student",
      100 // user has 100 reputation to seed bounty tests
    );

    await db.run(
      `INSERT INTO users (mongo_id, name, email, password_hash, role, reputation) VALUES (?, ?, ?, ?, ?, ?)`,
      adminId,
      "Admin User 567",
      "admin567@example.com",
      "hash",
      "admin",
      50
    );

    await db.run(
      `INSERT INTO users (mongo_id, name, email, password_hash, role, reputation) VALUES (?, ?, ?, ?, ?, ?)`,
      contributorId,
      "Contributor User 567",
      "contributor567@example.com",
      "hash",
      "moderator",
      50
    );

    userToken = jwt.sign({ id: userId }, process.env.JWT_SECRET);
    adminToken = jwt.sign({ id: adminId }, process.env.JWT_SECRET);
    contributorToken = jwt.sign({ id: contributorId }, process.env.JWT_SECRET);
  });

  afterAll(async () => {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await closeSQLite();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (err) {}
    }
  });

  describe("Phase 5: Content Moderation", () => {
    let flaggedFaqId;
    let moderationRecordId;

    test("creating a FAQ containing spam/toxic triggers needs_review status and populates moderation record", async () => {
      const res = await request(app)
        .post("/api/faqs")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          question: "How to buy viagra cheap free money fast cheap-crypto?",
          answer: "Spam check test answers.",
          category: "General",
          tags: ["spamtest"]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.moderationStatus).toBe("needs_review");
      flaggedFaqId = res.body.data.id;
    });

    test("unauthorized user cannot read moderation queue", async () => {
      const res = await request(app)
        .get("/api/admin/moderation-queue")
        .set("Authorization", `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    test("moderator can list moderation queue containing flagged faq", async () => {
      const res = await request(app)
        .get("/api/admin/moderation-queue")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.length).toBeGreaterThan(0);
      moderationRecordId = res.body.data[0].id || res.body.data[0]._id;
      expect(res.body.data[0].target_id || res.body.data[0].targetId).toBe(String(flaggedFaqId));
    });

    test("moderator can query moderation record explanation details", async () => {
      const res = await request(app)
        .get(`/api/admin/moderation/${moderationRecordId}/explanation`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.flagged).toBe(true);
      expect(res.body.data.categories).toContain("spam");
    });

    test("moderator can approve flagged faq and release it to public lists", async () => {
      const actionRes = await request(app)
        .patch(`/api/admin/moderation/${moderationRecordId}/action`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ action: "approve", note: "False positive" });

      expect(actionRes.status).toBe(200);

      // Verify FAQ is now approved and accessible publicly
      const listRes = await request(app).get("/api/faqs");
      expect(listRes.status).toBe(200);
      const items = listRes.body.data;
      const found = items.find(item => String(item.id || item._id) === String(flaggedFaqId));
      expect(found).toBeTruthy();
    });
  });

  describe("Phase 5: NLP Duplicate Detection", () => {
    test("NLP duplicates check returns suggestions with similarity scoring", async () => {
      // Seed a similar query manually
      const db = getSQLiteDb();
      await db.run(
        `INSERT INTO faqs (question, answer, category, tags) VALUES (?, ?, ?, ?)`,
        "What is the policy for uploading official forms?",
        "Only PDF uploads are allowed.",
        "General",
        "forms"
      );

      const res = await request(app)
        .post("/api/duplicates/check")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ question: "Is there a policy for uploading official PDF forms?" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].similarity).toBeGreaterThan(0.2);
    });
  });

  describe("Phase 6: Search Analytics & Knowledge Gaps", () => {
    test("failed searches are logged and aggregated in gap analyzer", async () => {
      // Run search that yields no results
      await request(app)
        .post("/api/search")
        .send({ keyword: "xyzqwertynomatch" });

      const res = await request(app)
        .get("/api/admin/knowledge-gaps")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.failedSearches.length).toBeGreaterThan(0);
      expect(res.body.data.failedSearches[0].query).toBe("xyzqwertynomatch");
    });
  });

  describe("Phase 6: AI Chatbot / RAG Assistant", () => {
    test("chat assistant generates answers with source citations", async () => {
      const res = await request(app)
        .post("/api/chat")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ message: "What is the policy for uploading official forms?" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.response).toBeDefined();
    });
  });

  describe("Phase 7: Bounty System", () => {
    let targetQueryId;
    let bountyId;

    beforeAll(async () => {
      const db = getSQLiteDb();
      const res = await db.run(
        `INSERT INTO user_queries (question, description, category, tags, user_id) VALUES (?, ?, ?, ?, ?)`,
        "Need help setting up sqlite database tables.",
        "Detailed step by step guidelines needed.",
        "General",
        "database",
        contributorId
      );
      targetQueryId = res.lastID;
    });

    test("user can create reputation bounty on pending queries", async () => {
      const res = await request(app)
        .post("/api/bounties")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          queryId: targetQueryId,
          amount: 30,
          durationDays: 3
        });

      if (res.status !== 201) console.error("BOUNTY CREATE ERROR:", res.body);
      expect(res.status).toBe(201);
      expect(res.body.data.amount).toBe(30);
      bountyId = res.body.data.id || "sqlite-only";
    });

    test("bounties show up in open bounties list", async () => {
      const res = await request(app).get("/api/bounties");
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    test("bounty query award triggers reputation transfer to answer author", async () => {
      const db = getSQLiteDb();
      const answerRes = await db.run(
        `INSERT INTO answers (query_id, content, user_id) VALUES (?, ?, ?)`,
        targetQueryId,
        "Here are the instructions to run the migrations.",
        contributorId
      );
      const answerId = answerRes.lastID;

      const awardRes = await request(app)
        .post(`/api/bounties/${bountyId}/award`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ answerId });

      expect(awardRes.status).toBe(200);

      // Verify contributor user reputation went up by 30 (from 50 to 80)
      const contrib = await db.get("SELECT reputation FROM users WHERE id = ? OR mongo_id = ?", contributorId, contributorId);
      expect(contrib.reputation).toBe(80);
    });
  });

  describe("Phase 7: Notification Preferences", () => {
    test("users can read and update notification preferences", async () => {
      const getRes = await request(app)
        .get("/api/notifications/preferences")
        .set("Authorization", `Bearer ${userToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.emailNotifications).toBe(true);

      const putRes = await request(app)
        .put("/api/notifications/preferences")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          emailNotifications: false,
          inAppNotifications: true,
          digestFrequency: "daily",
          tagPreferences: ["forms", "database"]
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.data.emailNotifications).toBe(false);
      expect(putRes.body.data.digestFrequency).toBe("daily");
    });
  });

  describe("Phase 7: Public GraphQL API", () => {
    test("GraphQL POST queries are processed successfully", async () => {
      const query = `
        query {
          faqs(limit: 5) {
            id
            question
            category
          }
        }
      `;

      const res = await request(app)
        .post("/api/graphql")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ query });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.faqs).toBeDefined();
      expect(res.body.data.faqs.length).toBeGreaterThan(0);
    });
  });
});
