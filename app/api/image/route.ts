import { NextResponse } from "next/server";

// POST /api/image — generates an image with the Gemini image model and
// returns it as base64 data. Never fakes an image: no key -> 503, provider
// failure -> 502, no image data in the response -> 422.
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const prompt = (body as { prompt?: unknown })?.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "A prompt is required." }, { status: 400 });
  }
  if (prompt.length > 1000) {
    return NextResponse.json({ error: "Prompt is too long (max 1000 characters)." }, { status: 400 });
  }
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
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
          contents: [{ role: "user", parts: [{ text: `Generate an image: ${prompt.trim()}` }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });
      clearTimeout(timer);
      if (!res.ok) {
        if (res.status === 404) {
          return NextResponse.json({ error: `Gemini returned 404: the configured image model (${model}) may be retired or unavailable — check GEMINI_IMAGE_MODEL.` }, { status: 502 });
        }
        lastError = `Gemini returned ${res.status}.`;
        if (res.status >= 500 && attempt === 0) continue;
        return NextResponse.json({ error: lastError }, { status: 502 });
      }
      const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> } }> };
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const text = parts.map((p) => p.text ?? "").join("").trim();
      const imagePart = parts.find((p) => p.inlineData?.data);
      if (!imagePart?.inlineData?.data) {
        return NextResponse.json({ error: `The configured image model (${model}) did not return image data for this prompt (it may have been refused). No placeholder image was created.${text ? ` Model said: ${text.slice(0, 300)}` : ""}` }, { status: 422 });
      }
      return NextResponse.json({
        image: { mimeType: imagePart.inlineData.mimeType || "image/png", data: imagePart.inlineData.data },
        ...(text ? { text } : {}),
      });
    } catch (e) {
      lastError = e instanceof Error && e.name === "AbortError" ? "Gemini request timed out." : "Failed to reach Gemini.";
      if (attempt === 0) continue;
    }
  }
  return NextResponse.json({ error: lastError || "Failed to reach Gemini." }, { status: 502 });
}
