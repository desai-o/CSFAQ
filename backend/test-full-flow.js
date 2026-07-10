const { connectSQLite, getSQLiteDb } = require("./db/sqlite");

async function testFullFlow() {
  await connectSQLite();
  const db = getSQLiteDb();
  
  // Create a test answer
  const result = await db.run(
    `INSERT INTO answers (question_id, content, author, user_id, author_name, is_anonymous, synced_to_mongo, moderation_status) VALUES (?, ?, ?, ?, ?, ?, 0, 'approved')`,
    "test-q-id", "Test answer for full flow", "Original Author", "test-user-123", "Original Author", 0
  );
  const answerId = result.lastID;
  console.log("Created answer id:", answerId);
  
  // Verify initial state
  let ans = await db.get("SELECT * FROM answers WHERE id = ?", answerId);
  console.log("1. Initial state - is_anonymous:", ans.is_anonymous);
  
  // Simulate PATCH update like the backend does
  const updateResult = await db.run(
    `UPDATE answers SET is_anonymous = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    1, answerId
  );
  console.log("2. Update result - changes:", updateResult.changes);
  
  // Verify update
  ans = await db.get("SELECT * FROM answers WHERE id = ?", answerId);
  console.log("3. After PATCH - is_anonymous:", ans.is_anonymous);
  
  // Now simulate what the GET endpoint would return (SELECT *)
  const getResult = await db.all("SELECT * FROM answers WHERE id = ?", answerId);
  console.log("4. GET result - is_anonymous:", getResult[0].is_anonymous);
  console.log("5. GET result - all fields:", Object.keys(getResult[0]));
  
  // Clean up
  await db.run("DELETE FROM answers WHERE id = ?", answerId);
  console.log("Cleaned up");
}

testFullFlow().catch(console.error);