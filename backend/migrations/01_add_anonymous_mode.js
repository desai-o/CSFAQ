require("dotenv").config();
const mongoose = require("mongoose");
const { connectMongo } = require("../db/mongo");
const { connectSQLite, getSQLiteDb } = require("../db/sqlite");
const FAQ = require("../models/FAQ");
const UserQuery = require("../models/UserQuery");
const Answer = require("../models/Answer");

async function migrate() {
  console.log("Starting migration 01_add_anonymous_mode...");

  // Connect to databases
  await connectSQLite();
  await connectMongo();

  const sqliteDb = getSQLiteDb();

  // 1. Migrate SQLite
  console.log("Migrating SQLite tables...");
  
  const tables = ["user_queries", "faqs", "answers"];
  for (const table of tables) {
    try {
      await sqliteDb.exec(`ALTER TABLE ${table} ADD COLUMN author_id INTEGER;`);
      console.log(`Added author_id to ${table}`);
    } catch (err) {
      if (err.message.includes("duplicate column name")) {
        console.log(`Column author_id already exists in ${table}`);
      } else {
        console.error(`Error adding author_id to ${table}:`, err.message);
      }
    }

    try {
      await sqliteDb.exec(`ALTER TABLE ${table} ADD COLUMN is_anonymous BOOLEAN DEFAULT 0;`);
      console.log(`Added is_anonymous to ${table}`);
    } catch (err) {
      if (err.message.includes("duplicate column name")) {
        console.log(`Column is_anonymous already exists in ${table}`);
      } else {
        console.error(`Error adding is_anonymous to ${table}:`, err.message);
      }
    }
  }

  // 2. Migrate MongoDB
  if (mongoose.connection.readyState === 1) {
    console.log("Migrating MongoDB collections...");
    
    const faqResult = await FAQ.updateMany(
      { is_anonymous: { $exists: false } },
      { $set: { is_anonymous: false, author_id: null } }
    );
    console.log(`Updated ${faqResult.modifiedCount} FAQ documents`);

    const queryResult = await UserQuery.updateMany(
      { is_anonymous: { $exists: false } },
      { $set: { is_anonymous: false, author_id: null } }
    );
    console.log(`Updated ${queryResult.modifiedCount} UserQuery documents`);

    const answerResult = await Answer.updateMany(
      { isAnonymous: { $exists: false } },
      { $set: { isAnonymous: false } }
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
