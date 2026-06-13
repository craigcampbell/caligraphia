import { describe, it, expect } from "vitest";
import { enforceNoTextInput } from "../src/lib/no-text-input";

describe("enforceNoTextInput", () => {
  it("allows whitelisted fields", () => {
    expect(() =>
      enforceNoTextInput({
        email: "a@b.com",
        username: "inky",
        native_drawing_data_base64: Buffer.alloc(96, 1).toString("base64"),
        rendered_image_data_base64: Buffer.alloc(512, 2).toString("base64"),
      })
    ).not.toThrow();
  });

  it("rejects forbidden text-bearing field names", () => {
    expect(() => enforceNoTextInput({ message: "hi there" })).toThrow(/forbidden/);
    expect(() => enforceNoTextInput({ caption: "look" })).toThrow(/forbidden/);
  });

  it("rejects free text in unknown string fields", () => {
    expect(() => enforceNoTextInput({ sneaky: "hello world" })).toThrow(/forbidden/);
  });

  it("lets hashtags and UUIDs through unknown fields", () => {
    expect(() =>
      enforceNoTextInput({
        tag: "#poetry",
        ref: "123e4567-e89b-12d3-a456-426614174000",
      })
    ).not.toThrow();
  });
});
