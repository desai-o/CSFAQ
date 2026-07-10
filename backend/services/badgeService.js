const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const User = require("../models/User");
const Event = require("../models/Event");
const Notification = require("../models/Notification");
const { dispatchNotification } = require("./notificationService");

/**
 * Calculates the maximum consecutive days of activity.
 * @param {string[]} dateStrings Array of date strings in YYYY-MM-DD format (or timestamp)
 */
function calculateMaxConsecutiveDays(dateStrings) {
  if (!dateStrings || dateStrings.length === 0) return 0;
  
  // Extract date part (YYYY-MM-DD)
  const normalizedDates = dateStrings
    .map(d => {
      if (!d) return null;
      // Handle MongoDB ISO strings and SQLite timestamp format
      const datePart = String(d).split(/[T ]/)[0];
      return datePart;
    })
    .filter(Boolean);

  const dates = normalizedDates
    .map(d => new Date(d + 'T00:00:00Z'))
    .sort((a, b) => a - b);
  
  const uniqueDates = [];
  for (const d of dates) {
    if (uniqueDates.length === 0 || uniqueDates[uniqueDates.length - 1].getTime() !== d.getTime()) {
      uniqueDates.push(d);
    }
  }

  if (uniqueDates.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const diffTime = Math.abs(uniqueDates[i] - uniqueDates[i - 1]);
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      currentStreak++;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
    } else if (diffDays > 1) {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

/**
 * Checks and awards badges to a user based on their stats and activity.
 */
async function checkAndAwardBadges(userId) {
  if (!userId || userId === "anonymous") return [];

  let userReputation = 0;
  let questionsCount = 0;
  let answersCount = 0;
  let currentBadges = [];

  const db = getSQLiteDb();

  // 1. Get user details
  if (isMongoAvailable()) {
    const mongoUser = await User.findById(userId);
    if (!mongoUser) return [];
    userReputation = mongoUser.reputation || 0;
    questionsCount = mongoUser.questionsCount || 0;
    answersCount = mongoUser.answersCount || 0;
    currentBadges = mongoUser.badges || [];
  } else {
    const sqliteUser = await db.get(
      "SELECT * FROM users WHERE id = ? OR mongo_id = ?",
      userId,
      userId
    );
    if (!sqliteUser) return [];
    userReputation = sqliteUser.reputation || 0;
    questionsCount = sqliteUser.questions_count || 0;
    answersCount = sqliteUser.answers_count || 0;
    currentBadges = sqliteUser.badges ? sqliteUser.badges.split(",").filter(Boolean) : [];
  }

  // 2. Fetch event history to compute streaks
  let eventDates = [];
  if (isMongoAvailable()) {
    const events = await Event.find({ userId }).select("createdAt");
    eventDates = events.map(e => e.createdAt.toISOString());
  } else {
    const events = await db.all("SELECT created_at FROM events WHERE user_id = ?", userId);
    eventDates = events.map(e => e.created_at);
  }

  const maxStreak = calculateMaxConsecutiveDays(eventDates);

  // 3. Evaluate rules
  const earnedBadges = new Set(currentBadges);

  if (questionsCount >= 1) {
    earnedBadges.add("First Question");
  }
  if (answersCount >= 1) {
    earnedBadges.add("First Answer");
  }
  if (answersCount >= 10) {
    earnedBadges.add("Ten Answers Master");
  }
  if (userReputation >= 100) {
    earnedBadges.add("Century Contributor");
  }
  if (maxStreak >= 3) {
    earnedBadges.add("Streak Starter");
  }
  if (maxStreak >= 7) {
    earnedBadges.add("Streak Legend");
  }

  // 4. Save new badges if changes
  const newBadgesList = Array.from(earnedBadges);
  const newlyAwarded = newBadgesList.filter(b => !currentBadges.includes(b));

  if (newlyAwarded.length > 0) {
    if (isMongoAvailable()) {
      await User.findByIdAndUpdate(userId, { badges: newBadgesList });
    }

    // Always update SQLite to maintain sync / fallback parity
    const badgesStr = newBadgesList.join(",");
    await db.run(
      "UPDATE users SET badges = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR mongo_id = ?",
      badgesStr,
      userId,
      userId
    );

    // Dispatch notifications for each newly awarded badge
    for (const badge of newlyAwarded) {
      const msg = `Congratulations! You have been awarded the "${badge}" badge!`;
      
      if (isMongoAvailable()) {
        await Notification.create({
          userId: String(userId),
          message: msg,
          eventType: "badge_awarded",
          followableType: "user",
          followableId: String(userId)
        });
      } else {
        await db.run(
          `
          INSERT INTO notifications (
            user_id,
            message,
            event_type,
            followable_type,
            followable_id,
            is_read
          )
          VALUES (?, ?, 'badge_awarded', 'user', ?, 0)
          `,
          String(userId),
          msg,
          String(userId)
        );
      }
    }
  }

  return newlyAwarded;
}

/**
 * Adjusts user reputation, question, and answer counts and triggers badge evaluation.
 */
async function adjustUserStats(userId, { questionsCountDelta = 0, answersCountDelta = 0, reputationDelta = 0 } = {}) {
  if (!userId || userId === "anonymous") return;

  const db = getSQLiteDb();

  if (isMongoAvailable()) {
    await User.findByIdAndUpdate(userId, {
      $inc: {
        questionsCount: questionsCountDelta,
        answersCount: answersCountDelta,
        reputation: reputationDelta
      }
    });
  }

  // Always update SQLite parity
  await db.run(
    `
    UPDATE users
    SET reputation = COALESCE(reputation, 0) + ?,
        questions_count = COALESCE(questions_count, 0) + ?,
        answers_count = COALESCE(answers_count, 0) + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? OR mongo_id = ?
    `,
    reputationDelta,
    questionsCountDelta,
    answersCountDelta,
    userId,
    userId
  );

  // Trigger badge checks asynchronously
  checkAndAwardBadges(userId).catch(err => {
    console.error(`Failed to award badges for user ${userId}:`, err.message);
  });
}

module.exports = {
  checkAndAwardBadges,
  adjustUserStats,
  calculateMaxConsecutiveDays
};
