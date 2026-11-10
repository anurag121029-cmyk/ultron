import { NextResponse } from "next/server";
import { validateVisionInput } from "../../../lib/vision";

// POST /api/vision — understand an uploaded image with the Gemini chat model.
// Body: { imageData, mimeType?, question? } or { dataUrl, question? }.
// Honest errors only: 400 bad input, 503 no key, 502 provider failure.
// The uploaded image is sent to Gemini for this one request and is not stored.
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const input = (body ?? {}) as { imageData?: unknown; dataUrl?: unknown; mimeType?: unknown; question?: unknown };
  const valid = validateVisionInput(input);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  if (!key) {
    return NextResponse.json({ error: "Gemini is not configured on the server (GEMINI_API_KEY missing)." }, { status: 503 });
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: valid.question }, { inlineData: { mimeType: valid.mimeType, data: valid.data } }] }],
        }),
      });
      clearTimeout(timer);
      if (!res.ok) {
        if (res.status === 404) {
          return NextResponse.json({ error: `Gemini returned 404: the configured model (${model}) may be retired or unavailable — check GEMINI_MODEL.` }, { status: 502 });
        }
        lastError = `Gemini returned ${res.status}.`;
        if (res.status >= 500 && attempt === 0) continue;
        return NextResponse.json({ error: lastError }, { status: 502 });
      }
      const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (!reply) return NextResponse.json({ error: "Gemini returned an empty reply." }, { status: 502 });
      return NextResponse.json({ reply });
    } catch (e) {
      lastError = e instanceof Error && e.name === "AbortError" ? "Gemini request timed out." : "Failed to reach Gemini.";
      if (attempt === 0) continue;
    }
  }
  return NextResponse.json({ error: lastError || "Failed to reach Gemini." }, { status: 502 });
}
