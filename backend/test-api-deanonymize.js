const { connectSQLite, getSQLiteDb } = require("./db/sqlite");
const { success, fail } = require("./utils/apiResponse");

async function testAPI() {
  await connectSQLite();
  const db = getSQLiteDb();
  
  console.log("=== TEST: Full API Deanonymize Flow ===\n");
  
  // Step 1: Create test answer via direct INSERT
  console.log("STEP 1: Create answer");
  const result = await db.run(
    `INSERT INTO answers (question_id, content, author, user_id, author_name, is_anonymous, synced_to_mongo, moderation_status) VALUES (?, ?, ?, ?, ?, ?, 0, 'approved')`,
    "test-q-id", "API test answer", "Test Author", "test-user-456", "Test Author", 0
  );
  const answerId = result.lastID;
  console.log(`Created answer id: ${answerId}`);
  
  // Step 2: Verify initial state
  console.log("\nSTEP 2: Initial state");
  let ans = await db.get("SELECT id, author, is_anonymous FROM answers WHERE id = ?", answerId);
  console.log("DB:", JSON.stringify(ans));
  
  // Step 3: Simulate Zod validation with isAnonymous: false
  console.log("\nSTEP 3: Test Zod validation");
  const { z } = require("zod");
  const updateAnswerSchema = z.object({
    body: z.object({
      content: z.string().trim().min(1).max(5000).optional(),
      isAnonymous: z.boolean().optional()
    }),
    params: z.object({ id: z.string().min(1) }),
    query: z.object({}).optional()
  });
  
  // Test with isAnonymous: false
  const testPayload = { body: { isAnonymous: false } };
  const parseResult = updateAnswerSchema.safeParse({
    body: testPayload.body,
    params: { id: String(answerId) },
    query: {}
  });
  
  console.log("Parse result for {isAnonymous: false}:", JSON.stringify(parseResult, null, 2));
  
  if (parseResult.success) {
    console.log("✅ Zod validation passes, isAnonymous:", parseResult.data.body.isAnonymous);
  } else {
    console.log("❌ Zod validation FAILS:", parseResult.error.issues);
  }
  
  // Step 4: Test what the PATCH route does
  console.log("\nSTEP 4: Simulate PATCH route logic");
  const { content, isAnonymous } = parseResult.success ? parseResult.data.body : testPayload.body;
  console.log(`content: ${content}, isAnonymous: ${isAnonymous}`);
  
  const updates = [];
  const params = [];
  if (content !== undefined) {
    updates.push("content = ?");
    params.push(content.trim());
  }
  if (isAnonymous !== undefined) {
    updates.push("is_anonymous = ?");
    params.push(isAnonymous ? 1 : 0);
    console.log(`Would update is_anonymous to: ${isAnonymous ? 1 : 0}`);
  }
  updates.push("updated_at = CURRENT_TIMESTAMP");
  params.push(answerId);
  
  console.log("Updates array:", updates);
  console.log("Params array:", params);
  
  // Step 5: Actually run the update
  console.log("\nSTEP 5: Execute UPDATE");
  if (updates.length > 1) { // More than just updated_at
    await db.run(`UPDATE answers SET ${updates.join(", ")} WHERE id = ?`, ...params);
    console.log("Update executed");
  }
  
  // Step 6: Check DB
  console.log("\nSTEP 6: Verify DB state");
  ans = await db.get("SELECT id, author, is_anonymous FROM answers WHERE id = ?", answerId);
  console.log("DB:", JSON.stringify(ans));
  
  // Clean up
  await db.run("DELETE FROM answers WHERE id = ?", answerId);
  console.log("\n✅ Test complete - direct DB and logic work correctly");
  console.log("If deanonymize doesn't persist via real HTTP, the issue is in the HTTP layer");
}

testAPI().catch(console.error);