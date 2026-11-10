// Local-only Daily Work helpers: to-do tasks and quick notes stored in the
// browser's localStorage. No server, no auth, no Supabase — nothing here
// ever leaves the device. Pure functions so they are easy to unit-test;
// page.tsx owns the localStorage read/write.

export type Task = { id: string; text: string; done: boolean; createdAt: number };
export type Note = { id: string; text: string; createdAt: number };

export const TASKS_KEY = "ultron-master.tasks.v1";
export const NOTES_KEY = "ultron-master.notes.v1";
export const REMINDERS_KEY = "ultron-master.reminders.v1";
export const MEMORIES_KEY = "ultron-master.memories.v1";

export type Reminder = { id: string; text: string; time: string; done: boolean; createdAt: number };
export type Memory = { id: string; text: string; createdAt: number };

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch { /* fall through to the timestamp id */ }
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function isTask(v: unknown): v is Task {
  const t = v as Task;
  return typeof t === "object" && t !== null && typeof t.id === "string" && typeof t.text === "string" && typeof t.done === "boolean";
}

function isNote(v: unknown): v is Note {
  const n = v as Note;
  return typeof n === "object" && n !== null && typeof n.id === "string" && typeof n.text === "string";
}

export function parseTasks(raw: string | null): Task[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTask) : [];
  } catch { return []; }
}

export function parseNotes(raw: string | null): Note[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isNote) : [];
  } catch { return []; }
}

export function addTask(tasks: Task[], text: string): Task[] {
  const trimmed = text.trim();
  if (!trimmed) return tasks;
  return [...tasks, { id: newId(), text: trimmed, done: false, createdAt: Date.now() }];
}

export function toggleTask(tasks: Task[], id: string): Task[] {
  return tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

export function deleteTask(tasks: Task[], id: string): Task[] {
  return tasks.filter((t) => t.id !== id);
}

export function addNote(notes: Note[], text: string): Note[] {
  const trimmed = text.trim();
  if (!trimmed) return notes;
  return [{ id: newId(), text: trimmed, createdAt: Date.now() }, ...notes];
}

export function deleteNote(notes: Note[], id: string): Note[] {
  return notes.filter((n) => n.id !== id);
}

function isReminder(v: unknown): v is Reminder {
  const r = v as Reminder;
  return typeof r === "object" && r !== null && typeof r.id === "string" && typeof r.text === "string" && typeof r.time === "string" && typeof r.done === "boolean";
}

function isMemory(v: unknown): v is Memory {
  const m = v as Memory;
  return typeof m === "object" && m !== null && typeof m.id === "string" && typeof m.text === "string";
}

export function parseReminders(raw: string | null): Reminder[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isReminder) : [];
  } catch { return []; }
}

export function parseMemories(raw: string | null): Memory[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isMemory) : [];
  } catch { return []; }
}

/** HH:MM 24-hour time, e.g. "09:30". */
export function isValidReminderTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function addReminder(reminders: Reminder[], text: string, time: string): Reminder[] {
  const trimmed = text.trim();
  if (!trimmed || !isValidReminderTime(time)) return reminders;
  return [...reminders, { id: newId(), text: trimmed, time, done: false, createdAt: Date.now() }];
}

export function toggleReminder(reminders: Reminder[], id: string): Reminder[] {
  return reminders.map((r) => (r.id === id ? { ...r, done: !r.done } : r));
}

export function deleteReminder(reminders: Reminder[], id: string): Reminder[] {
  return reminders.filter((r) => r.id !== id);
}

export function addMemory(memories: Memory[], text: string): Memory[] {
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return memories;
  if (memories.some((m) => m.text.toLowerCase() === trimmed.toLowerCase())) return memories;
  return [{ id: newId(), text: trimmed, createdAt: Date.now() }, ...memories].slice(0, 20);
}

export function deleteMemory(memories: Memory[], id: string): Memory[] {
  return memories.filter((m) => m.id !== id);
}

/** Pick up to `limit` saved memories whose words overlap the message.
 *  Simple keyword overlap, capped — no embedding, no server call. */
export function pickRelevantMemories(memories: Memory[], message: string, limit = 3): string[] {
  const words = new Set(message.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  if (words.size === 0) return [];
  const scored = memories
    .map((m) => ({ text: m.text, score: m.text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => words.has(w)).length }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.text);
}
