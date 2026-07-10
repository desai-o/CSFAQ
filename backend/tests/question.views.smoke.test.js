/**
 * Smoke test: opening a question (or FAQ) detail page must increment
 * the persisted view counter. We POST a new query/FAQ through the public
 * API, then fire the /view endpoint, and assert the counter ticks up.
 *
 * View counts are deduplicated per viewer (auth user > x-anonymous-id > IP)
 * for a sliding window (default 30 min), so we use distinct x-anonymous-id
 * values across requests that should each count as a new view.
 *
 * We also wipe the in-memory dedupe map between tests so the sliding
 * window can't bleed between test cases.
 */
const fs = require("fs");
const path = require("path");
const request = require("supertest");

const TEST_DB = path.join(__dirname, "test_question_views.sqlite");
process.env.SQLITE_PATH = TEST_DB;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-1234";

let app;
let clearRecentViews;

beforeAll(async () => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  app = require("../server");
  const { connectSQLite } = require("../db/sqlite");
  await connectSQLite();

  const viewDedupeService = require("../services/viewDedupeService");
  clearRecentViews = viewDedupeService.clearRecentViews;
});

beforeEach(() => {
  // Each test starts with a clean dedupe map so a view from the previous
  // test's viewer doesn't leak into this test's assertions.
  if (typeof clearRecentViews === "function") {
    clearRecentViews();
  }
});

afterAll(async () => {
  if (fs.existsSync(TEST_DB)) {
    try { fs.unlinkSync(TEST_DB); } catch (_) { /* ignore EBUSY on Windows */ }
  }
});

describe("Question / FAQ view counter", () => {
  test("POST /queries/:id/view increments the persisted view count", async () => {
    // Create a fresh query through the public POST endpoint.
    const create = await request(app)
      .post("/api/queries")
      .send({
        question: "Smoke: does this track views?",
        description: "Body text",
        category: "Programming",
        tags: ["smoke"]
      });
    expect([200, 201]).toContain(create.status);
    const id =
      create.body?.data?.id ??
      create.body?.data?._id ??
      create.body?.id ??
      create.body?._id;
    expect(id).toBeTruthy();

    // Initial views should be 0 — verifies the GET endpoint returns the
    // persisted views column from the SQLite schema (not a default/missing
    // value).
    const before = await request(app).get(`/api/queries/${id}`);
    expect(before.status).toBe(200);
    const beforeViews =
      before.body?.data?.views ?? before.body?.views ?? null;
    expect(beforeViews).toBe(0);

    // First distinct viewer -> counter goes from 0 -> 1.
    const viewRes = await request(app)
      .post(`/api/queries/${id}/view`)
      .set("x-anonymous-id", "viewer-a");
    expect(viewRes.status).toBe(200);
    const newViews = viewRes.body?.data?.views ?? viewRes.body?.views;
    expect(typeof newViews).toBe("number");
    expect(newViews).toBe(beforeViews + 1);
    expect(viewRes.body?.data?.deduped).toBe(false);

    // Same viewer (same anon id) within the dedup window -> NOT counted again.
    const viewResRepeat = await request(app)
      .post(`/api/queries/${id}/view`)
      .set("x-anonymous-id", "viewer-a");
    expect(viewResRepeat.status).toBe(200);
    expect(viewResRepeat.body?.data?.views).toBe(newViews);
    expect(viewResRepeat.body?.data?.deduped).toBe(true);

    // A new distinct viewer -> counter goes from 1 -> 2.
    const viewRes2 = await request(app)
      .post(`/api/queries/${id}/view`)
      .set("x-anonymous-id", "viewer-b");
    expect(viewRes2.status).toBe(200);
    const newer = viewRes2.body?.data?.views ?? viewRes2.body?.views;
    expect(newer).toBe(newViews + 1);
    expect(viewRes2.body?.data?.deduped).toBe(false);

    // The persisted view count survives a fresh GET round trip — this
    // proves the GET endpoint is reading the views column from the schema
    // (not caching or hardcoding a value).
    const after = await request(app).get(`/api/queries/${id}`);
    expect(after.status).toBe(200);
    const persisted = after.body?.data?.views ?? after.body?.views;
    expect(persisted).toBe(newer);
  });

  test("POST /faqs/:id/view increments the persisted view count", async () => {
    // Create a fresh FAQ through the public POST endpoint so we know the
    // exact starting state (avoids fragile probing of seeded data).
    const create = await request(app)
      .post("/api/faqs")
      .send({
        question: "Smoke FAQ: does this track views?",
        answer: "Body text for the smoke FAQ.",
        category: "Programming",
        tags: ["smoke"]
      });
    expect([200, 201]).toContain(create.status);
    const faqId =
      create.body?.data?.id ??
      create.body?.data?._id ??
      create.body?.id ??
      create.body?._id;
    expect(faqId).toBeTruthy();

    // Initial views should be 0 — verifies the GET endpoint returns the
    // persisted views column from the FAQ schema.
    const before = await request(app).get(`/api/faqs/${faqId}`);
    expect(before.status).toBe(200);
    const beforeViews =
      before.body?.data?.views ?? before.body?.views ?? null;
    expect(beforeViews).toBe(0);

    // First distinct viewer -> counter goes from 0 -> 1.
    const viewRes = await request(app)
      .post(`/api/faqs/${faqId}/view`)
      .set("x-anonymous-id", "viewer-c");
    expect(viewRes.status).toBe(200);
    const newViews = viewRes.body?.data?.views ?? viewRes.body?.views;
    expect(typeof newViews).toBe("number");
    expect(newViews).toBe(beforeViews + 1);
    expect(viewRes.body?.data?.deduped).toBe(false);

    // Same viewer (same anon id) within the dedup window -> NOT counted again.
    const viewResRepeat = await request(app)
      .post(`/api/faqs/${faqId}/view`)
      .set("x-anonymous-id", "viewer-c");
    expect(viewResRepeat.status).toBe(200);
    expect(viewResRepeat.body?.data?.views).toBe(newViews);
    expect(viewResRepeat.body?.data?.deduped).toBe(true);

    // A new distinct viewer -> counter goes from 1 -> 2.
    const viewRes2 = await request(app)
      .post(`/api/faqs/${faqId}/view`)
      .set("x-anonymous-id", "viewer-d");
    expect(viewRes2.status).toBe(200);
    const newer = viewRes2.body?.data?.views ?? viewRes2.body?.views;
    expect(newer).toBe(newViews + 1);
    expect(viewRes2.body?.data?.deduped).toBe(false);

    // The persisted view count survives a fresh GET round trip — proves the
    // FAQ GET endpoint is reading the views column from the schema.
    const after = await request(app).get(`/api/faqs/${faqId}`);
    expect(after.status).toBe(200);
    const persisted = after.body?.data?.views ?? after.body?.views;
    expect(persisted).toBe(newer);
  });
});
