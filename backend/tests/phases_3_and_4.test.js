const request = require("supertest");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

let connectSQLite, getSQLiteDb;

describe("Phases 3 and 4 Integration Tests", () => {
  let app;
  const testDbPath = path.join(__dirname, "test_phases_3_and_4.sqlite");
  let userToken;
  const userId = "user123";
  let adminToken;
  const adminId = "admin123";
  let faqId;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test_secret";
    process.env.SQLITE_PATH = testDbPath;
    
    jest.resetModules();

    const sqlite = require("../db/sqlite");
    connectSQLite = sqlite.connectSQLite;
    getSQLiteDb = sqlite.getSQLiteDb;

    await connectSQLite();
    app = require("../server");

    // Seed test users in SQLite
    const db = getSQLiteDb();
    await db.run(
      `INSERT INTO users (mongo_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
      userId,
      "Test User",
      "test@example.com",
      "hash",
      "student"
    );

    await db.run(
      `INSERT INTO users (mongo_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
      adminId,
      "Admin User",
      "admin@example.com",
      "hash",
      "admin"
    );

    userToken = jwt.sign({ id: userId }, process.env.JWT_SECRET);
    adminToken = jwt.sign({ id: adminId }, process.env.JWT_SECRET);

    // Seed a dummy FAQ
    const faqResult = await db.run(
      `INSERT INTO faqs (question, answer, category, tags, user_id, author_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      "How to set up environment variables for testing?",
      "Set NODE_ENV to test in your scripts or test helper config.",
      "Testing",
      "testing,node",
      userId,
      "Test User"
    );
    faqId = String(faqResult.lastID);
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
      } catch (err) {}
    }
  });

  describe("Offline Export", () => {
    test("rejects export request without auth", async () => {
      const res = await request(app).get("/api/export?format=json");
      expect(res.status).toBe(401);
    });

    test("exports FAQs in JSON format", async () => {
      const res = await request(app)
        .get("/api/export?format=json")
        .set("Authorization", `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      const data = JSON.parse(res.text);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].question).toBe("How to set up environment variables for testing?");
    });

    test("exports FAQs in CSV format", async () => {
      const res = await request(app)
        .get("/api/export?format=csv")
        .set("Authorization", `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.text).toContain("Question,Answer,Category");
      expect(res.text).toContain("How to set up environment variables for testing?");
    });

    test("exports FAQs in Markdown format", async () => {
      const res = await request(app)
        .get("/api/export?format=markdown")
        .set("Authorization", `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/markdown");
      expect(res.text).toContain("# CrowdFAQ Knowledge Export");
      expect(res.text).toContain("How to set up environment variables for testing?");
    });

    test("exports FAQs in PDF format", async () => {
      const res = await request(app)
        .get("/api/export?format=pdf")
        .set("Authorization", `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
    });
  });

  describe("Bulk Import", () => {
    test("performs dry-run validation on JSON payload", async () => {
      const importPayload = [
        {
          question: "What is Jest in Node testing?",
          answer: "Jest is a robust JavaScript testing framework.",
          category: "Testing",
          tags: "jest,test"
        }
      ];

      const res = await request(app)
        .post("/api/faqs/import")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          format: "json",
          content: JSON.stringify(importPayload),
          dryRun: true
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.status).toBe("valid");
      expect(res.body.data.preview.length).toBe(1);
    });

    test("rejects import with invalid rows", async () => {
      const importPayload = [
        {
          question: "Short", // too short, validation fail
          answer: "Valid answer text"
        }
      ];

      const res = await request(app)
        .post("/api/faqs/import")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          format: "json",
          content: JSON.stringify(importPayload),
          dryRun: false
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    test("imports valid Markdown FAQ document successfully", async () => {
      const mdContent = `
## What is Cypress testing?
Category: Testing
Tags: cypress,e2e
Cypress is a next-generation front-end testing tool built for the modern web.
`;

      const res = await request(app)
        .post("/api/faqs/import")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          format: "markdown",
          content: mdContent,
          dryRun: false
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.status).toBe("success");
      expect(res.body.data.imported.length).toBe(1);
    });

    test("previews document import as admin before confirming", async () => {
      const sampleBase64Text = Buffer.from("What is the purpose of a FAQ import?\nAnswer: To migrate curated knowledge into the system.").toString("base64");

      const previewRes = await request(app)
        .post("/api/faqs/import/preview")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          fileName: "faq-import.txt",
          fileContent: sampleBase64Text
        });

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.status).toBe("success");
      expect(Array.isArray(previewRes.body.data)).toBe(true);
      expect(previewRes.body.data.length).toBeGreaterThan(0);
      expect(previewRes.body.data[0]).toHaveProperty("question");
      expect(previewRes.body.data[0]).toHaveProperty("answer");

      const confirmRes = await request(app)
        .post("/api/faqs/import/confirm")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          faqs: previewRes.body.data.map((item) => ({
            question: item.question,
            answer: item.answer,
            category: item.category,
            tags: item.tags
          }))
        });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.status).toBe("success");
      expect(confirmRes.body.data.status).toBe("success");
      expect(confirmRes.body.data.imported.length).toBeGreaterThan(0);
    });
  });

  describe("Automatic Thread Generation from Document", () => {
    test("parses document and creates pending candidate question", async () => {
      const sampleBase64Text = Buffer.from("FAQ question: What is React Virtual DOM?\nAnswer: It is a lightweight representation of the actual DOM.").toString("base64");

      const res = await request(app)
        .post("/api/faqs/generate-thread")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          fileName: "react_faq.txt",
          fileContent: sampleBase64Text
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].status).toBe("pending");

      // Verify draft saved in SQLite user_queries review queue
      const db = getSQLiteDb();
      const dbQuery = await db.get("SELECT * FROM user_queries WHERE source = 'document_import' ORDER BY id DESC LIMIT 1");
      expect(dbQuery).toBeTruthy();
      expect(dbQuery.status).toBe("pending");
      expect(dbQuery.source).toBe("document_import");
    });
  });

  describe("Personalized Recommendations", () => {
    test("retrieves recommended FAQs", async () => {
      const res = await request(app)
        .get("/api/recommendations/faqs?limit=5")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe("Learning Paths", () => {
    let pathId;

    test("creates a new learning path", async () => {
      const res = await request(app)
        .post("/api/learning-paths")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          title: "Node.js Basics for Beginners",
          description: "Structured roadmap to learn Node.js development.",
          category: "Backend",
          items: [
            {
              faqId: faqId,
              position: 0
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.data.id).toBeTruthy();
      pathId = res.body.data.id;
    });

    test("lists learning paths", async () => {
      const res = await request(app).get("/api/learning-paths");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    test("gets learning path detail with populated FAQs", async () => {
      const res = await request(app).get(`/api/learning-paths/${pathId}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.title).toBe("Node.js Basics for Beginners");
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].faq.question).toBe("How to set up environment variables for testing?");
    });
  });

  describe("User Learning Journey", () => {
    test("tracks a faq view event implicitly during fetchAnswers", async () => {
      // Calling GET /api/answers/:id should trigger view tracking
      const res = await request(app)
        .get(`/api/answers/${faqId}?limit=10&offset=0`)
        .set("Authorization", `Bearer ${userToken}`);
      expect(res.status).toBe(200);

      // Verify event was saved to SQLite
      const db = getSQLiteDb();
      const event = await db.get("SELECT * FROM events WHERE type = 'faq_viewed' AND target_id = ?", faqId);
      expect(event).toBeTruthy();
    });

    test("retrieves user learning journey stats", async () => {
      const res = await request(app)
        .get("/api/stats/journey")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.viewedCount).toBeGreaterThan(0);
      expect(res.body.data.topicCoverage).toHaveProperty("Testing");
    });
  });
});
