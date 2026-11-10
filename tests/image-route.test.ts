import { describe, expect, it } from "vitest";
import { POST } from "../app/api/image/route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/image validation", () => {
  it("rejects an empty prompt with 400", async () => {
    const res = await POST(req({ prompt: "   " }));
    expect(res.status).toBe(400);
    const d = await res.json() as { error: string };
    expect(d.error).toMatch(/prompt is required/i);
  });
  it("rejects a prompt over 1000 characters with 400", async () => {
    const res = await POST(req({ prompt: "x".repeat(1001) }));
    expect(res.status).toBe(400);
  });
  it("rejects invalid JSON with 400", async () => {
    const res = await POST(req("{not json"));
    expect(res.status).toBe(400);
  });
  it("returns 503 when no GEMINI_API_KEY is configured", async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const res = await POST(req({ prompt: "a friendly robot" }));
      expect(res.status).toBe(503);
      const d = await res.json() as { error: string };
      expect(d.error).toMatch(/GEMINI_API_KEY missing/);
    } finally {
      if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
    }
  });
});
