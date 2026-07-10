const request = require("supertest");
const { app, bootstrap } = require("../server");
const { getSQLiteDb } = require("../db/sqlite");

let db;
let testUserId;

beforeAll(async () => {
  process.env.SQLITE_PATH = ":memory:";
  await bootstrap();
  db = getSQLiteDb();
  
  // create a dummy user
  const res = await db.run("INSERT INTO users (username, reputation) VALUES ('testuser', 0)");
  testUserId = res.lastID;
});

afterAll(async () => {
  const mongoose = require("mongoose");
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

describe("Anonymous Mode QA", () => {
  let createdPostId;

  it("1. A user successfully submits a post with is_anonymous=true and the backend saves it accurately", async () => {
    const res = await request(app)
      .post("/api/faqs")
      .send({
        question: "How do I test this?",
        answer: "Like this.",
        is_anonymous: true,
        user_id: testUserId
      });
    
    expect(res.status).toBe(201);
    expect(res.body.data?.id || res.body.id || res.body.data?._id).toBeDefined();
    createdPostId = res.body.data ? (res.body.data.id || res.body.data._id) : res.body.id;

    // Verify it saved accurately in sqlite
    const saved = await db.get("SELECT * FROM faqs WHERE id = ?", createdPostId);
    expect(saved.is_anonymous).toBe(1);
    expect(saved.author_id).toBe(testUserId);
  });

  it("2. An API request for an anonymous post strictly returns the masked 'Anonymous' payload and completely excludes the original author's profile data", async () => {
    const res = await request(app).get("/api/faqs");
    expect(res.status).toBe(200);

    const post = res.body.data.find(p => String(p.id) === String(createdPostId) || String(p._id) === String(createdPostId));
    expect(post).toBeDefined();
    
    // Check masks
    expect(post.author_id).toBeUndefined();
    expect(post.real_name).toBeUndefined();
    expect(post.author_name).toBe("Anonymous User");
    expect(post.username).toBe("anonymous");
  });

  it("3. An anonymous post being upvoted still correctly routes the reputation points to the original author's account in the database", async () => {
    const res = await request(app).post(`/api/faqs/${createdPostId}/upvote`);
    expect(res.status).toBe(200);

    const user = await db.get("SELECT reputation FROM users WHERE id = ?", testUserId);
    expect(user.reputation).toBe(10); // started at 0
  });
});
