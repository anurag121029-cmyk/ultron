import { describe, expect, it } from "vitest";
import { parseDataUrl, validateVisionInput } from "../lib/vision";
import { POST } from "../app/api/vision/route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/vision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("validateVisionInput", () => {
  it("accepts raw base64 + mimeType and defaults the question", () => {
    const r = validateVisionInput({ imageData: tinyPng, mimeType: "image/png" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.question).toMatch(/describe/i);
  });
  it("accepts a data URL", () => {
    const r = validateVisionInput({ dataUrl: `data:image/png;base64,${tinyPng}` });
    expect(r.ok).toBe(true);
  });
  it("rejects a missing image", () => {
    expect(validateVisionInput({ question: "hi" }).ok).toBe(false);
  });
  it("rejects an unsupported image type", () => {
    const r = validateVisionInput({ imageData: tinyPng, mimeType: "image/svg+xml" });
    expect(r.ok).toBe(false);
  });
  it("rejects non-base64 image data", () => {
    const r = validateVisionInput({ imageData: "not base64!!", mimeType: "image/png" });
    expect(r.ok).toBe(false);
  });
  it("rejects a question over 1000 characters", () => {
    const r = validateVisionInput({ imageData: tinyPng, mimeType: "image/png", question: "x".repeat(1001) });
    expect(r.ok).toBe(false);
  });
  it("parseDataUrl returns null for a bad data URL", () => {
    expect(parseDataUrl("hello")).toBeNull();
  });
});

describe("POST /api/vision validation", () => {
  it("rejects a missing image with 400", async () => {
    const res = await POST(req({ question: "what is this?" }));
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
      const res = await POST(req({ imageData: tinyPng, mimeType: "image/png", question: "what is this?" }));
      expect(res.status).toBe(503);
    } finally {
      if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
    }
  });
});
