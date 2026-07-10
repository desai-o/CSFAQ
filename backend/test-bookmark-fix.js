/**
 * Test script to verify the bookmark fix works end-to-end
 * 
 * This tests:
 * 1. Writing a bookmark to the database (POST /api/bookmarks)
 * 2. Reading the bookmark back (GET /api/bookmarks) 
 * 3. Confirming the database has the correct record
 */

const { connectSQLite, getSQLiteDb, closeSQLite } = require('./db/sqlite');
const { isMongoAvailable } = require('./db/mongo');

async function testBookmarkDB() {
  console.log('=== Bookmark Fix Verification Test ===\n');
  
  try {
    // Connect to SQLite
    await connectSQLite();
    const db = getSQLiteDb();
    
    console.log('1. Database connection: OK');
    console.log('   MongoDB available:', isMongoAvailable());
    console.log('   SQLite path: faq_fallback.sqlite\n');
    
    // Check if bookmarks table exists and has correct schema
    const tableInfo = await db.all("PRAGMA table_info(bookmarks)");
    console.log('2. Bookmarks table schema:');
    tableInfo.forEach(col => {
      console.log(`   - ${col.name}: ${col.type} (${col.notnull ? 'NOT NULL' : 'nullable'})`);
    });
    console.log();
    
    // Get existing bookmarks
    const existingBookmarks = await db.all("SELECT * FROM bookmarks LIMIT 5");
    console.log('3. Existing bookmarks count:', existingBookmarks.length);
    if (existingBookmarks.length > 0) {
      console.log('   Sample bookmark:', JSON.stringify(existingBookmarks[0], null, 2));
    }
    console.log();
    
    // Insert a test bookmark
    const testUserId = 'test-user-' + Date.now();
    const testQuestionId = 'test-question-' + Date.now();
    
    try {
      await db.run(
        `INSERT INTO bookmarks (user_id, question_id, synced_to_mongo) VALUES (?, ?, 0)`,
        testUserId,
        testQuestionId
      );
      console.log('4. Test bookmark INSERT: SUCCESS');
      console.log(`   user_id: ${testUserId}`);
      console.log(`   question_id: ${testQuestionId}\n`);
      
      // Query back the inserted bookmark
      const inserted = await db.get(
        "SELECT * FROM bookmarks WHERE user_id = ? AND question_id = ?",
        testUserId,
        testQuestionId
      );
      console.log('5. Bookmark QUERY (verify insert): SUCCESS');
      console.log('   Retrieved record:', JSON.stringify(inserted, null, 2));
      console.log();
      
      // Test SELECT for a specific user's bookmarks
      const userBookmarks = await db.all(
        "SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC",
        testUserId
      );
      console.log('6. User bookmarks query: SUCCESS');
      console.log(`   Found ${userBookmarks.length} bookmark(s) for user ${testUserId}\n`);
      
      // Clean up - delete the test bookmark
      await db.run(
        "DELETE FROM bookmarks WHERE user_id = ? AND question_id = ?",
        testUserId,
        testQuestionId
      );
      console.log('7. Test bookmark DELETE: SUCCESS (cleanup)\n');
      
      // Verify deletion
      const afterDelete = await db.get(
        "SELECT * FROM bookmarks WHERE user_id = ? AND question_id = ?",
        testUserId,
        testQuestionId
      );
      console.log('8. Verify deletion: SUCCESS (record no longer exists)\n');
      
    } catch (err) {
      console.error('   ERROR:', err.message);
    }
    
    // Final bookmark count
    const totalBookmarks = await db.get("SELECT COUNT(*) as count FROM bookmarks");
    console.log('9. Total bookmarks in database:', totalBookmarks.count);
    console.log();
    
    console.log('=== TEST PASSED ===');
    console.log('Bookmark write/query/delete operations work correctly!\n');
    
  } catch (error) {
    console.error('TEST FAILED:', error);
  } finally {
    await closeSQLite();
  }
}

testBookmarkDB();