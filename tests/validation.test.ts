import { describe, it, expect } from "vitest";
import { validateCanvasPost } from "../src/lib/validation";

function strokes(durationMs: number, count = 10) {
  return Array.from({ length: count }, (_, i) => ({
    time: 1000 + Math.round((i / (count - 1)) * durationMs),
    x: 0.1 + (i / count) * 0.8,
    y: 0.5,
    pressure: 0.6,
  }));
}

describe("validateCanvasPost", () => {
  it("accepts a drawing that took long enough", () => {
    expect(() =>
      validateCanvasPost({ canvas_stroke_data: strokes(16_000) })
    ).not.toThrow();
  });

  it("rejects a drawing dashed off too quickly", () => {
    expect(() =>
      validateCanvasPost({
        canvas_stroke_data: strokes(2_000),
        drawing_duration_ms: 2_000,
      })
    ).toThrow(/at least/);
  });

  it("rejects missing stroke data", () => {
    expect(() => validateCanvasPost({})).toThrow(/canvas_stroke_data/);
  });

  it("rejects out-of-bounds coordinates", () => {
    const bad = strokes(16_000);
    bad[3].x = 1.5;
    expect(() => validateCanvasPost({ canvas_stroke_data: bad })).toThrow(/x between/);
  });

  it("rejects invalid pressure", () => {
    const bad = strokes(16_000);
    bad[3].pressure = 2;
    expect(() => validateCanvasPost({ canvas_stroke_data: bad })).toThrow(/pressure/);
  });
});
