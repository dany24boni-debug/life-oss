import { describe, it, expect } from "vitest";
import { detectSlip } from "./detection";

describe("detectSlip", () => {
  it("returns null when all signals are healthy", () => {
    expect(
      detectSlip({
        completionRate2Day: 0.8,
        lightSkipPattern: 1,
        moodSliderAvg3Day: 4,
      }),
    ).toBeNull();
  });

  it("flags completion_low when 2-day completion < 50%", () => {
    expect(
      detectSlip({
        completionRate2Day: 0.4,
        lightSkipPattern: 0,
        moodSliderAvg3Day: 4,
      }),
    ).toBe("completion_low");
  });

  it("flags light_skipped when 5+ LIGHTs are skipped over 3 days", () => {
    expect(
      detectSlip({
        completionRate2Day: 0.7,
        lightSkipPattern: 5,
        moodSliderAvg3Day: 3,
      }),
    ).toBe("light_skipped");
  });

  it("flags mood_low only when avg ≤ 2 (not when null)", () => {
    expect(
      detectSlip({
        completionRate2Day: 1,
        lightSkipPattern: 0,
        moodSliderAvg3Day: 2,
      }),
    ).toBe("mood_low");

    expect(
      detectSlip({
        completionRate2Day: 1,
        lightSkipPattern: 0,
        moodSliderAvg3Day: null,
      }),
    ).toBeNull();
  });

  it("prioritises completion_low over other signals", () => {
    expect(
      detectSlip({
        completionRate2Day: 0.2,
        lightSkipPattern: 10,
        moodSliderAvg3Day: 1,
      }),
    ).toBe("completion_low");
  });
});
