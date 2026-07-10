import { describe, expect, it } from "vitest";
import { ExamSchema } from "@/data/schemas";
import { buildEsamiImportPlan, type LegacyExamRow } from "./importer";

const storia: LegacyExamRow = {
  id: "dddd4444-0000-4000-8000-000000000001",
  title: "  Storia moderna ",
  exam_date: "2026-09-10",
  total_chapters: 14,
  completed_chapters: 5,
  notes: "Manuale Rossi",
  created_at: "2026-05-01T10:00:00+00:00",
  updated_at: "2026-06-20T09:30:00+00:00",
};

describe("buildEsamiImportPlan — mappatura pura exams legacy", () => {
  it("mappa una riga legacy in un esame valido, timestamp preservati", async () => {
    const plan = await buildEsamiImportPlan([storia]);
    expect(plan.skippedInvalid).toBe(0);
    expect(plan.exams).toHaveLength(1);
    const exam = plan.exams[0];
    expect(ExamSchema.parse(exam)).toEqual(exam);
    expect(exam.title).toBe("Storia moderna");
    expect(exam.date).toBe("2026-09-10");
    expect(exam.total_chapters).toBe(14);
    expect(exam.completed_chapters).toBe(5);
    expect(exam.created_at).toBe("2026-05-01T10:00:00.000Z");
    expect(exam.updated_at).toBe("2026-06-20T09:30:00.000Z");
    expect(exam.deleted_at).toBeNull();
  });

  it("è deterministico: stesso input → stesse righe (id inclusi)", async () => {
    const a = await buildEsamiImportPlan([storia]);
    const b = await buildEsamiImportPlan([storia]);
    expect(a).toEqual(b);
  });

  it("clampa i capitoli: completati mai oltre il totale, valori sporchi a posto", async () => {
    const sporca: LegacyExamRow = {
      ...storia,
      id: "dddd4444-0000-4000-8000-000000000002",
      total_chapters: 3,
      completed_chapters: 99, // il DB legacy lo vieta, ma difesa in profondità
      notes: "   ",
      updated_at: null,
    };
    const plan = await buildEsamiImportPlan([sporca]);
    const exam = plan.exams[0];
    expect(exam.completed_chapters).toBe(3);
    expect(exam.notes).toBeNull();
    // updated_at mancante → cade sul created_at (mai istanti inventati).
    expect(exam.updated_at).toBe(exam.created_at);
    expect(ExamSchema.parse(exam)).toEqual(exam);
  });

  it("salta righe senza titolo o con data malformata, contandole", async () => {
    const senzaTitolo: LegacyExamRow = { ...storia, id: "x1", title: "  " };
    const dataRotta: LegacyExamRow = {
      ...storia,
      id: "x2",
      exam_date: "10/09/2026",
    };
    const plan = await buildEsamiImportPlan([senzaTitolo, dataRotta, storia]);
    expect(plan.skippedInvalid).toBe(2);
    expect(plan.exams).toHaveLength(1);
  });
});
