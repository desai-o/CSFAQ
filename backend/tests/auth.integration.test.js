const request = require("supertest");
const path = require("path");
const fs = require("fs");

describe("auth integration", () => {
  let app;
  const testDbPath = path.join(__dirname, "test_auth_integration.sqlite");

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test_secret";
    process.env.SQLITE_PATH = testDbPath;
    
    jest.resetModules();

    const { connectSQLite } = require("../db/sqlite");
    await connectSQLite();

    app = require("../server");
  });

  afterAll(async () => {
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

  test("rejects /api/auth/me without token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
  });

  test("signup returns standardized error on validation failure", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({ email: "invalid@example.com" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "VALIDATION_ERROR",
        message: "Please enter all fields"
      })
    );
  });

  test("login returns standardized error on validation failure", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "VALIDATION_ERROR",
        message: "Please enter all fields"
      })
    );
  });

  test("login returns standardized error on invalid credentials", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "nonexistent@example.com", password: "wrongpassword" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "INVALID_CREDENTIALS",
        message: "Invalid credentials"
      })
    );
  });
});
