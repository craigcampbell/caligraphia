const ALLOWED_STRING_FIELDS = new Set([
  "username",
  "email",
  "token",
  "signupToken",
  "canvas_stroke_data",
  "ocr_text",
  "ocr_hashtags",
  "tag_pattern",
  "name",
  "reason",
  "scratch_svg_data",
  "interaction_type",
  "post_type",
  "color",
]);

const FORBIDDEN_FIELD_PATTERNS = [
  /^text$/i,
  /^body$/i,
  /^content$/i,
  /^message$/i,
  /^description$/i,
  /^comment$/i,
  /^caption$/i,
  /^bio$/i,
  /^title$/i,
  /^subtitle$/i,
  /^note$/i,
  /^summary$/i,
  /^search$/i,
  /^query$/i,
  /^keyword$/i,
];

export function enforceNoTextInput(
  body: Record<string, unknown> | null | undefined
): void {
  if (!body || typeof body !== "object") return;

  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_STRING_FIELDS.has(key)) continue;

    if (FORBIDDEN_FIELD_PATTERNS.some((p) => p.test(key))) {
      throw new ValidationError(
        `Text input is not allowed. Field "${key}" is forbidden.`
      );
    }

    if (
      typeof value === "string" &&
      value.length > 0 &&
      !isAllowedValue(key, value)
    ) {
      throw new ValidationError(
        `Text input is not allowed. String field "${key}" is forbidden.`
      );
    }
  }
}

function isAllowedValue(key: string, value: string): boolean {
  if (/^(#[a-zA-Z0-9_]+)$/.test(value)) return true; // hashtag
  if (/^[0-9a-fA-F-]{36}$/.test(value)) return true; // UUID
  if (key === "color" && /^#?[0-9a-fA-F]{3,8}$/.test(value)) return true;
  return false;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
