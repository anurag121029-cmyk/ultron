import { describe, expect, it } from "vitest";
import { addMemory, addNote, addReminder, addTask, deleteMemory, deleteNote, deleteReminder, deleteTask, isValidReminderTime, parseMemories, parseNotes, parseReminders, parseTasks, pickRelevantMemories, toggleReminder, toggleTask, type Memory, type Note, type Reminder, type Task } from "../lib/dailyWork";

describe("parseTasks / parseNotes", () => {
  it("returns [] for null, empty or broken JSON", () => {
    expect(parseTasks(null)).toEqual([]);
    expect(parseTasks("")).toEqual([]);
    expect(parseTasks("not json")).toEqual([]);
    expect(parseNotes("not json")).toEqual([]);
  });
  it("keeps valid entries and drops malformed ones", () => {
    expect(parseTasks(JSON.stringify([{ id: "1", text: "Buy milk", done: false }, { id: "2" }, "junk"]))).toEqual([{ id: "1", text: "Buy milk", done: false }]);
    expect(parseNotes(JSON.stringify([{ id: "n1", text: "Call mum" }]))).toEqual([{ id: "n1", text: "Call mum" }]);
  });
});

describe("tasks", () => {
  const base: Task[] = [{ id: "1", text: "Study", done: false, createdAt: 1 }];
  it("adds a trimmed task and ignores blank input", () => {
    const added = addTask(base, "  Read chapter 3  ");
    expect(added).toHaveLength(2);
    expect(added[1].text).toBe("Read chapter 3");
    expect(added[1].done).toBe(false);
    expect(addTask(base, "   ")).toEqual(base);
  });
  it("toggles done without touching other tasks", () => {
    expect(toggleTask(base, "1")[0].done).toBe(true);
    expect(toggleTask(base, "missing")).toEqual(base);
  });
  it("deletes by id", () => {
    expect(deleteTask(base, "1")).toEqual([]);
    expect(deleteTask(base, "missing")).toEqual(base);
  });
});

describe("reminders", () => {
  const base: Reminder[] = [{ id: "r1", text: "Call mum", time: "18:00", done: false, createdAt: 1 }];
  it("validates HH:MM times", () => {
    expect(isValidReminderTime("09:30")).toBe(true);
    expect(isValidReminderTime("23:59")).toBe(true);
    expect(isValidReminderTime("24:00")).toBe(false);
    expect(isValidReminderTime("9:30")).toBe(false);
    expect(isValidReminderTime("")).toBe(false);
  });
  it("adds a reminder and ignores blank text or a bad time", () => {
    expect(addReminder(base, "  Gym  ", "07:00")).toHaveLength(2);
    expect(addReminder(base, "Gym", "7am")).toEqual(base);
    expect(addReminder(base, "   ", "07:00")).toEqual(base);
  });
  it("toggles and deletes by id", () => {
    expect(toggleReminder(base, "r1")[0].done).toBe(true);
    expect(deleteReminder(base, "r1")).toEqual([]);
  });
  it("parseReminders drops malformed entries", () => {
    expect(parseReminders(JSON.stringify([{ id: "r1", text: "x", time: "08:00", done: false }, { id: "bad" }]))).toHaveLength(1);
    expect(parseReminders("junk")).toEqual([]);
  });
});

describe("memories", () => {
  const base: Memory[] = [{ id: "m1", text: "I like morning workouts", createdAt: 1 }];
  it("adds a memory, trims it, and ignores blanks and duplicates", () => {
    expect(addMemory(base, "  I love chai  ")[0].text).toBe("I love chai");
    expect(addMemory(base, "   ")).toEqual(base);
    expect(addMemory(base, "i like morning workouts")).toEqual(base);
  });
  it("caps at 20 memories", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `m${i}`, text: `memory ${i}`, createdAt: i }));
    expect(addMemory(many, "new one")).toHaveLength(20);
  });
  it("deletes by id and parses safely", () => {
    expect(deleteMemory(base, "m1")).toEqual([]);
    expect(parseMemories("junk")).toEqual([]);
  });
  it("pickRelevantMemories returns only keyword-matching memories, capped", () => {
    const all: Memory[] = [
      { id: "1", text: "I like morning workouts", createdAt: 1 },
      { id: "2", text: "My dog is called Bruno", createdAt: 2 },
      { id: "3", text: "Morning chai helps me focus", createdAt: 3 },
    ];
    const picked = pickRelevantMemories(all, "plan my morning workout");
    expect(picked).toContain("I like morning workouts");
    expect(picked).not.toContain("My dog is called Bruno");
    expect(pickRelevantMemories(all, "zzzz")).toEqual([]);
    expect(pickRelevantMemories(all, "morning", 1)).toHaveLength(1);
  });
});

describe("notes", () => {
  const base: Note[] = [{ id: "n1", text: "Idea", createdAt: 1 }];
  it("prepends a trimmed note and ignores blank input", () => {
    const added = addNote(base, "  New idea  ");
    expect(added).toHaveLength(2);
    expect(added[0].text).toBe("New idea");
    expect(addNote(base, " ")).toEqual(base);
  });
  it("deletes by id", () => {
    expect(deleteNote(base, "n1")).toEqual([]);
    expect(deleteNote(base, "missing")).toEqual(base);
  });
});
