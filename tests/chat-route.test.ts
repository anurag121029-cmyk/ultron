import { describe, expect, it } from "vitest";
import { POST } from "../app/api/chat/route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/chat validation", () => {
  it("rejects an empty message with 400", async () => {
    const res = await POST(req({ message: "   " }));
    expect(res.status).toBe(400);
  });
  it("rejects a message over 4000 characters with 400", async () => {
    const res = await POST(req({ message: "x".repeat(4001) }));
    expect(res.status).toBe(400);
  });
  it("rejects invalid JSON with 400", async () => {
    const res = await POST(req("{not json"));
    expect(res.status).toBe(400);
  });
  it("returns 503 when no GEMINI_API_KEY is configured, even with memories", async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const res = await POST(req({ message: "hello", memories: ["I like chai"] }));
      expect(res.status).toBe(503);
      const d = await res.json() as { error: string };
      expect(d.error).toMatch(/GEMINI_API_KEY missing/);
    } finally {
      if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
    }
  });
});
