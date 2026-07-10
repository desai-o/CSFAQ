const request = require("supertest");

describe("protected route integration", () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test_secret";
    jest.resetModules();
    app = require("../server");
  });

  test("rejects unauthenticated bookmark creation", async () => {
    const response = await request(app)
      .post("/api/bookmarks")
      .send({
        questionId: "test-question"
      });

    expect(response.status).toBe(401);
  });

  test("rejects unauthenticated follow creation", async () => {
    const response = await request(app)
      .post("/api/follows")
      .send({
        followableType: "question",
        followableId: "test-question"
      });

    expect(response.status).toBe(401);
  });
});
