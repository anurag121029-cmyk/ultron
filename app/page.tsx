"use client";
import { useEffect, useRef, useState } from "react";
import UltronAvatar, { type AvatarMode } from "@/components/UltronAvatar";
import InstallApp from "@/components/InstallApp";
import { expressionForEmotion, expressionFromReply, roughEmotionFromBlendshapes, type Expression, type RoughEmotion } from "@/lib/expressions";
import { addMemory, addNote, addReminder, addTask, deleteMemory, deleteNote, deleteReminder, deleteTask, parseMemories, parseNotes, parseReminders, parseTasks, pickRelevantMemories, toggleReminder, toggleTask, MEMORIES_KEY, NOTES_KEY, REMINDERS_KEY, TASKS_KEY, type Memory, type Note, type Reminder, type Task } from "@/lib/dailyWork";

type Entry = { role: "you" | "ultron"; text: string };
type SR = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: { length: number; [i: number]: { isFinal: boolean; [j: number]: { transcript: string } } } }) => void) | null; onerror: ((e: { error?: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type FaceLandmarkerLike = { detectForVideo: (video: HTMLVideoElement, ts: number) => { faceBlendshapes?: Array<{ categories: Array<{ categoryName: string; score: number }> }> } };

const EXPRESSIONS: Expression[] = ["happy", "neutral", "sad", "surprised", "thinking"];

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([{ role: "ultron", text: "I am ULTRON. Tap Start talking and speak to me — or type below." }]);
  const [input, setInput] = useState("");
  const [interim, setInterim] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [expression, setExpression] = useState<Expression>("neutral");
  const [mode, setMode] = useState<AvatarMode>("idle");
  const [talking, setTalking] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("");
  const [emotion, setEmotion] = useState<RoughEmotion | null>(null);

  // Image generation (separate from chat/voice).
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageResult, setImageResult] = useState<{ mimeType: string; data: string } | null>(null);
  const [imageError, setImageError] = useState("");

  // Daily Work — local-only to-dos, notes, reminders and saved memories, persisted in localStorage.
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [workLoaded, setWorkLoaded] = useState(false);
  const [taskInput, setTaskInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [reminderText, setReminderText] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [chatTitle, setChatTitle] = useState("Conversation");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Vision — understand an uploaded image.
  const [visionDataUrl, setVisionDataUrl] = useState("");
  const [visionQuestion, setVisionQuestion] = useState("");
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionResult, setVisionResult] = useState("");
  const [visionError, setVisionError] = useState("");

  useEffect(() => {
    try {
      setTasks(parseTasks(window.localStorage.getItem(TASKS_KEY)));
      setNotes(parseNotes(window.localStorage.getItem(NOTES_KEY)));
      setReminders(parseReminders(window.localStorage.getItem(REMINDERS_KEY)));
      setMemories(parseMemories(window.localStorage.getItem(MEMORIES_KEY)));
    } catch { /* storage unavailable — daily work just won't persist */ }
    setWorkLoaded(true);
  }, []);

  useEffect(() => {
    if (!workLoaded) return;
    try { window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch { /* storage unavailable */ }
  }, [tasks, workLoaded]);

  useEffect(() => {
    if (!workLoaded) return;
    try { window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch { /* storage unavailable */ }
  }, [notes, workLoaded]);

  useEffect(() => {
    if (!workLoaded) return;
    try { window.localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders)); } catch { /* storage unavailable */ }
  }, [reminders, workLoaded]);

  useEffect(() => {
    if (!workLoaded) return;
    try { window.localStorage.setItem(MEMORIES_KEY, JSON.stringify(memories)); } catch { /* storage unavailable */ }
  }, [memories, workLoaded]);

  function onVisionFile(file: File | undefined) {
    if (!file) return;
    setVisionError(""); setVisionResult("");
    if (file.size > 5 * 1024 * 1024) { setVisionError("That image is too large (max about 5 MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => setVisionDataUrl(String(reader.result || ""));
    reader.onerror = () => setVisionError("Could not read that image file.");
    reader.readAsDataURL(file);
  }

  async function askVision() {
    if (!visionDataUrl || visionLoading) return;
    setVisionLoading(true); setVisionError(""); setVisionResult("");
    try {
      const res = await fetch("/api/vision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl: visionDataUrl, question: visionQuestion.trim() || undefined }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Vision failed.");
      setVisionResult(d.reply);
    } catch (e) {
      setVisionError(e instanceof Error ? e.message : "Vision failed.");
    } finally { setVisionLoading(false); }
  }

  async function copyReply(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1500);
    } catch { setError("Could not copy — your browser blocked clipboard access."); }
  }

  function clearChat() {
    stopTalking();
    setEntries([{ role: "ultron", text: "Fresh start — what can I help with?" }]);
    setChatTitle("Conversation");
  }

  async function generateImage() {
    const prompt = imagePrompt.trim();
    if (!prompt || imageLoading) return;
    setImageLoading(true); setImageError(""); setImageResult(null);
    try {
      const res = await fetch("/api/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Image generation failed.");
      setImageResult(d.image);
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "Image generation failed.");
    } finally { setImageLoading(false); }
  }

  const recRef = useRef<SR | null>(null);
  const loopRef = useRef(false);
  const sendingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const camRafRef = useRef(0);
  const camRunningRef = useRef(false);
  const lastCamEmotionRef = useRef<RoughEmotion | null>(null);
  const modeRef = useRef<AvatarMode>("idle");
  modeRef.current = mode;

  function speak(text: string) {
    if (!("speechSynthesis" in window)) { setStatus("Speech output is not supported in this browser."); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.onstart = () => setMode("speaking");
    u.onend = () => {
      setMode("idle");
      if (emotion) setExpression(expressionForEmotion(emotion));
      if (loopRef.current) startListening();
    };
    u.onerror = () => { setMode("idle"); if (loopRef.current) startListening(); };
    window.speechSynthesis.speak(u);
  }

  async function sendToUltron(text: string) {
    if (!text.trim() || sendingRef.current) return;
    sendingRef.current = true;
    setEntries((e) => [...e, { role: "you", text }]);
    setMode("thinking"); setStatus("ULTRON is thinking…"); setError("");
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, memories: pickRelevantMemories(memories, text) }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Chat failed.");
      setEntries((e) => [...e, { role: "ultron", text: d.reply }]);
      setExpression(expressionFromReply(d.reply));
      setStatus("");
      speak(d.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed.");
      setMode("idle");
      if (loopRef.current) startListening();
    } finally { sendingRef.current = false; }
  }

  function startListening() {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) { setError("Speech recognition is not supported in this browser. Try Chrome or Edge, or type instead."); setTalking(false); loopRef.current = false; return; }
    try {
      const rec = new Ctor();
      rec.lang = "en-GB"; rec.interimResults = true; rec.continuous = false;
      rec.onresult = (e) => {
        let interimText = ""; let finalText = "";
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript; else interimText += r[0].transcript;
        }
        setInterim(interimText);
        if (finalText.trim()) { setInterim(""); rec.stop(); void sendToUltron(finalText.trim()); }
      };
      rec.onerror = (e) => { setStatus(`Microphone error: ${e.error ?? "permission denied"}. Nothing was recorded.`); };
      rec.onend = () => { if (loopRef.current && !sendingRef.current && modeRef.current !== "speaking") setStatus("Listening…"); };
      recRef.current = rec;
      setMode("listening"); setStatus("Listening… speak now."); rec.start();
    } catch { setError("Could not start speech recognition. Check microphone permission and try again."); }
  }

  function startTalking() { setError(""); loopRef.current = true; setTalking(true); startListening(); }
  function stopTalking() {
    loopRef.current = false; setTalking(false);
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setMode("idle"); setStatus("Stopped.");
  }

  async function startCamera() {
    setCameraStatus("Starting camera…"); setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) { video.srcObject = stream; await video.play(); }
      setCameraOn(true); camRunningRef.current = true; setCameraStatus("Camera on — video stays on this device and is never uploaded or stored.");
      // Primary path: MediaPipe FaceLandmarker blendshapes, loaded on demand.
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
        const landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
          runningMode: "VIDEO", numFaces: 1,
        });
        const loop = () => {
          if (!camRunningRef.current || !videoRef.current) return;
          try {
            const result = (landmarker as unknown as FaceLandmarkerLike).detectForVideo(videoRef.current, performance.now());
            const cats = result.faceBlendshapes?.[0]?.categories ?? [];
            if (cats.length) {
              const scores: Record<string, number> = {};
              for (const c of cats) scores[c.categoryName] = c.score;
              const emo = roughEmotionFromBlendshapes(scores);
              setEmotion(emo);
              if (emo !== lastCamEmotionRef.current) {
                lastCamEmotionRef.current = emo;
                if (modeRef.current !== "speaking") setExpression(expressionForEmotion(emo));
              }
            }
          } catch { /* keep camera running; next frame retries */ }
          camRafRef.current = requestAnimationFrame(loop);
        };
        camRafRef.current = requestAnimationFrame(loop);
        setCameraStatus("Camera on — ULTRON reads a rough emotion from your face, on-device only. Video is never uploaded or stored.");
      } catch {
        // Fallback: face presence only. FaceDetector gives a box, not landmarks,
        // so no honest emotion can be derived from it — do not fabricate one.
        const W = window as unknown as { FaceDetector?: new () => { detect: (v: HTMLVideoElement) => Promise<Array<unknown>> } };
        if (W.FaceDetector) setCameraStatus("Face detected, but detailed emotion is not available in this browser — use the expression picker below. Video stays on this device.");
        else setCameraStatus("Camera is on, but emotion reading is not supported on this device/browser — use the expression picker below. Video stays on this device.");
      }
    } catch {
      setError("Camera permission was denied or no camera is available."); setCameraStatus("");
    }
  }

  function stopCamera() {
    camRunningRef.current = false; cancelAnimationFrame(camRafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false); setCameraStatus("Camera off — all camera tracks released."); setEmotion(null); lastCamEmotionRef.current = null;
  }

  useEffect(() => () => { stopTalking(); stopCamera(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="page">
      <header className="header">
        <div><h1>ULTRON</h1><p>Master Blaster — voice AI assistant: 3D character, voice, images, vision &amp; daily work</p></div>
        <span className={`pill ${mode}`}>{mode === "speaking" ? "Speaking" : mode === "listening" ? "Listening" : mode === "thinking" ? "Thinking" : "Ready"}</span>
      </header>

      <InstallApp />

      <section className="stage">
        <UltronAvatar expression={expression} mode={mode} />
        <p className="caption">Animated lip movement while speaking — not phoneme-accurate lip sync.</p>
      </section>

      <section className="controls">
        {!talking
          ? <button className="btn primary" onClick={startTalking}>🎤 Start talking</button>
          : <button className="btn danger" onClick={stopTalking}>⏹ Stop</button>}
        {!cameraOn
          ? <button className="btn" onClick={startCamera}>📷 Start camera</button>
          : <button className="btn danger" onClick={stopCamera}>📷 Stop camera</button>}
      </section>

      <div className="grid2">
        <div className="panel">
          <h2>Camera</h2>
          <video ref={videoRef} playsInline muted autoPlay className="video" />
          {cameraStatus && <p className="muted">{cameraStatus}</p>}
          {emotion && <p><strong>Rough emotion: {emotion}</strong> <span className="muted">(rough estimate — not a medical or psychological assessment)</span></p>}
          <p className="muted">Camera is optional and only runs after you tap Start camera. No frames leave this device.</p>
        </div>
        <div className="panel">
          <h2>Expression</h2>
          <div className="chips">
            {EXPRESSIONS.map((ex) => (
              <button key={ex} className={`chip ${expression === ex ? "active" : ""}`} onClick={() => setExpression(ex)}>{ex}</button>
            ))}
          </div>
          <p className="muted">Pick an expression manually, or let the camera (when on) and ULTRON&apos;s replies drive it.</p>
        </div>
      </div>

      <section className="panel transcript">
        <div className="chat-head">
          <input className="input chat-title" value={chatTitle} onChange={(e) => setChatTitle(e.target.value)} aria-label="Chat title" />
          <button className="btn small" onClick={clearChat}>Clear chat</button>
        </div>
        <div className="entries">
          {entries.map((e, i) => (
            <div key={i} className={`entry ${e.role}`}>
              <p><strong>{e.role === "you" ? "You" : "ULTRON"}:</strong> {e.text}</p>
              {e.role === "ultron" && (
                <div className="entry-actions">
                  <button className="btn small" onClick={() => void copyReply(e.text, i)}>{copiedIdx === i ? "Copied ✓" : "Copy"}</button>
                  <button className="btn small" onClick={() => setMemories((m) => addMemory(m, e.text))}>Save as memory</button>
                </div>
              )}
            </div>
          ))}
          {interim && <p className="you interim"><strong>You (…):</strong> {interim}</p>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); const t = input; setInput(""); void sendToUltron(t); }}>
          <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Or type a message…" aria-label="Type a message to ULTRON" />
          <button className="btn primary" type="submit">Send</button>
        </form>
        {status && <p className="muted" role="status">{status}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <p className="muted">Voice uses your browser&apos;s speech service. ULTRON never records in the background; only the transcript you send reaches the chat API.</p>
      </section>

      <section className="panel">
        <h2>🖼️ Make an image</h2>
        <p className="muted">Describe an image and ULTRON will generate it — separate from chat and voice.</p>
        <form onSubmit={(e) => { e.preventDefault(); void generateImage(); }}>
          <input className="input" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="e.g. A friendly robot drinking tea at sunrise…" aria-label="Image prompt" />
          <button className="btn primary" type="submit" disabled={imageLoading || !imagePrompt.trim()}>{imageLoading ? "Making…" : "Generate"}</button>
        </form>
        {imageLoading && <p className="muted" role="status">Generating your image… this can take a few seconds.</p>}
        {imageError && <p className="error" role="alert">{imageError}</p>}
        {imageResult && (
          <div className="image-result">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:${imageResult.mimeType};base64,${imageResult.data}`} alt={imagePrompt || "Generated image"} />
            <a className="btn" href={`data:${imageResult.mimeType};base64,${imageResult.data}`} download="ultron-image.png">⬇ Download image</a>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>👁️ Look at a picture</h2>
        <p className="muted">Upload a photo and ask ULTRON about it. The image is sent to Gemini for this one question only — it is not stored.</p>
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => onVisionFile(e.target.files?.[0])} aria-label="Upload an image for ULTRON to look at" />
        {visionDataUrl && (
          <div className="image-result">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={visionDataUrl} alt="Uploaded for ULTRON to look at" />
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); void askVision(); }}>
          <input className="input" value={visionQuestion} onChange={(e) => setVisionQuestion(e.target.value)} placeholder="What should ULTRON look for? e.g. What's in this photo?" aria-label="Question about the image" />
          <button className="btn primary" type="submit" disabled={visionLoading || !visionDataUrl}>{visionLoading ? "Looking…" : "Ask ULTRON"}</button>
        </form>
        {visionError && <p className="error" role="alert">{visionError}</p>}
        {visionResult && <p className="ultron"><strong>ULTRON:</strong> {visionResult}</p>}
      </section>

      <section>
        <h2 className="section-title">📋 Daily Work</h2>
        <p className="muted">Your to-dos, reminders, notes and saved memories. They stay on this device only (saved in this browser) — they don&apos;t sync anywhere. Saved memories are the only part shared with chat, and only the few relevant to what you ask.</p>
        <div className="grid2">
          <div className="panel">
            <h2>To-do list</h2>
            <form onSubmit={(e) => { e.preventDefault(); setTasks((t) => addTask(t, taskInput)); setTaskInput(""); }}>
              <input className="input" value={taskInput} onChange={(e) => setTaskInput(e.target.value)} placeholder="Add a task…" aria-label="Add a task" />
              <button className="btn primary" type="submit">Add</button>
            </form>
            {tasks.length === 0
              ? <p className="muted">No tasks yet — add your first one above.</p>
              : <ul className="task-list">
                {tasks.map((t) => (
                  <li key={t.id} className="task-row">
                    <label>
                      <input type="checkbox" checked={t.done} onChange={() => setTasks((ts) => toggleTask(ts, t.id))} />
                      <span className={t.done ? "task-done" : ""}>{t.text}</span>
                    </label>
                    <button className="btn small" onClick={() => setTasks((ts) => deleteTask(ts, t.id))} aria-label={`Delete task: ${t.text}`}>✕</button>
                  </li>
                ))}
              </ul>}
            {tasks.length > 0 && <p className="muted">{tasks.filter((t) => t.done).length} of {tasks.length} done</p>}
          </div>
          <div className="panel">
            <h2>⏰ Reminders</h2>
            <form onSubmit={(e) => { e.preventDefault(); setReminders((r) => addReminder(r, reminderText, reminderTime)); if (reminderText.trim() && reminderTime) { setReminderText(""); setReminderTime(""); } }}>
              <input className="input" value={reminderText} onChange={(e) => setReminderText(e.target.value)} placeholder="Remind me to…" aria-label="Reminder text" />
              <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} aria-label="Reminder time" className="input time-input" />
              <button className="btn primary" type="submit">Add</button>
            </form>
            <p className="muted">Reminders are a list for today — ULTRON shows them here but does not send notifications yet.</p>
            {reminders.length === 0
              ? <p className="muted">No reminders yet.</p>
              : <ul className="task-list">
                {reminders.map((r) => (
                  <li key={r.id} className="task-row">
                    <label>
                      <input type="checkbox" checked={r.done} onChange={() => setReminders((rs) => toggleReminder(rs, r.id))} />
                      <span className={r.done ? "task-done" : ""}>{r.time} — {r.text}</span>
                    </label>
                    <button className="btn small" onClick={() => setReminders((rs) => deleteReminder(rs, r.id))} aria-label={`Delete reminder: ${r.text}`}>✕</button>
                  </li>
                ))}
              </ul>}
          </div>
          <div className="panel">
            <h2>🧠 Saved memories</h2>
            <p className="muted">Save any ULTRON reply as a memory and it will be used when relevant to your next question.</p>
            {memories.length === 0
              ? <p className="muted">No memories saved yet — use &ldquo;Save as memory&rdquo; on an ULTRON reply.</p>
              : <ul className="task-list">
                {memories.map((m) => (
                  <li key={m.id} className="task-row">
                    <span>{m.text}</span>
                    <button className="btn small" onClick={() => setMemories((ms) => deleteMemory(ms, m.id))} aria-label="Delete memory">✕</button>
                  </li>
                ))}
              </ul>}
          </div>
          <div className="panel">
            <h2>Quick notes</h2>
            <form onSubmit={(e) => { e.preventDefault(); setNotes((n) => addNote(n, noteInput)); setNoteInput(""); }}>
              <input className="input" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Jot a quick note…" aria-label="Add a note" />
              <button className="btn primary" type="submit">Add</button>
            </form>
            {notes.length === 0
              ? <p className="muted">No notes yet — jot one above.</p>
              : <ul className="task-list">
                {notes.map((n) => (
                  <li key={n.id} className="task-row">
                    <span>{n.text}</span>
                    <button className="btn small" onClick={() => setNotes((ns) => deleteNote(ns, n.id))} aria-label={`Delete note: ${n.text}`}>✕</button>
                  </li>
                ))}
              </ul>}
          </div>
        </div>
      </section>
    </main>
  );
}
