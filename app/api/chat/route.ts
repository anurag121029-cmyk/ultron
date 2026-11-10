import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const message = (body as { message?: unknown })?.message;
  const memoriesRaw = (body as { memories?: unknown })?.memories;
  const memories = Array.isArray(memoriesRaw)
    ? memoriesRaw.filter((m): m is string => typeof m === "string" && m.trim().length > 0).map((m) => m.trim().slice(0, 500)).slice(0, 5)
    : [];
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message must be a non-empty string." }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "Message is too long (max 4000 characters)." }, { status: 400 });
  }
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  if (!key) {
    return NextResponse.json({ error: "Gemini is not configured on the server (GEMINI_API_KEY missing)." }, { status: 503 });
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const system = "You are ULTRON, a warm and friendly personal voice assistant — think of yourself as a helpful friend, not a stiff robot. Be upbeat, encouraging and easy to talk to. Keep replies short and conversational — they will be spoken aloud — so aim for 1-3 sentences unless the user asks for detail. Help with daily work: to-do lists, reminders, planning the day, studying and explaining things simply, drafting messages and notes, brainstorming, and answering general questions. If the user asks you to remember something, use the saved memories supplied below if any are relevant; if none are supplied, suggest they save it with the 'Save as memory' button on your reply, which stays on their device. Never claim to diagnose a medical or mental-health condition, and never invent facts, dates or results you don't know — say so instead.";
  const memoryBlock = memories.length ? `\n\nThings to remember about the user (saved by them, on their device):\n${memories.map((m) => `- ${m}`).join("\n")}` : "";
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `${system}${memoryBlock}\n\nUser: ${message}` }] }] }),
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
