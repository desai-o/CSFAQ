const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { validate } = require("../middleware/validate");

const { isMongoAvailable } = require("../db/mongo");
const { getSQLiteDb } = require("../db/sqlite");
const Notification = require("../models/Notification");
const { requireAuth } = require("../middleware/auth");
const { getPagination } = require("../utils/pagination");
const { success, fail } = require("../utils/apiResponse");
const { writeLimiter } = require("../middleware/rateLimits");

const getNotificationsSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    limit: z.string().optional(),
    offset: z.string().optional()
  }).optional()
});

const markReadSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

function normalizeSqliteNotification(item) {
  return {
    id: String(item.id),
    userId: item.user_id,
    followId: item.follow_id,
    message: item.message,
    eventType: item.event_type || "",
    followableType: item.followable_type || "",
    followableId: item.followable_id || "",
    isRead: Boolean(item.is_read),
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

router.get("/", requireAuth, validate(getNotificationsSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit, offset } = getPagination(req.query);

    if (isMongoAvailable()) {
      const [notifications, total] = await Promise.all([
        Notification.find({ userId }).sort({ createdAt: -1 }).skip(offset).limit(limit),
        Notification.countDocuments({ userId })
      ]);

      return success(res, {
        storage: "mongodb",
        data: notifications,
        meta: { pagination: { limit, offset, total } }
      });
    }

    const db = getSQLiteDb();
    const user = await db.get(
      `
      SELECT id, mongo_id
      FROM users
      WHERE id = ?
         OR mongo_id = ?
      `,
      userId,
      userId
    );

    const userIdMatch = user
      ? [String(user.id), user.mongo_id].filter(Boolean)
      : [userId];

    const placeholders = userIdMatch.map(() => "?").join(",");

    const [notifications, totalRow] = await Promise.all([
      db.all(
        `
        SELECT *
        FROM notifications
        WHERE user_id IN (${placeholders})
        ORDER BY created_at DESC
        LIMIT ?
        OFFSET ?
        `,
        ...userIdMatch,
        limit,
        offset
      ),
      db.get(
        `
        SELECT COUNT(*) AS total
        FROM notifications
        WHERE user_id IN (${placeholders})
        `,
        ...userIdMatch
      )
    ]);

    return success(res, {
      storage: "sqlite",
      data: notifications.map(normalizeSqliteNotification),
      meta: { pagination: { limit, offset, total: totalRow.total } }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "NOTIFICATIONS_FETCH_FAILED",
      message: "Failed to fetch notifications",
      details: error.message
    });
  }
});

router.patch("/:id/read", requireAuth, writeLimiter, async (req, res) => {
  try {
    const userId = req.user.id;

    if (isMongoAvailable()) {
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, userId },
        { isRead: true },
        { new: true }
      );

      if (!notification) {
        return fail(res, {
          statusCode: 404,
          code: "NOTIFICATION_NOT_FOUND",
          message: "Notification not found"
        });
      }

      return success(res, {
        storage: "mongodb",
        data: notification
      });
    }

    const db = getSQLiteDb();

    const result = await db.run(
      `
      UPDATE notifications
      SET is_read = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND user_id = ?
      `,
      req.params.id,
      userId
    );

    if (result.changes === 0) {
      return fail(res, {
        statusCode: 404,
        code: "NOTIFICATION_NOT_FOUND",
        message: "Notification not found"
      });
    }

    return success(res, {
      storage: "sqlite",
      data: { updated: true }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "NOTIFICATION_MARK_READ_FAILED",
      message: "Failed to mark notification as read",
      details: error.message
    });
  }
});

router.patch("/read", requireAuth, writeLimiter, validate(markReadSchema), async (req, res) => {
  try {
    const userId = req.user.id;

    if (isMongoAvailable()) {
      await Notification.updateMany(
        {
          userId
        },
        {
          isRead: true
        }
      );

      return success(res, {
        storage: "mongodb",
        data: {
          updated: true
        }
      });
    }

    const db = getSQLiteDb();
    const user = await db.get(
      `
      SELECT id, mongo_id
      FROM users
      WHERE id = ?
         OR mongo_id = ?
      `,
      userId,
      userId
    );

    const userIdMatch = user
      ? [String(user.id), user.mongo_id].filter(Boolean)
      : [userId];

    const placeholders = userIdMatch.map(() => "?").join(",");

    await db.run(
      `
      UPDATE notifications
      SET is_read = 1
      WHERE user_id IN (${placeholders})
      `,
      ...userIdMatch
    );

    return success(res, {
      storage: "sqlite",
      data: {
        updated: true
      }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "NOTIFICATIONS_MARK_READ_FAILED",
      message: "Failed to mark notifications as read",
      details: error.message
    });
  }
});

router.delete("/:id", requireAuth, writeLimiter, async (req, res) => {
  try {
    const userId = req.user.id;

    if (isMongoAvailable()) {
      const result = await Notification.deleteOne({
        _id: req.params.id,
        userId
      });

      if (result.deletedCount === 0) {
        return fail(res, {
          statusCode: 404,
          code: "NOTIFICATION_NOT_FOUND",
          message: "Notification not found"
        });
      }

      return success(res, {
        storage: "mongodb",
        data: { deleted: true }
      });
    }

    const db = getSQLiteDb();

    const result = await db.run(
      `
      DELETE FROM notifications
      WHERE id = ?
        AND user_id = ?
      `,
      req.params.id,
      userId
    );

    if (result.changes === 0) {
      return fail(res, {
        statusCode: 404,
        code: "NOTIFICATION_NOT_FOUND",
        message: "Notification not found"
      });
    }

    return success(res, {
      storage: "sqlite",
      data: { deleted: true }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "NOTIFICATION_DELETE_FAILED",
      message: "Failed to delete notification",
      details: error.message
    });
  }
});

// GET /api/notifications/preferences
router.get("/preferences", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    if (isMongoAvailable()) {
      const NotificationPreference = require("../models/NotificationPreference");
      let prefs = await NotificationPreference.findOne({ userId });
      if (!prefs) {
        prefs = await NotificationPreference.create({ userId });
      }
      return success(res, {
        storage: "mongodb",
        data: prefs
      });
    }

    const db = getSQLiteDb();
    let prefs = await db.get("SELECT * FROM notification_preferences WHERE user_id = ?", userId);
    if (!prefs) {
      await db.run(
        `INSERT INTO notification_preferences (user_id, email_notifications, in_app_notifications, digest_frequency, tag_preferences)
         VALUES (?, 1, 1, 'none', '')`,
        userId
      );
      prefs = await db.get("SELECT * FROM notification_preferences WHERE user_id = ?", userId);
    }

    return success(res, {
      storage: "sqlite",
      data: {
        userId: prefs.user_id,
        emailNotifications: !!prefs.email_notifications,
        inAppNotifications: !!prefs.in_app_notifications,
        digestFrequency: prefs.digest_frequency,
        tagPreferences: prefs.tag_preferences ? prefs.tag_preferences.split(",") : []
      }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "PREFERENCES_FETCH_FAILED",
      message: "Failed to fetch notification preferences",
      details: error.message
    });
  }
});

// PUT /api/notifications/preferences
router.put("/preferences", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { emailNotifications, inAppNotifications, digestFrequency, tagPreferences } = req.body;

    if (isMongoAvailable()) {
      const NotificationPreference = require("../models/NotificationPreference");
      const prefs = await NotificationPreference.findOneAndUpdate(
        { userId },
        {
          emailNotifications: emailNotifications !== undefined ? !!emailNotifications : true,
          inAppNotifications: inAppNotifications !== undefined ? !!inAppNotifications : true,
          digestFrequency: digestFrequency || "none",
          tagPreferences: Array.isArray(tagPreferences) ? tagPreferences : []
        },
        { upsert: true, new: true }
      );

      return success(res, {
        storage: "mongodb",
        data: prefs
      });
    }

    const db = getSQLiteDb();
    const tagPreferencesStr = Array.isArray(tagPreferences) ? tagPreferences.join(",") : "";

    await db.run(
      `
      INSERT INTO notification_preferences (
        user_id, email_notifications, in_app_notifications, digest_frequency, tag_preferences
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        email_notifications = excluded.email_notifications,
        in_app_notifications = excluded.in_app_notifications,
        digest_frequency = excluded.digest_frequency,
        tag_preferences = excluded.tag_preferences,
        updated_at = CURRENT_TIMESTAMP
      `,
      userId,
      emailNotifications !== undefined ? (emailNotifications ? 1 : 0) : 1,
      inAppNotifications !== undefined ? (inAppNotifications ? 1 : 0) : 1,
      digestFrequency || "none",
      tagPreferencesStr
    );

    const prefs = await db.get("SELECT * FROM notification_preferences WHERE user_id = ?", userId);

    return success(res, {
      storage: "sqlite",
      data: {
        userId: prefs.user_id,
        emailNotifications: !!prefs.email_notifications,
        inAppNotifications: !!prefs.in_app_notifications,
        digestFrequency: prefs.digest_frequency,
        tagPreferences: prefs.tag_preferences ? prefs.tag_preferences.split(",") : []
      }
    });
  } catch (error) {
    return fail(res, {
      statusCode: 500,
      code: "PREFERENCES_UPDATE_FAILED",
      message: "Failed to update notification preferences",
      details: error.message
    });
  }
});

module.exports = router;
