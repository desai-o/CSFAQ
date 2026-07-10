const { connectSQLite, getSQLiteDb } = require("./db/sqlite");

async function testAnonymity() {
  await connectSQLite();
  const db = getSQLiteDb();
  
  // Check if there are any answers
  const answers = await db.all("SELECT id, author, is_anonymous FROM answers LIMIT 5");
  console.log("Sample answers:", JSON.stringify(answers, null, 2));
  
  // Update an answer to be anonymous
  if (answers.length > 0) {
    const testId = answers[0].id;
    await db.run("UPDATE answers SET is_anonymous = 1 WHERE id = ?", testId);
    console.log("Updated answer", testId, "to be anonymous");
    
    // Read it back
    const updated = await db.get("SELECT id, author, is_anonymous FROM answers WHERE id = ?", testId);
    console.log("After update:", JSON.stringify(updated, null, 2));
  }
}

testAnonymity().catch(console.error);