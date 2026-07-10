const { connectSQLite, getSQLiteDb } = require("./db/sqlite");
const express = require("express");

async function testDeanonymizeFlow() {
  await connectSQLite();
  const db = getSQLiteDb();
  
  console.log("=== TEST: Deanonymize Persistence ===\n");
  
  // Step 1: Create a test answer
  console.log("STEP 1: Create answer");
  const result = await db.run(
    `INSERT INTO answers (question_id, content, author, user_id, author_name, is_anonymous, synced_to_mongo, moderation_status) VALUES (?, ?, ?, ?, ?, ?, 0, 'approved')`,
    "test-q-id", "Test answer for deanonymize", "Original Author", "test-user-123", "Original Author", 0
  );
  const answerId = result.lastID;
  console.log(`Created answer id: ${answerId}`);
  
  // Step 2: Verify initial state
  console.log("\nSTEP 2: Initial state (should be NOT anonymous)");
  let ans = await db.get("SELECT id, author, is_anonymous FROM answers WHERE id = ?", answerId);
  console.log("DB Row:", JSON.stringify(ans));
  
  // Step 3: Simulate PATCH anonymize (isAnonymous = true)
  console.log("\nSTEP 3: Simulate PATCH anonymize (isAnonymous = true)");
  const updateResult1 = await db.run(
    `UPDATE answers SET is_anonymous = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    1, answerId
  );
  console.log(`Update result - changes: ${updateResult1.changes}`);
  
  // Step 4: Query DB directly after anonymize
  console.log("\nSTEP 4: After anonymize (should show is_anonymous: 1)");
  ans = await db.get("SELECT id, author, is_anonymous FROM answers WHERE id = ?", answerId);
  console.log("DB Row:", JSON.stringify(ans));
  
  // Step 5: Simulate PATCH deanonymize (isAnonymous = false)
  console.log("\nSTEP 5: Simulate PATCH deanonymize (isAnonymous = false)");
  const updateResult2 = await db.run(
    `UPDATE answers SET is_anonymous = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    0, answerId
  );
  console.log(`Update result - changes: ${updateResult2.changes}`);
  
  // Step 6: Query DB directly after deanonymize
  console.log("\nSTEP 6: After deanonymize (should show is_anonymous: 0)");
  ans = await db.get("SELECT id, author, is_anonymous FROM answers WHERE id = ?", answerId);
  console.log("DB Row:", JSON.stringify(ans));
  
  // Step 7: Test the ACTUAL updateAnswer route logic
  console.log("\n=== TESTING ACTUAL ROUTE LOGIC ===");
  console.log("\nSTEP 7: Recreate answer and test update logic path");
  
  // Clean up old test
  await db.run("DELETE FROM answers WHERE id = ?", answerId);
  
  // Create fresh answer
  const result2 = await db.run(
    `INSERT INTO answers (question_id, content, author, user_id, author_name, is_anonymous, synced_to_mongo, moderation_status) VALUES (?, ?, ?, ?, ?, ?, 0, 'approved')`,
    "test-q-id", "Test answer 2", "Original Author", "test-user-123", "Original Author", 0
  );
  const answerId2 = result2.lastID;
  console.log(`Created answer id: ${answerId2}`);
  
  // Test with isAnonymous = false explicitly
  console.log("\nSTEP 8: Test with isAnonymous = false (the bug case)");
  const isAnonValue = false;
  const dbValue = isAnonValue ? 1 : 0;
  console.log(`isAnonValue: ${isAnonValue}, dbValue: ${dbValue}`);
  
  const updateResult3 = await db.run(
    `UPDATE answers SET is_anonymous = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    dbValue, answerId2
  );
  console.log(`Update result - changes: ${updateResult3.changes}`);
  
  ans = await db.get("SELECT id, author, is_anonymous FROM answers WHERE id = ?", answerId2);
  console.log("DB Row:", JSON.stringify(ans));
  
  // Clean up
  await db.run("DELETE FROM answers WHERE id = ?", answerId2);
  
  console.log("\n=== SUMMARY ===");
  console.log("Direct DB updates work correctly.");
  console.log("If deanonymize doesn't persist, the bug is in the API route or frontend.");
  
  // Now test via the actual route logic
  console.log("\n=== TESTING API ROUTE LOGIC (mock) ===");
  
  // Simulate what the route does
  const mockReqBody = { isAnonymous: false };
  const { isAnonymous } = mockReqBody;
  console.log(`\nFrom mock req.body: isAnonymous = ${isAnonymous}`);
  console.log(`if (isAnonymous !== undefined) check: ${isAnonymous !== undefined}`);
  
  if (isAnonymous !== undefined) {
    console.log("✅ PASS: isAnonymous is NOT undefined, update would proceed");
  } else {
    console.log("❌ FAIL: isAnonymous is undefined, update would be SKIPPED!");
  }
  
  // Test with undefined (what happens if frontend omits the field?)
  const mockReqBody2 = {};
  const isAnon2 = mockReqBody2.isAnonymous;
  console.log(`\nFrom empty req.body: isAnonymous = ${isAnon2}, typeof = ${typeof isAnon2}`);
  console.log(`if (isAnonymous !== undefined) check: ${isAnon2 !== undefined}`);
}

testDeanonymizeFlow().catch(console.error);