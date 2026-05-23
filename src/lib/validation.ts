import { enforceNoTextInput } from "./no-text-input";

const MIN_DRAW_TIME_MS = 15_000;

export function validateCanvasPost(body: Record<string, unknown>): void {
  enforceNoTextInput(body);

  const { canvas_stroke_data, drawing_duration_ms } = body as {
    canvas_stroke_data?: Array<{
      time: number;
      x: number;
      y: number;
      pressure: number;
      color?: string;
    }>;
    drawing_duration_ms?: number;
  };

  if (!canvas_stroke_data || !Array.isArray(canvas_stroke_data)) {
    throw new Error("canvas_stroke_data must be an array of stroke points");
  }

  if (canvas_stroke_data.length < 1) {
    throw new Error("Drawing must contain at least 1 point");
  }

  const times = canvas_stroke_data.map((p) => p.time);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const strokeSpan = maxTime - minTime;
  const wallDuration =
    typeof drawing_duration_ms === "number" ? drawing_duration_ms : strokeSpan;

  const effectiveDuration = Math.max(strokeSpan, wallDuration);

  if (effectiveDuration < MIN_DRAW_TIME_MS) {
    throw new Error(
      `Drawing must span at least ${MIN_DRAW_TIME_MS / 1000} seconds. ` +
        `Your drawing was only ${(effectiveDuration / 1000).toFixed(1)} seconds.`
    );
  }

  for (const point of canvas_stroke_data) {
    if (typeof point.time !== "number" || point.time <= 0) {
      throw new Error("Each stroke point must have a valid time");
    }
    if (
      typeof point.x !== "number" ||
      point.x < 0 ||
      point.x > 1
    ) {
      throw new Error("Each stroke point must have x between 0 and 1");
    }
    if (
      typeof point.y !== "number" ||
      point.y < 0 ||
      point.y > 1
    ) {
      throw new Error("Each stroke point must have y between 0 and 1");
    }
    if (
      typeof point.pressure !== "number" ||
      point.pressure < 0 ||
      point.pressure > 1
    ) {
      throw new Error(
        "Each stroke point must have pressure between 0 and 1"
      );
    }
  }
}
