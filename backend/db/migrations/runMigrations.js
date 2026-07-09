const fs = require("fs");
const path = require("path");

async function ensureMigrationsTable(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function runSqlFile(db, filePath) {
  const sql = fs.readFileSync(filePath, "utf8");

  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {
      await db.exec(`${statement};`);
    } catch (error) {
      if (error.message.includes("duplicate column name")) {
        console.log(`Skipping duplicate column migration statement: "${statement}"`);
        continue;
      }

      throw error;
    }
  }
}

async function runMigrations(db) {
  await ensureMigrationsTable(db);

  const migrationsDir = __dirname;

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const existing = await db.get(
      `
      SELECT *
      FROM schema_migrations
      WHERE filename = ?
      `,
      file
    );

    if (existing) continue;

    const fullPath = path.join(migrationsDir, file);
    
    await db.exec("BEGIN");
    try {
      await runSqlFile(db, fullPath);
      await db.run(
        `
        INSERT INTO schema_migrations (filename)
        VALUES (?)
        `,
        file
      );
      await db.exec("COMMIT");
      console.log(`Applied SQLite migration: ${file}`);
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
  }
}

module.exports = {
  runMigrations
};
