import { enforceNoTextInput } from "./no-text-input";
import { INK_STYLES } from "./ink-engine";

const MIN_DRAW_TIME_MS = 15_000;
// Comments are quick marginalia — keep the bar low but high enough to deter paste-bots.
const MIN_COMMENT_DRAW_TIME_MS = 2_000;
const MIN_NATIVE_DRAWING_BYTES = 64;
const MIN_RENDERED_IMAGE_BYTES = 256;
const ALLOWED_INK_IDS: ReadonlySet<string> = new Set(INK_STYLES.map((style) => style.id));
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function validateCanvasPost(
  body: Record<string, unknown>,
  minDrawTimeMs: number = MIN_DRAW_TIME_MS
): void {
  enforceNoTextInput(body);

  const { canvas_stroke_data, drawing_duration_ms } = body as {
    canvas_stroke_data?: Array<{
      time: number;
      x: number;
      y: number;
      pressure: number;
      color?: string;
      ink?: string;
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

  if (effectiveDuration < minDrawTimeMs) {
    throw new Error(
      `Drawing must span at least ${minDrawTimeMs / 1000} seconds. ` +
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
    if (point.color !== undefined && !isHexColor(point.color)) {
      throw new Error("Each stroke point color must be a #rrggbb hex color");
    }
    if (point.ink !== undefined && !ALLOWED_INK_IDS.has(point.ink)) {
      throw new Error("Each stroke point ink must be a supported ink style");
    }
  }

  const inkStyle = body.ink_style;
  if (inkStyle !== undefined && (typeof inkStyle !== "string" || !ALLOWED_INK_IDS.has(inkStyle))) {
    throw new Error("ink_style must be a supported ink style");
  }
}

export function validateCommentStrokes(body: Record<string, unknown>): void {
  validateCanvasPost(body, MIN_COMMENT_DRAW_TIME_MS);
}

export function validateNativeCanvasPost(
  body: Record<string, unknown>,
  minDrawTimeMs: number = MIN_DRAW_TIME_MS
): { drawingData: Buffer; renderedImageData: Buffer } {
  enforceNoTextInput(body);

  const drawingDurationMs = body.drawing_duration_ms;
  if (typeof drawingDurationMs !== "number" || drawingDurationMs < minDrawTimeMs) {
    throw new Error(
      `Drawing must span at least ${minDrawTimeMs / 1000} seconds. ` +
        `Your drawing was only ${(
          (typeof drawingDurationMs === "number" ? drawingDurationMs : 0) / 1000
        ).toFixed(1)} seconds.`
    );
  }

  const inkStyle = body.ink_style;
  if (inkStyle !== undefined && (typeof inkStyle !== "string" || !ALLOWED_INK_IDS.has(inkStyle))) {
    throw new Error("ink_style must be a supported ink style");
  }

  const drawingData = decodeBase64Field(
    body.native_drawing_data_base64,
    "native_drawing_data_base64"
  );
  if (drawingData.length < MIN_NATIVE_DRAWING_BYTES) {
    throw new Error("Native drawing data is too small to be a valid letter");
  }

  const renderedImageData = decodeBase64Field(
    body.rendered_image_data_base64,
    "rendered_image_data_base64"
  );
  if (renderedImageData.length < MIN_RENDERED_IMAGE_BYTES) {
    throw new Error("Rendered image data is too small to be a valid letter");
  }

  return { drawingData, renderedImageData };
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value);
}

function decodeBase64Field(value: unknown, fieldName: string): Buffer {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  const normalized = value.includes(",") ? value.split(",").pop() || "" : value;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error(`${fieldName} must be base64 encoded`);
  }

  return Buffer.from(normalized, "base64");
}
