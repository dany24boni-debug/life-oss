import { describe, it, expect } from "vitest";
import {
  computePacing,
  OVER_ACHIEVING_THRESHOLD,
  UNDER_PACE_THRESHOLD,
} from "./pacing";

const TODAY = "2026-05-12";

describe("computePacing", () => {
  it("in_line: 15 chapters in 10 days = 1.5/day → in_line + needed=2 (ceil)", () => {
    const r = computePacing(
      { exam_date: "2026-05-22", total_chapters: 20, completed_chapters: 5 },
      TODAY,
    );
    expect(r.daysRemaining).toBe(10);
    expect(r.chaptersRemaining).toBe(15);
    expect(r.chaptersPerDayNeeded).toBe(2);
    expect(r.status).toBe("in_line");
  });

  it("under_pace: 15 chapters in 3 days = 5/day → under_pace", () => {
    const r = computePacing(
      { exam_date: "2026-05-15", total_chapters: 20, completed_chapters: 5 },
      TODAY,
    );
    expect(r.daysRemaining).toBe(3);
    expect(r.chaptersPerDayNeeded).toBe(5);
    expect(r.status).toBe("under_pace");
  });

  it("over_achieving: 2 chapters in 30 days ≈ 0.067/day → over_achieving", () => {
    const r = computePacing(
      { exam_date: "2026-06-11", total_chapters: 10, completed_chapters: 8 },
      TODAY,
    );
    expect(r.daysRemaining).toBe(30);
    expect(r.chaptersRemaining).toBe(2);
    expect(r.chaptersPerDayNeeded).toBe(1); // ceil(0.067)
    expect(r.status).toBe("over_achieving");
  });

  it("done: completed=total regardless of days remaining", () => {
    const r = computePacing(
      { exam_date: "2026-05-22", total_chapters: 20, completed_chapters: 20 },
      TODAY,
    );
    expect(r.chaptersRemaining).toBe(0);
    expect(r.chaptersPerDayNeeded).toBe(0);
    expect(r.status).toBe("done");
  });

  it("past: exam date passed, chapters not finished → past", () => {
    const r = computePacing(
      { exam_date: "2026-05-10", total_chapters: 20, completed_chapters: 5 },
      TODAY,
    );
    expect(r.daysRemaining).toBe(-2);
    expect(r.chaptersRemaining).toBe(15);
    expect(r.status).toBe("past");
  });

  it("past + done: exam yesterday but chapters complete → done (done wins)", () => {
    const r = computePacing(
      { exam_date: "2026-05-10", total_chapters: 20, completed_chapters: 20 },
      TODAY,
    );
    expect(r.daysRemaining).toBe(-2);
    expect(r.status).toBe("done");
  });

  it("exam today, chapters left: divide-by-zero guard → all in 1 day", () => {
    const r = computePacing(
      { exam_date: "2026-05-12", total_chapters: 20, completed_chapters: 5 },
      TODAY,
    );
    expect(r.daysRemaining).toBe(0);
    expect(r.chaptersPerDayNeeded).toBe(15);
    expect(r.status).toBe("under_pace");
  });

  it("zero total chapters: degenerate (0=0) → done", () => {
    const r = computePacing(
      { exam_date: "2026-05-22", total_chapters: 0, completed_chapters: 0 },
      TODAY,
    );
    expect(r.status).toBe("done");
  });

  it("overshoot: completed > total → chaptersRemaining clamped to 0 → done", () => {
    const r = computePacing(
      { exam_date: "2026-05-22", total_chapters: 20, completed_chapters: 25 },
      TODAY,
    );
    expect(r.chaptersRemaining).toBe(0);
    expect(r.status).toBe("done");
  });

  it("boundary at OVER_ACHIEVING_THRESHOLD (0.5): inclusive → over_achieving", () => {
    // 5 chapters / 10 days = exactly 0.5/day
    const r = computePacing(
      { exam_date: "2026-05-22", total_chapters: 10, completed_chapters: 5 },
      TODAY,
    );
    expect(r.chaptersRemaining).toBe(5);
    expect(r.daysRemaining).toBe(10);
    expect(r.status).toBe("over_achieving");
  });

  it("boundary at UNDER_PACE_THRESHOLD (1.5): inclusive → in_line", () => {
    // 15 chapters / 10 days = exactly 1.5/day
    const r = computePacing(
      { exam_date: "2026-05-22", total_chapters: 20, completed_chapters: 5 },
      TODAY,
    );
    expect(r.status).toBe("in_line");
  });

  it("threshold constants are exported and stable", () => {
    expect(OVER_ACHIEVING_THRESHOLD).toBe(0.5);
    expect(UNDER_PACE_THRESHOLD).toBe(1.5);
  });
});
