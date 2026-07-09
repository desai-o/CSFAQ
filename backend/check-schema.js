const { connectSQLite, getSQLiteDb } = require("./db/sqlite");

async function checkSchema() {
  await connectSQLite();
  const db = getSQLiteDb();
  const columns = await db.all("PRAGMA table_info(answers)");
  console.log("Answers table columns:");
  console.log(JSON.stringify(columns, null, 2));
}

checkSchema().catch(console.error);
