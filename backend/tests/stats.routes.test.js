const request = require("supertest");
const app = require("../server");
const { connectSQLite, closeSQLite } = require("../db/sqlite");

describe("stats overview route", () => {
  beforeAll(async () => {
    await connectSQLite();
  });

  beforeEach(async () => {
    const db = require("../db/sqlite").getSQLiteDb();
    await db.run("DELETE FROM user_queries");
    await db.run("DELETE FROM faqs");
    await db.run("DELETE FROM answers");
    await db.run("DELETE FROM users");
  });

  afterAll(async () => {
    await closeSQLite();
  });

  test("returns dashboard overview counts including user questions", async () => {
    const db = require("../db/sqlite").getSQLiteDb();
    await db.run(
      "INSERT INTO user_queries (question, answer, description, category, tags, user_id, author_name, status, source, synced_to_mongo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
      "How do I debug this?",
      "Use logs",
      "Need help",
      "Programming",
      "debug",
      "user-1",
      "Test User",
      "pending",
      "frontend"
    );

    const response = await request(app).get("/api/stats/overview");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data).toEqual(
      expect.objectContaining({
        questionsAsked: 1,
        activeMembers: 0,
        answersPosted: 0
      })
    );
  });
});
