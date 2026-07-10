/**
 * Universal Post-Merge Stability & Resilience Test Suite â€” Diagnostic v3
 *
 * Place this file at:
 *   backend/tests/universal.postmerge.diagnostic.test.js
 *
 * Or use it as the canonical suite:
 *   backend/tests/universal.postmerge.test.js
 *
 * Diagnostic goals:
 *   - Validate post-merge backend stability using SQLite fallback mode.
 *   - Produce actionable failure logs with method, endpoint, status, response body,
 *     generated IDs, test users, SQLite path, and table counts.
 *   - Avoid brittle assumptions around response-shape drift where the current
 *     codebase already supports multiple valid contracts.
 *   - Avoid external AI/network dependencies by mocking @google/genai and aiService.
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "postmerge-test-secret-change-me";
process.env.JWT_EXPIRES_IN = "1h";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.RATE_LIMIT_WINDOW_MS = "1000";
process.env.RATE_LIMIT_MAX = "10000";
process.env.SYNC_INTERVAL_MS = "600000";
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "postmerge-test-gemini-key";

jest.mock("morgan", () => () => (req, res, next) => next());

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn(async () => ({
        text: JSON.stringify({
          status: "approved",
          moderationStatus: "approved",
          confidence: 0.01,
          reason: "Deterministic post-merge mock response",
          summary: "Post-merge test summary stub"
        })
      }))
    }
  }))
}));

jest.mock("../services/aiService", () => ({
  generateSummary: jest.fn(async () => "Post-merge test summary stub")
}));

const fs = require("fs");
const os = require("os");
const path = require("path");
const util = require("util");
const request = require("supertest");
const mongoose = require("mongoose");

const sqlitePath = path.join(os.tmpdir(), `crowdfaq-postmerge-${process.pid}-${Date.now()}.sqlite`);
process.env.SQLITE_PATH = sqlitePath;
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27099/crowdfaq_postmerge_unavailable";

const app = require("../server");
const { connectSQLite, getSQLiteDb, closeSQLite } = require("../db/sqlite");
const { isMongoAvailable } = require("../db/mongo");
const { extractKeywords } = require("../services/syncService");
const { getQueueSize } = require("../services/queueService");

const DEBUG_POSTMERGE = process.env.DEBUG_POSTMERGE === "1";
const MAX_DIAGNOSTIC_CHARS = Number(process.env.POSTMERGE_DIAGNOSTIC_LIMIT || 10000);

const ctx = {
  sqlitePath,
  startedAt: new Date().toISOString(),
  users: {},
  ids: {
    faqId: null,
    queryId: null,
    answerId: null,
    notificationId: null
  }
};

let consoleLogSpy;
let consoleWarnSpy;
let consoleErrorSpy;

function installConsoleFilters() {
  if (DEBUG_POSTMERGE) return;

  consoleLogSpy = jest.spyOn(console, "log").mockImplementation((...args) => {
    const message = args.join(" ");
    const noisy =
      message.includes("Skipping duplicate column migration statement") ||
      message.includes("Applied SQLite migration:") ||
      message.includes("SQLite fallback ready");
    if (!noisy) process.stdout.write(`${message}\n`);
  });

  consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation((...args) => {
    const message = args.join(" ");
    const noisy =
      message.includes("API key should be set when using the Gemini API") ||
      message.includes("Gemini moderation call failed, using fallback") ||
      message.includes("API key not valid");
    if (!noisy) process.stderr.write(`${message}\n`);
  });

  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    const message = args.join(" ");
    const noisy =
      message.includes("Gemini moderation call failed, using fallback") ||
      message.includes("API key not valid");
    if (!noisy) process.stderr.write(`${message}\n`);
  });
}

function restoreConsoleFilters() {
  if (consoleLogSpy) consoleLogSpy.mockRestore();
  if (consoleWarnSpy) consoleWarnSpy.mockRestore();
  if (consoleErrorSpy) consoleErrorSpy.mockRestore();
}

function inspect(value) {
  const rendered = util.inspect(value, {
    depth: 8,
    colors: false,
    maxArrayLength: 40,
    breakLength: 120,
    sorted: true
  });
  return rendered.length > MAX_DIAGNOSTIC_CHARS
    ? `${rendered.slice(0, MAX_DIAGNOSTIC_CHARS)}\n...<truncated>`
    : rendered;
}

function redactHeaders(headers = {}) {
  const out = { ...headers };
  for (const key of Object.keys(out)) {
    if (["authorization", "cookie", "set-cookie"].includes(key.toLowerCase())) {
      out[key] = "<redacted>";
    }
  }
  return out;
}

function responseInfo(response, extra = {}) {
  return {
    method: response?.request?.method,
    url: response?.request?.url,
    status: response?.status,
    headers: redactHeaders(response?.headers),
    body: response?.body,
    text: response?.text,
    ...extra
  };
}

function diagnostic(title, details = {}) {
  return `\n\n[Universal Post-Merge Diagnostic]\n${inspect({ title, ctx, ...details })}\n`;
}

function fail(title, details = {}) {
  throw new Error(diagnostic(title, details));
}

function assertCondition(condition, title, details = {}) {
  if (!condition) fail(title, details);
}

function assertStatus(response, expected, details = {}) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(response.status)) {
    fail("Unexpected HTTP status", {
      expectedStatus: allowed,
      actualStatus: response.status,
      ...responseInfo(response, details)
    });
  }
}

function assertSuccessEnvelope(response, details = {}) {
  const body = response?.body || response;
  if (!body || body.status !== "success" || !Object.prototype.hasOwnProperty.call(body, "data")) {
    fail("Response did not match success envelope", {
      expected: "{ status: 'success', data: <present> }",
      actualBody: body,
      ...details
    });
  }
}

function assertErrorEnvelope(response, details = {}) {
  const body = response?.body || response;
  if (!body || body.status !== "error" || !body.code || !body.message) {
    fail("Response did not match error envelope", {
      expected: "{ status: 'error', code: <present>, message: <present> }",
      actualBody: body,
      ...details
    });
  }
}

function bearer(token) {
  if (!token) fail("Attempted to create Authorization header without token", { users: ctx.users });
  return `Bearer ${token}`;
}

function extractAuthPayload(response) {
  const body = response?.body || {};
  return {
    token: body.meta?.token || body.token,
    user: body.meta?.user || body.user || body.data
  };
}

function assertAuthPayload(response, details = {}) {
  const payload = extractAuthPayload(response);
  if (!payload.token || !payload.user) {
    fail("Auth response missing token or user metadata", {
      acceptedShapes: [
        "{ status, storage, data, meta: { token, user } }",
        "{ status, storage, data, token, user }"
      ],
      extractedPayload: payload,
      ...responseInfo(response, details)
    });
  }
  return payload;
}

async function tableCounts() {
  const names = [
    "users",
    "faqs",
    "user_queries",
    "answers",
    "votes",
    "bookmarks",
    "follows",
    "notifications",
    "events",
    "schema_migrations"
  ];

  try {
    const db = getSQLiteDb();
    const counts = {};
    for (const name of names) {
      try {
        const row = await db.get(`SELECT COUNT(*) AS count FROM ${name}`);
        counts[name] = row.count;
      } catch (error) {
        counts[name] = `<error: ${error.message}>`;
      }
    }
    return counts;
  } catch (error) {
    return { error: error.message };
  }
}

async function recentRows(table, limit = 3) {
  try {
    const db = getSQLiteDb();
    return await db.all(`SELECT * FROM ${table} ORDER BY id DESC LIMIT ?`, limit);
  } catch (error) {
    return [{ error: error.message }];
  }
}

async function signupUser(label, email, password = "PostMerge@123") {
  const response = await request(app)
    .post("/api/auth/signup")
    .send({ name: `PostMerge ${label}`, email, password });

  assertStatus(response, 201, { operation: "signup", label, email });
  assertSuccessEnvelope(response, responseInfo(response, { operation: "signup", label, email }));

  const payload = assertAuthPayload(response, { operation: "signup", label, email });
  ctx.users[label] = {
    token: payload.token,
    user: payload.user,
    password
  };
  return ctx.users[label];
}

async function loginUser(labelOrEmail, password) {
  const userRecord = ctx.users[labelOrEmail];
  const email = userRecord?.user?.email || labelOrEmail;
  const actualPassword = password || userRecord?.password;

  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password: actualPassword });

  assertStatus(response, 200, { operation: "login", email });
  assertSuccessEnvelope(response, responseInfo(response, { operation: "login", email }));

  const payload = assertAuthPayload(response, { operation: "login", email });
  if (userRecord) {
    userRecord.token = payload.token;
    userRecord.user = payload.user;
  }
  return payload.token;
}

async function promoteUserToAdmin(userRecord) {
  const db = getSQLiteDb();
  const id = userRecord.user.id;
  const email = userRecord.user.email;
  const result = await db.run(
    `
    UPDATE users
    SET role = 'admin'
    WHERE id = ? OR email = ? OR mongo_id = ?
    `,
    id,
    email,
    id
  );

  if (result.changes === 0) {
    fail("SQLite admin promotion changed zero rows", {
      id,
      email,
      counts: await tableCounts(),
      recentUsers: await recentRows("users")
    });
  }
}

async function setupSharedState() {
  const stamp = Date.now();

  await signupUser("primary", `postmerge.primary.${stamp}@example.com`);
  await signupUser("contributor", `postmerge.contributor.${stamp}@example.com`);
  await signupUser("admin", `postmerge.admin.${stamp}@example.com`);

  await promoteUserToAdmin(ctx.users.admin);
  await loginUser("admin");

  const me = await request(app)
    .get("/api/auth/me")
    .set("Authorization", bearer(ctx.users.primary.token));

  assertStatus(me, 200, { operation: "verify primary token" });
  assertSuccessEnvelope(me, responseInfo(me, { operation: "verify primary token" }));

  const adminOverview = await request(app)
    .get("/api/admin/overview")
    .set("Authorization", bearer(ctx.users.admin.token));

  assertStatus(adminOverview, 200, { operation: "verify admin token and role" });
  assertSuccessEnvelope(adminOverview, responseInfo(adminOverview, { operation: "verify admin token and role" }));
}

async function searchWithCompatiblePayload() {
  const attempts = [
    { query: "fallback storage postmerge" },
    { keywords: ["fallback", "storage", "postmerge"] },
    { keyword: "postmerge" },
    { q: "postmerge" }
  ];

  const history = [];
  for (const payload of attempts) {
    const response = await request(app).post("/api/search").send(payload);
    history.push(responseInfo(response, { payload }));
    if (response.status < 400) {
      return { response, payload, history };
    }
  }

  return {
    response: { status: history[history.length - 1].status, body: history[history.length - 1].body },
    payload: attempts[attempts.length - 1],
    history
  };
}

function assertImplementedOrUnimplementedEndpointContract(response, details = {}) {
  assertCondition(response.status < 500, "Roadmap-related endpoint crashed", responseInfo(response, details));

  if (response.status === 404) {
    assertErrorEnvelope(response, responseInfo(response, details));
    assertCondition(
      response.body.code === "ROUTE_NOT_FOUND",
      "Unimplemented roadmap endpoint should return ROUTE_NOT_FOUND",
      responseInfo(response, details)
    );
    return;
  }

  if (response.status >= 400) {
    assertErrorEnvelope(response, responseInfo(response, details));
    return;
  }

  const contentDisposition = response.headers?.["content-disposition"] || "";
  const contentType = response.headers?.["content-type"] || "";
  const isDownloadOrRawExport =
    contentDisposition.includes("attachment") ||
    Array.isArray(response.body) ||
    contentType.includes("text/csv") ||
    contentType.includes("text/markdown") ||
    contentType.includes("application/pdf");

  if (isDownloadOrRawExport) {
    assertCondition(
      response.body !== undefined || typeof response.text === "string",
      "Implemented export/download endpoint returned an empty body",
      responseInfo(response, details)
    );
    return;
  }

  assertSuccessEnvelope(response, responseInfo(response, details));
}

describe("Universal post-merge stability and resilience â€” diagnostic v3", () => {
  beforeAll(async () => {
    installConsoleFilters();
    try {
      await connectSQLite();
      await setupSharedState();
    } catch (error) {
      fail("Shared post-merge setup failed", {
        error: { message: error.message, stack: error.stack },
        counts: await tableCounts()
      });
    }
  });

  afterAll(async () => {
    const cleanupErrors = [];

    try {
      await closeSQLite();
    } catch (error) {
      cleanupErrors.push({ step: "closeSQLite", message: error.message, stack: error.stack });
    }

    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch (error) {
      cleanupErrors.push({ step: "mongoose.close", message: error.message, stack: error.stack });
    }

    for (const suffix of ["", "-wal", "-shm"]) {
      const file = `${sqlitePath}${suffix}`;
      try {
        if (fs.existsSync(file)) fs.rmSync(file, { force: true });
      } catch (error) {
        cleanupErrors.push({ step: "removeSqliteFile", file, message: error.message, stack: error.stack });
      }
    }

    restoreConsoleFilters();

    if (cleanupErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.error(diagnostic("Post-merge cleanup completed with errors", { cleanupErrors }));
    }
  });

  test("health endpoint and queue state are operational", async () => {
    assertCondition(typeof getQueueSize() === "number", "Queue size is not numeric", {
      queueSize: getQueueSize()
    });

    const response = await request(app).get("/health");
    assertStatus(response, 200, { operation: "GET /health" });
    assertCondition(["ok", "degraded"].includes(response.body.status), "Health status is invalid", responseInfo(response));
    assertCondition(typeof response.body.mongoAvailable === "boolean", "Health mongoAvailable is not boolean", responseInfo(response));
    assertCondition(typeof response.body.sqliteAvailable === "boolean", "Health sqliteAvailable is not boolean", responseInfo(response));
    assertCondition(response.body.sqliteAvailable === true, "SQLite should be available during post-merge tests", responseInfo(response));
    assertCondition(typeof response.body.queueSize === "number", "Health queueSize is not numeric", responseInfo(response));
  });

  test("SQLite fallback schema and migrations are initialized", async () => {
    const db = getSQLiteDb();
    const requiredTables = [
      "users",
      "faqs",
      "user_queries",
      "answers",
      "votes",
      "bookmarks",
      "follows",
      "notifications",
      "events",
      "schema_migrations"
    ];

    const existing = await db.all("SELECT type, name FROM sqlite_master ORDER BY type, name");
    const existingNames = new Set(existing.filter((row) => row.type === "table").map((row) => row.name));
    const missing = requiredTables.filter((table) => !existingNames.has(table));

    assertCondition(missing.length === 0, "SQLite fallback schema is missing required tables", {
      missing,
      requiredTables,
      sqliteMaster: existing
    });

    const migrations = await db.all("SELECT filename FROM schema_migrations ORDER BY filename ASC");
    assertCondition(migrations.length >= 1, "No SQLite migrations were recorded", {
      migrations,
      counts: await tableCounts()
    });
  });

  test("authentication rejects anonymous profile access and invalid credentials", async () => {
    const anonymous = await request(app).get("/api/auth/me");
    assertStatus(anonymous, 401, { operation: "anonymous /api/auth/me" });
    assertErrorEnvelope(anonymous, responseInfo(anonymous));
    assertCondition(anonymous.body.code === "AUTH_REQUIRED", "Anonymous /me returned wrong error code", responseInfo(anonymous));

    const invalidSignup = await request(app)
      .post("/api/auth/signup")
      .send({ name: "", email: "bad@example.com", password: "123" });
    assertStatus(invalidSignup, 400, { operation: "invalid signup" });
    assertErrorEnvelope(invalidSignup, responseInfo(invalidSignup));

    const invalidLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "missing@example.com", password: "wrong-password" });
    assertStatus(invalidLogin, 400, { operation: "invalid login" });
    assertErrorEnvelope(invalidLogin, responseInfo(invalidLogin));
    assertCondition(invalidLogin.body.code === "INVALID_CREDENTIALS", "Invalid login returned wrong code", responseInfo(invalidLogin));
  });

  test("signup/login setup, JWT profile resolution, and admin role are valid", async () => {
    const primaryMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", bearer(ctx.users.primary.token));

    assertStatus(primaryMe, 200, { operation: "primary /me" });
    assertSuccessEnvelope(primaryMe, responseInfo(primaryMe));
    assertCondition(
      primaryMe.body.data.email === ctx.users.primary.user.email,
      "Primary /me resolved wrong user",
      { expectedEmail: ctx.users.primary.user.email, actual: primaryMe.body.data }
    );

    const adminOverview = await request(app)
      .get("/api/admin/overview")
      .set("Authorization", bearer(ctx.users.admin.token));

    assertStatus(adminOverview, 200, { operation: "admin overview" });
    assertSuccessEnvelope(adminOverview, responseInfo(adminOverview));

    for (const field of ["users", "faqs", "queries", "answers"]) {
      assertCondition(
        typeof adminOverview.body.data[field] === "number",
        `Admin overview field ${field} is not numeric`,
        responseInfo(adminOverview)
      );
    }
  });

  test("protected routes reject anonymous write access", async () => {
    const cases = [
      ["DELETE", "/api/faqs/not-a-real-id", () => request(app).delete("/api/faqs/not-a-real-id")],
      ["DELETE", "/api/answers/not-a-real-id", () => request(app).delete("/api/answers/not-a-real-id")],
      ["POST", "/api/bookmarks", () => request(app).post("/api/bookmarks").send({ questionId: "1" })],
      ["POST", "/api/follows", () => request(app).post("/api/follows").send({ followableType: "tag", followableId: "postmerge" })]
    ];

    for (const [method, endpoint, makeRequest] of cases) {
      const response = await makeRequest();
      assertStatus(response, 401, { operation: "anonymous write rejection", method, endpoint });
      assertErrorEnvelope(response, responseInfo(response, { method, endpoint }));
    }
  });

  test("FAQ create/list/search contract remains stable on SQLite fallback", async () => {
    assertCondition(isMongoAvailable() === false, "Test expected MongoDB to be unavailable for fallback validation", {
      mongoReadyState: mongoose.connection.readyState,
      mongoUri: process.env.MONGO_URI
    });

    const create = await request(app)
      .post("/api/faqs")
      .set("Authorization", bearer(ctx.users.primary.token))
      .send({
        question: "How does the post-merge stability suite validate fallback storage?",
        answer: "It writes through the public API, verifies SQLite persistence, and checks response envelopes.",
        category: "Testing",
        tags: ["postmerge", "sqlite", "resilience"]
      });

    assertStatus(create, 201, { operation: "create FAQ" });
    assertSuccessEnvelope(create, responseInfo(create));
    assertCondition(create.body.storage === "sqlite", "FAQ create did not use SQLite fallback", responseInfo(create));

    ctx.ids.faqId = String(create.body.data.id || create.body.data._id || "");
    assertCondition(ctx.ids.faqId.length > 0, "FAQ create response did not include id", responseInfo(create));

    const list = await request(app).get("/api/faqs?limit=10&offset=0");
    assertStatus(list, 200, { operation: "list FAQs" });
    assertSuccessEnvelope(list, responseInfo(list));
    assertCondition(Array.isArray(list.body.data), "FAQ list data is not an array", responseInfo(list));

    const searchResult = await searchWithCompatiblePayload();
    const search = searchResult.response;
    assertStatus(search, 200, {
      operation: "search",
      payload: searchResult.payload,
      history: searchResult.history
    });
    assertCondition(
      (search.body.status || "success") === "success",
      "Search did not return success-compatible body",
      responseInfo(search, { payload: searchResult.payload, history: searchResult.history })
    );
  });

  test("query submission and validation paths remain stable", async () => {
    const invalid = await request(app)
      .post("/api/queries")
      .set("Authorization", bearer(ctx.users.primary.token))
      .send({ question: "no" });

    assertStatus(invalid, 400, { operation: "invalid query should be rejected" });
    assertErrorEnvelope(invalid, responseInfo(invalid));

    const create = await request(app)
      .post("/api/queries")
      .set("Authorization", bearer(ctx.users.primary.token))
      .send({
        question: "What should a universal post-merge test catch after integration?",
        description: "It should catch broken auth, persistence, routes, validation, and fallback behavior.",
        category: "Testing",
        tags: ["postmerge", "ci"]
      });

    assertStatus(create, 201, { operation: "create query" });
    assertSuccessEnvelope(create, responseInfo(create));
    ctx.ids.queryId = String(create.body.data.id || create.body.data._id || "");
    assertCondition(ctx.ids.queryId.length > 0, "Query create response did not include id", responseInfo(create));

    const list = await request(app).get("/api/queries?limit=10&offset=0");
    assertStatus(list, 200, { operation: "list queries" });
    assertSuccessEnvelope(list, responseInfo(list));
    assertCondition(Array.isArray(list.body.data), "Query list data is not an array", responseInfo(list));
  });

  test("answers require valid targets, ignore author spoofing, and trigger stable reads", async () => {
    assertCondition(Boolean(ctx.ids.faqId), "FAQ id missing before answer test", { ids: ctx.ids });

    const missingTarget = await request(app)
      .post("/api/answers")
      .set("Authorization", bearer(ctx.users.contributor.token))
      .send({ content: "This answer has no target." });

    assertStatus(missingTarget, 400, { operation: "answer missing target" });
    assertErrorEnvelope(missingTarget, responseInfo(missingTarget));

    const missingQuestion = await request(app)
      .post("/api/answers")
      .set("Authorization", bearer(ctx.users.contributor.token))
      .send({ questionId: "999999999", content: "This target should not exist." });

    assertStatus(missingQuestion, 404, { operation: "answer missing referenced question" });
    assertErrorEnvelope(missingQuestion, responseInfo(missingQuestion));

    const create = await request(app)
      .post("/api/answers")
      .set("Authorization", bearer(ctx.users.contributor.token))
      .send({
        questionId: ctx.ids.faqId,
        content: "A resilient post-merge test validates real request flows and storage contracts.",
        author: "Spoofed Author Name"
      });

    assertStatus(create, 201, { operation: "create answer" });
    assertSuccessEnvelope(create, responseInfo(create));
    assertCondition(create.body.storage === "sqlite", "Answer create did not use SQLite fallback", responseInfo(create));

    ctx.ids.answerId = String(create.body.data.id || create.body.data._id || "");
    assertCondition(ctx.ids.answerId.length > 0, "Answer create response did not include id", responseInfo(create));
    assertCondition(create.body.data.author !== "Spoofed Author Name", "Answer route accepted spoofed author field", responseInfo(create));

    const answers = await request(app).get(`/api/answers/${ctx.ids.faqId}?limit=10&offset=0`);
    assertStatus(answers, 200, { operation: "fetch FAQ answers", faqId: ctx.ids.faqId });
    assertSuccessEnvelope(answers, responseInfo(answers));
    assertCondition(Array.isArray(answers.body.data), "Answers list data is not an array", responseInfo(answers));
  });

  test("votes, bookmarks, and follows preserve interaction contracts", async () => {
    assertCondition(Boolean(ctx.ids.answerId), "Answer id missing before interaction test", { ids: ctx.ids });

    const vote = await request(app)
      .post("/api/votes")
      .set("Authorization", bearer(ctx.users.primary.token))
      .send({ targetType: "answer", targetId: ctx.ids.answerId, value: 1 });

    assertStatus(vote, [200, 201], { operation: "toggle vote" });
    assertSuccessEnvelope(vote, responseInfo(vote));

    const bookmark = await request(app)
      .post("/api/bookmarks")
      .set("Authorization", bearer(ctx.users.primary.token))
      .send({ questionId: ctx.ids.faqId });

    assertStatus(bookmark, [200, 201], { operation: "toggle bookmark" });
    assertSuccessEnvelope(bookmark, responseInfo(bookmark));
    const bookmarkAction = bookmark.body.meta?.action || bookmark.body.action;
    assertCondition(
      ["created", "removed"].includes(bookmarkAction),
      "Bookmark action is invalid",
      responseInfo(bookmark, { acceptedLocations: ["body.meta.action", "body.action"], bookmarkAction })
    );

    const bookmarks = await request(app)
      .get("/api/bookmarks?limit=10&offset=0")
      .set("Authorization", bearer(ctx.users.primary.token));

    assertStatus(bookmarks, 200, { operation: "list bookmarks" });
    assertSuccessEnvelope(bookmarks, responseInfo(bookmarks));
    assertCondition(Array.isArray(bookmarks.body.data), "Bookmarks data is not an array", responseInfo(bookmarks));

    const follow = await request(app)
      .post("/api/follows")
      .set("Authorization", bearer(ctx.users.primary.token))
      .send({ followableType: "tag", followableId: "postmerge-universal" });

    assertStatus(follow, [201, 409], { operation: "create/detect duplicate follow" });
    if (follow.status === 201) assertSuccessEnvelope(follow, responseInfo(follow));
    else assertErrorEnvelope(follow, responseInfo(follow));
  });

  test("notifications list, mark-read, mark-one-read, and ownership-safe delete remain stable", async () => {
    const db = getSQLiteDb();
    const insert = await db.run(
      `
      INSERT INTO notifications (
        user_id,
        message,
        event_type,
        followable_type,
        followable_id,
        is_read,
        synced_to_mongo
      )
      VALUES (?, ?, ?, ?, ?, 0, 0)
      `,
      ctx.users.primary.user.id,
      "Post-merge notification contract check",
      "postmerge_check",
      "question",
      ctx.ids.faqId
    );

    ctx.ids.notificationId = insert.lastID;
    assertCondition(Boolean(insert.lastID), "Failed to seed notification", {
      insert,
      counts: await tableCounts(),
      recentNotifications: await recentRows("notifications")
    });

    const list = await request(app)
      .get("/api/notifications?limit=10&offset=0")
      .set("Authorization", bearer(ctx.users.primary.token));

    assertStatus(list, 200, { operation: "list notifications" });
    assertSuccessEnvelope(list, responseInfo(list));
    assertCondition(Array.isArray(list.body.data), "Notifications data is not an array", responseInfo(list));

    const first = list.body.data[0];
    assertCondition(first && typeof first.id === "string" && typeof first.isRead === "boolean", "Notification normalization contract changed", responseInfo(list, { first }));

    const markOne = await request(app)
      .patch(`/api/notifications/${insert.lastID}/read`)
      .set("Authorization", bearer(ctx.users.primary.token));
    assertStatus(markOne, 200, { operation: "mark one notification read" });
    assertSuccessEnvelope(markOne, responseInfo(markOne));

    const markAll = await request(app)
      .patch("/api/notifications/read")
      .set("Authorization", bearer(ctx.users.primary.token));
    assertStatus(markAll, 200, { operation: "mark all notifications read" });
    assertSuccessEnvelope(markAll, responseInfo(markAll));

    const unauthorizedDelete = await request(app)
      .delete(`/api/notifications/${insert.lastID}`)
      .set("Authorization", bearer(ctx.users.contributor.token));
    assertStatus(unauthorizedDelete, 404, { operation: "non-owner delete notification should not reveal/delete" });
    assertErrorEnvelope(unauthorizedDelete, responseInfo(unauthorizedDelete));

    const authorizedDelete = await request(app)
      .delete(`/api/notifications/${insert.lastID}`)
      .set("Authorization", bearer(ctx.users.primary.token));
    assertStatus(authorizedDelete, 200, { operation: "owner delete notification" });
    assertSuccessEnvelope(authorizedDelete, responseInfo(authorizedDelete));
  });

  test("stats and admin endpoints provide resilient read contracts", async () => {
    const activity = await request(app).get("/api/stats/activity");
    assertStatus(activity, 200, { operation: "activity stats" });
    assertCondition((activity.body.status || "success") === "success", "Activity stats body is not success-compatible", responseInfo(activity));

    const heatmap = await request(app).get("/api/stats/heatmap");
    assertStatus(heatmap, 200, { operation: "heatmap stats" });
    assertCondition((heatmap.body.status || "success") === "success", "Heatmap stats body is not success-compatible", responseInfo(heatmap));

    const pending = await request(app)
      .get("/api/admin/pending-queries")
      .set("Authorization", bearer(ctx.users.admin.token));

    assertStatus(pending, 200, { operation: "admin pending queries" });
    assertSuccessEnvelope(pending, responseInfo(pending));
    assertCondition(Array.isArray(pending.body.data), "Admin pending queries data is not an array", responseInfo(pending));
  });

  test("roadmap-related endpoints are stable whether unimplemented or implemented", async () => {
    const probes = [
      ["get", "/api/export?format=json"],
      ["post", "/api/duplicates/check", { query: "postmerge" }],
      ["get", "/api/admin/knowledge-gaps"],
      ["post", "/api/chat", { message: "postmerge", query: "postmerge" }],
      ["get", `/api/faqs/${ctx.ids.faqId}/revisions`],
      ["post", `/api/faqs/${ctx.ids.faqId}/flag-stale`, { reason: "postmerge probe" }],
      ["get", "/api/recommendations/faqs"],
      ["get", "/api/contributors/leaderboard"]
    ];

    for (const [method, endpoint, payload = {}] of probes) {
      const response = await request(app)[method](endpoint)
        .set("Authorization", bearer(ctx.users.admin.token))
        .send(payload);

      assertImplementedOrUnimplementedEndpointContract(response, { endpoint, method, payload });
    }
  });

  test("core service utility remains deterministic for sync/search support", () => {
    const input = "How can post merge resilience tests validate MongoDB SQLite fallback and notification sync?";
    const keywords = extractKeywords(input);

    assertCondition(Array.isArray(keywords), "extractKeywords did not return an array", { input, keywords });
    assertCondition(keywords.length > 0, "extractKeywords returned no keywords", { input, keywords });

    const required = ["post", "merge", "resilience"];
    const missing = required.filter((word) => !keywords.includes(word));
    assertCondition(missing.length === 0, "extractKeywords missing expected deterministic keywords", {
      input,
      keywords,
      required,
      missing
    });
  });
});
