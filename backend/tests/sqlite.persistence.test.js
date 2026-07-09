const fs = require("fs");
const path = require("path");

describe("SQLite persistence smoke test", () => {
  const testDbPath = path.join(__dirname, "test_faq_fallback.sqlite");

  beforeAll(() => {
    process.env.SQLITE_PATH = testDbPath;
  });

  afterAll(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test("sqlite module can initialize fallback database", async () => {
    jest.resetModules();

    const { connectSQLite, getSQLiteDb } = require("../db/sqlite");

    await connectSQLite();

    const db = getSQLiteDb();

    const tables = await db.all(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
    `);

    const tableNames = tables.map((table) => table.name);

    expect(tableNames).toContain("user_queries");
    expect(tableNames).toContain("faqs");
    expect(tableNames).toContain("answers");
    expect(tableNames).toContain("votes");
    expect(tableNames).toContain("bookmarks");
    expect(tableNames).toContain("events");
  });
});
