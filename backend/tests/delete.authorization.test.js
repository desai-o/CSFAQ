const request = require("supertest");

describe("delete authorization", () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test_secret";
    jest.resetModules();
    app = require("../server");
  });

  test("rejects unauthenticated FAQ delete", async () => {
    const response = await request(app).delete("/api/faqs/test-id");

    expect(response.status).toBe(401);
  });

  test("rejects unauthenticated answer delete", async () => {
    const response = await request(app).delete("/api/answers/test-id");

    expect(response.status).toBe(401);
  });
});
