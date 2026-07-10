require("dotenv").config();
const mongoose = require("mongoose");
const { connectMongo } = require("../db/mongo");
const { connectSQLite, getSQLiteDb } = require("../db/sqlite");
const FAQ = require("../models/FAQ");
const UserQuery = require("../models/UserQuery");
const Answer = require("../models/Answer");

async function migrate() {
  console.log("Starting migration 02_add_upvotes_field...");

  // Connect to databases
  await connectSQLite();
  await connectMongo();

  const sqliteDb = getSQLiteDb();

  // 1. Migrate SQLite
  console.log("Migrating SQLite tables...");

  const sqliteTargets = [
    { table: "user_queries", column: "upvotes" },
    { table: "faqs", column: "upvotes" },
    { table: "answers", column: "upvotes" },
    { table: "faq_revisions", column: "upvotes" },
    { table: "query_revisions", column: "upvotes" }
  ];

  for (const { table, column } of sqliteTargets) {
    try {
      await sqliteDb.exec(`ALTER TABLE ${table} ADD COLUMN ${column} INTEGER DEFAULT 0;`);
      console.log(`Added ${column} to ${table}`);
    } catch (err) {
      if (err.message.includes("duplicate column name")) {
        console.log(`Column ${column} already exists in ${table}`);
      } else {
        console.error(`Error adding ${column} to ${table}:`, err.message);
      }
    }
  }

  // 2. Migrate MongoDB
  if (mongoose.connection.readyState === 1) {
    console.log("Migrating MongoDB collections...");

    const faqResult = await FAQ.updateMany(
      { upvotes: { $exists: false } },
      { $set: { upvotes: 0 } }
    );
    console.log(`Updated ${faqResult.modifiedCount} FAQ documents`);

    const queryResult = await UserQuery.updateMany(
      { upvotes: { $exists: false } },
      { $set: { upvotes: 0 } }
    );
    console.log(`Updated ${queryResult.modifiedCount} UserQuery documents`);

    const answerResult = await Answer.updateMany(
      { upvotes: { $exists: false } },
      { $set: { upvotes: 0 } }
    );
    console.log(`Updated ${answerResult.modifiedCount} Answer documents`);
  } else {
    console.warn("MongoDB is not connected. Skipping MongoDB migration.");
  }

  console.log("Migration complete.");
  process.exit(0);
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});