import { describe, it, expect } from "vitest";
import { validateCanvasPost, validateNativeCanvasPost } from "../src/lib/validation";

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

  it("accepts canonical watercolor and gold leaf ink styles", () => {
    const gilded = strokes(16_000).map((point, index) => ({
      ...point,
      color: index % 2 === 0 ? "#2471a3" : "#d4af37",
      ink: index % 2 === 0 ? "watercolor" : "goldLeaf",
    }));

    expect(() =>
      validateCanvasPost({
        canvas_stroke_data: gilded,
        drawing_duration_ms: 16_000,
        ink_style: "illumination",
      })
    ).not.toThrow();
  });

  it("rejects unsupported ink styles", () => {
    const bad = strokes(16_000).map((point) => ({
      ...point,
      ink: "feltWand",
    }));

    expect(() =>
      validateCanvasPost({
        canvas_stroke_data: bad,
        drawing_duration_ms: 16_000,
        ink_style: "feltWand",
      })
    ).toThrow(/supported ink/);
  });

  it("rejects non-hex stroke colors", () => {
    const bad = strokes(16_000).map((point) => ({
      ...point,
      color: "goldenrod",
    }));

    expect(() =>
      validateCanvasPost({
        canvas_stroke_data: bad,
        drawing_duration_ms: 16_000,
      })
    ).toThrow(/#rrggbb/);
  });
});

describe("validateNativeCanvasPost", () => {
  const validNativeBody = {
    native_drawing_data_base64: Buffer.alloc(96, 1).toString("base64"),
    rendered_image_data_base64: Buffer.alloc(512, 2).toString("base64"),
    drawing_duration_ms: 16_000,
    paper: "ruled",
    ink_style: "standard",
  };

  it("accepts native PencilKit drawing data and rendered image data", () => {
    const result = validateNativeCanvasPost(validNativeBody);
    expect(result.drawingData.length).toBe(96);
    expect(result.renderedImageData.length).toBe(512);
  });

  it("rejects native drawings that are too quick", () => {
    expect(() =>
      validateNativeCanvasPost({
        ...validNativeBody,
        drawing_duration_ms: 2_000,
      })
    ).toThrow(/at least/);
  });

  it("rejects tiny native drawing payloads", () => {
    expect(() =>
      validateNativeCanvasPost({
        ...validNativeBody,
        native_drawing_data_base64: Buffer.alloc(4, 1).toString("base64"),
      })
    ).toThrow(/Native drawing data/);
  });
});
