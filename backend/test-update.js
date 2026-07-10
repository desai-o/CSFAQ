const { connectSQLite, getSQLiteDb } = require("./db/sqlite");
const express = require("express");

async function testUpdate() {
  await connectSQLite();
  const db = getSQLiteDb();
  
  // First create a test answer
  const result = await db.run(
    `INSERT INTO answers (question_id, content, author, user_id, author_name, synced_to_mongo, moderation_status) VALUES (?, ?, ?, ?, ?, 0, 'approved')`,
    "test-q-id", "Test answer content", "Test Author", "test-user", "Test Author"
  );
  console.log("Created answer with id:", result.lastID);
  
  // Now simulate the PATCH update
  const updateResult = await db.run(
    `UPDATE answers SET is_anonymous = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    1, result.lastID
  );
  console.log("Update result:", updateResult);
  
  // Read it back
  const updated = await db.get("SELECT * FROM answers WHERE id = ?", result.lastID);
  console.log("After update:", JSON.stringify(updated, null, 2));
  
  // Clean up
  await db.run("DELETE FROM answers WHERE id = ?", result.lastID);
  console.log("Cleaned up test answer");
}

testUpdate().catch(console.error);