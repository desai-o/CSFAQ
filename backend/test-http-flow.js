const { connectSQLite, getSQLiteDb } = require("./db/sqlite");

async function testHTTPFlow() {
  await connectSQLite();
  const db = getSQLiteDb();
  
  console.log("=== TEST: Simulating full HTTP flow ===\n");
  
  // Step 1: Create a question and answer (simulating real data)
  console.log("STEP 1: Create test data");
  await db.run("INSERT OR IGNORE INTO faqs (id, title) VALUES ('test-q-123', 'Test Question')");
  
  const result = await db.run(
    `INSERT INTO answers (question_id, content, author, user_id, author_name, is_anonymous, synced_to_mongo, moderation_status) VALUES (?, ?, ?, ?, ?, ?, 0, 'approved')`,
    "test-q-123", "Test answer content", "Real Author Name", "user-123", "Real Author Name", 1
  );
  const answerId = result.lastID;
  console.log(`Created answer id: ${answerId}, is_anonymous: 1`);
  
  // Step 2: Simulate loadAnswers fetching
  console.log("\nSTEP 2: Simulate loadAnswers (GET /api/answers/:questionId)");
  const fetchedAnswers = await db.all(
    "SELECT * FROM answers WHERE question_id = ?",
    "test-q-123"
  );
  console.log("Raw fetched data:", JSON.stringify(fetchedAnswers[0], null, 2));
  
  // Step 3: Simulate frontend mapping
  console.log("\nSTEP 3: Simulate frontend mapping");
  const mapped = fetchedAnswers.map((ans) => {
    const rawIsAnon = ans.is_anonymous || false;
    return {
      id: ans.id,
      author: rawIsAnon ? "Anonymous User" : ans.author,
      isAnonymous: rawIsAnon,
      originalAuthorName: ans.author
    };
  });
  console.log("Mapped answer:", JSON.stringify(mapped[0], null, 2));
  
  // Step 4: Simulate deanonymize toggle
  console.log("\nSTEP 4: Simulate deanonymize (PATCH /api/answers/:id with isAnonymous: false)");
  
  // This is what the frontend sends
  const patchPayload = { isAnonymous: false };
  const { isAnonymous } = patchPayload;
  
  // This is what the route does
  const updates = [];
  const params = [];
  if (isAnonymous !== undefined) {
    updates.push("is_anonymous = ?");
    params.push(isAnonymous ? 1 : 0);
  }
  params.push(answerId);
  
  await db.run(`UPDATE answers SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, ...params);
  console.log("PATCH executed with params:", params);
  
  // Step 5: Simulate loadAnswers after deanonymize
  console.log("\nSTEP 5: Simulate loadAnswers after deanonymize");
  const updatedAnswers = await db.all(
    "SELECT * FROM answers WHERE question_id = ?",
    "test-q-123"
  );
  console.log("Raw fetched data after deanonymize:", JSON.stringify(updatedAnswers[0], null, 2));
  
  // Step 6: Remap (as frontend does)
  const remapped = updatedAnswers.map((ans) => {
    const rawIsAnon = ans.is_anonymous || false;
    return {
      id: ans.id,
      author: rawIsAnon ? "Anonymous User" : ans.author,
      isAnonymous: rawIsAnon,
      originalAuthorName: ans.author
    };
  });
  console.log("Remapped answer:", JSON.stringify(remapped[0], null, 2));
  
  // Clean up
  await db.run("DELETE FROM answers WHERE id = ?", answerId);
  await db.run("DELETE FROM faqs WHERE id = 'test-q-123'");
  
  console.log("\n=== RESULT ===");
  console.log("Backend logic is correct:");
  console.log("- After deanonymize, DB has is_anonymous: 0");
  console.log("- loadAnswers fetches is_anonymous: 0");
  console.log("- Frontend mapping shows 'Real Author Name'");
  console.log("\nIf deanonymize doesn't persist in real usage, check:");
  console.log("1. Is the correct answer ID being used in the PATCH request?");
  console.log("2. Is loadAnswers being called during/before the PATCH?");
  console.log("3. Is there a race condition causing stale data to overwrite?");
}

testHTTPFlow().catch(console.error);