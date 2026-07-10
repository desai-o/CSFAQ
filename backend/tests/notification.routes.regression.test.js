const request = require("supertest");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

describe("notification route regression", () => {
  let app;
  let db;
  let token;
  let userId;
  const testDbPath = path.join(__dirname, "test_notification_regression.sqlite");

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test_secret";
    process.env.SQLITE_PATH = testDbPath;
    
    jest.resetModules();

    const { connectSQLite, getSQLiteDb } = require("../db/sqlite");
    await connectSQLite();
    db = getSQLiteDb();

    const { connectMongo, isMongoAvailable } = require("../db/mongo");
    await connectMongo();

    app = require("../server");

    // Seed User
    if (isMongoAvailable()) {
      const User = require("../models/User");
      const user = await User.create({
        name: "Notif User",
        email: "notif_user@example.com",
        password: "hashed_password"
      });
      userId = user._id.toString();
    } else {
      await db.run(
        `INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
        2001,
        "Notif User",
        "notif_user@example.com",
        "hashed_password",
        "student"
      );
      userId = "2001";
    }

    token = jwt.sign({ id: userId }, "test_secret");
  });

  afterAll(async () => {
    const { isMongoAvailable } = require("../db/mongo");
    if (isMongoAvailable()) {
      const User = require("../models/User");
      await User.deleteOne({ _id: userId }).catch(() => {});
    }

    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (err) {
        // ignore
      }
    }
  });

  test("GET /api/notifications returns normalized notification objects", async () => {
    const { isMongoAvailable } = require("../db/mongo");
    const Notification = require("../models/Notification");

    let notificationId;

    if (isMongoAvailable()) {
      const notif = await Notification.create({
        userId,
        message: "You have a new answer.",
        isRead: false
      });
      notificationId = notif._id.toString();
    } else {
      const result = await db.run(
        `INSERT INTO notifications (user_id, message, is_read) VALUES (?, ?, 0)`,
        userId,
        "You have a new answer."
      );
      notificationId = String(result.lastID);
    }

    const response = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data).toBeDefined();
    expect(response.body.data.length).toBeGreaterThan(0);
    
    const notifObj = response.body.data.find(n => n.id === notificationId);
    expect(notifObj).toBeDefined();
    expect(notifObj.userId).toBe(userId);
    expect(notifObj.message).toBe("You have a new answer.");
    expect(notifObj.isRead).toBe(false);

    if (isMongoAvailable()) {
      await Notification.deleteOne({ _id: notificationId });
    }
  });

  test("PATCH /api/notifications/read marks all user notifications read", async () => {
    const { isMongoAvailable } = require("../db/mongo");
    const Notification = require("../models/Notification");

    if (isMongoAvailable()) {
      await Notification.create({
        userId,
        message: "Message 1",
        isRead: false
      });
      await Notification.create({
        userId,
        message: "Message 2",
        isRead: false
      });
    } else {
      await db.run(
        `INSERT INTO notifications (user_id, message, is_read) VALUES (?, ?, 0)`,
        userId,
        "Message 1"
      );
      await db.run(
        `INSERT INTO notifications (user_id, message, is_read) VALUES (?, ?, 0)`,
        userId,
        "Message 2"
      );
    }

    const patchResponse = await request(app)
      .patch("/api/notifications/read")
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.status).toBe("success");

    const getResponse = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data.every(n => n.isRead === true)).toBe(true);

    if (isMongoAvailable()) {
      await Notification.deleteMany({ userId });
    }
  });

  test("PATCH /api/notifications/:id/read marks one notification read", async () => {
    const { isMongoAvailable } = require("../db/mongo");
    const Notification = require("../models/Notification");

    let notif1Id;
    let notif2Id;

    if (isMongoAvailable()) {
      const n1 = await Notification.create({
        userId,
        message: "Message 1",
        isRead: false
      });
      const n2 = await Notification.create({
        userId,
        message: "Message 2",
        isRead: false
      });
      notif1Id = n1._id.toString();
      notif2Id = n2._id.toString();
    } else {
      const r1 = await db.run(
        `INSERT INTO notifications (user_id, message, is_read) VALUES (?, ?, 0)`,
        userId,
        "Message 1"
      );
      const r2 = await db.run(
        `INSERT INTO notifications (user_id, message, is_read) VALUES (?, ?, 0)`,
        userId,
        "Message 2"
      );
      notif1Id = String(r1.lastID);
      notif2Id = String(r2.lastID);
    }

    const patchResponse = await request(app)
      .patch(`/api/notifications/${notif1Id}/read`)
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.status).toBe("success");

    const getResponse = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(getResponse.status).toBe(200);
    const updatedN1 = getResponse.body.data.find(n => n.id === notif1Id);
    const updatedN2 = getResponse.body.data.find(n => n.id === notif2Id);
    expect(updatedN1.isRead).toBe(true);
    expect(updatedN2.isRead).toBe(false);

    if (isMongoAvailable()) {
      await Notification.deleteMany({ userId });
    }
  });

  test("DELETE /api/notifications/:id deletes only own notification", async () => {
    const { isMongoAvailable } = require("../db/mongo");
    const Notification = require("../models/Notification");

    let userBId;
    if (isMongoAvailable()) {
      const User = require("../models/User");
      const userB = await User.create({
        name: "User B",
        email: "user_b@example.com",
        password: "hashed_password"
      });
      userBId = userB._id.toString();
    } else {
      await db.run(
        `INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
        2002,
        "User B",
        "user_b@example.com",
        "hashed_password",
        "student"
      );
      userBId = "2002";
    }

    const tokenB = jwt.sign({ id: userBId }, "test_secret");

    let notifAId;

    if (isMongoAvailable()) {
      const nA = await Notification.create({
        userId,
        message: "User A Message",
        isRead: false
      });
      notifAId = nA._id.toString();
    } else {
      const rA = await db.run(
        `INSERT INTO notifications (user_id, message, is_read) VALUES (?, ?, 0)`,
        userId,
        "User A Message"
      );
      notifAId = String(rA.lastID);
    }

    // User B attempts to delete A's notification
    const deleteResponseB = await request(app)
      .delete(`/api/notifications/${notifAId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send();

    expect(deleteResponseB.status).toBe(404); // Should be 404 since it's not B's notification

    // User A deletes A's notification
    const deleteResponseA = await request(app)
      .delete(`/api/notifications/${notifAId}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

    expect(deleteResponseA.status).toBe(200);
    expect(deleteResponseA.body.status).toBe("success");

    if (isMongoAvailable()) {
      const User = require("../models/User");
      await User.deleteOne({ _id: userBId }).catch(() => {});
      await Notification.deleteMany({ userId: { $in: [userId, userBId] } });
    }
  });
});
