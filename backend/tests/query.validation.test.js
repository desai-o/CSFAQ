const { z } = require("zod");

describe("query payload validation contract", () => {
  const createQuerySchema = z.object({
    question: z.string().min(3).max(500),
    answer: z.string().max(3000).optional(),
    description: z.string().max(3000).optional(),
    category: z.string().max(100).optional(),
    tags: z.array(z.string().max(40)).optional()
  });

  test("accepts valid question payload", () => {
    const result = createQuerySchema.safeParse({
      question: "How do I upload my NOC?",
      description: "I need help with the dashboard upload flow",
      tags: ["noc", "upload"]
    });

    expect(result.success).toBe(true);
  });

  test("rejects too-short question", () => {
    const result = createQuerySchema.safeParse({
      question: "Hi"
    });

    expect(result.success).toBe(false);
  });

  test("rejects overlong question", () => {
    const result = createQuerySchema.safeParse({
      question: "a".repeat(501)
    });

    expect(result.success).toBe(false);
  });
});
