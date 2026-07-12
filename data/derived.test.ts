import { describe, expect, it } from "vitest";
import {
  ACTIVITY_FACTORS,
  ageFromBirthYear,
  bmrMifflinKcal,
  calorieTargetKcal,
  proteinTargetG,
  relativeStrength,
  waterTargetMl,
} from "./derived";

describe("waterTargetMl — ~35 ml/kg, clamp 1500..4000", () => {
  it("valori noti", () => {
    expect(waterTargetMl(80)).toBe(2800);
    expect(waterTargetMl(60)).toBe(2100);
    expect(waterTargetMl(40)).toBe(1500); // 1400 → clamp basso
    expect(waterTargetMl(120)).toBe(4000); // 4200 → clamp alto
  });

  it("senza peso: null, mai numeri inventati", () => {
    expect(waterTargetMl(null)).toBeNull();
    expect(waterTargetMl(0)).toBeNull();
  });
});

describe("proteinTargetG — ~1,8 g/kg, clamp 60..260 (run-09)", () => {
  it("valori noti", () => {
    expect(proteinTargetG(80)).toBe(144);
    expect(proteinTargetG(82.4)).toBe(148); // 148,32 → 148
    expect(proteinTargetG(30)).toBe(60); // 54 → clamp basso
    expect(proteinTargetG(150)).toBe(260); // 270 → clamp alto
  });

  it("senza peso: null, mai numeri inventati", () => {
    expect(proteinTargetG(null)).toBeNull();
    expect(proteinTargetG(0)).toBeNull();
  });
});

describe("bmrMifflinKcal — valori noti della formula", () => {
  it("uomo 80 kg · 180 cm · 30 anni = 1780 kcal", () => {
    expect(
      bmrMifflinKcal({ weightKg: 80, heightCm: 180, ageYears: 30, sex: "m" }),
    ).toBe(800 + 1125 - 150 + 5);
  });

  it("donna 60 kg · 165 cm · 25 anni = 1345,25 kcal", () => {
    expect(
      bmrMifflinKcal({ weightKg: 60, heightCm: 165, ageYears: 25, sex: "f" }),
    ).toBeCloseTo(600 + 1031.25 - 125 - 161, 5);
  });

  it("un pezzo mancante = null", () => {
    expect(
      bmrMifflinKcal({ weightKg: 80, heightCm: null, ageYears: 30, sex: "m" }),
    ).toBeNull();
    expect(
      bmrMifflinKcal({ weightKg: 80, heightCm: 180, ageYears: 30, sex: null }),
    ).toBeNull();
  });
});

describe("calorieTargetKcal — TDEE e obiettivi", () => {
  const profilo = {
    weightKg: 80,
    heightCm: 180,
    birthYear: 1996,
    sex: "m" as const,
    activityLevel: 3,
  };

  it("mantenimento: BMR 1780 × 1,55 = 2759 → 2760 (ai 10)", () => {
    expect(ACTIVITY_FACTORS[2]).toBe(1.55);
    expect(calorieTargetKcal(profilo, 2026, "maintain")).toBe(2760);
  });

  it("deficit −500 e surplus +300", () => {
    expect(calorieTargetKcal(profilo, 2026, "deficit")).toBe(2260);
    expect(calorieTargetKcal(profilo, 2026, "surplus")).toBe(3060);
  });

  it("profilo incompleto o livello fuori dominio: null", () => {
    expect(
      calorieTargetKcal({ ...profilo, activityLevel: null }, 2026, "maintain"),
    ).toBeNull();
    expect(
      calorieTargetKcal({ ...profilo, birthYear: null }, 2026, "maintain"),
    ).toBeNull();
    expect(
      calorieTargetKcal({ ...profilo, weightKg: null }, 2026, "maintain"),
    ).toBeNull();
  });

  it("il pavimento onesto: mai sotto le 1200", () => {
    const minuta = {
      weightKg: 42,
      heightCm: 150,
      birthYear: 1950,
      sex: "f" as const,
      activityLevel: 1,
    };
    // BMR ≈ 420+937,5−380−161 = 816,5; ×1,2 ≈ 980; −500 → clamp 1200.
    expect(calorieTargetKcal(minuta, 2026, "deficit")).toBe(1200);
  });
});

describe("ageFromBirthYear", () => {
  it("approssimazione all'anno civile, dominio sano", () => {
    expect(ageFromBirthYear(1996, 2026)).toBe(30);
    expect(ageFromBirthYear(null, 2026)).toBeNull();
    expect(ageFromBirthYear(2030, 2026)).toBeNull(); // età negativa
  });
});

describe("relativeStrength — la riga Forza Rel. del foglio", () => {
  it("e1RM / peso corporeo, a due decimali", () => {
    expect(relativeStrength(100, 80)).toBe(1.25);
    expect(relativeStrength(77.6, 82.4)).toBeCloseTo(0.94, 5);
  });

  it("trattino quando manca un dato", () => {
    expect(relativeStrength(null, 80)).toBeNull();
    expect(relativeStrength(100, null)).toBeNull();
    expect(relativeStrength(100, 0)).toBeNull();
  });
});
