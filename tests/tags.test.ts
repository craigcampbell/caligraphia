import { describe, it, expect } from "vitest";
import {
  parseTagList,
  groupTags,
  groupHashtagLiterals,
  extractHashtags,
} from "../src/lib/tags";

describe("parseTagList", () => {
  it("parses space, comma, and pipe separated hashtags", () => {
    expect(parseTagList("#poem #poetry")).toEqual(["poem", "poetry"]);
    expect(parseTagList("poem, poetry")).toEqual(["poem", "poetry"]);
    expect(parseTagList("poem|poetry|verse")).toEqual(["poem", "poetry", "verse"]);
  });

  it("normalizes case and dedupes", () => {
    expect(parseTagList("#Poem #POEM poem")).toEqual(["poem"]);
  });

  it("rejects regex metacharacters instead of compiling them", () => {
    expect(() => parseTagList("(a+)+$")).toThrow();
    expect(() => parseTagList(".*")).toThrow();
  });

  it("rejects empty input", () => {
    expect(() => parseTagList("   ")).toThrow();
  });
});

describe("groupTags", () => {
  it("reads the stored literal format", () => {
    expect(groupTags("#poem #poetry")).toEqual(["poem", "poetry"]);
  });

  it("tolerates legacy regex-style patterns without compiling them", () => {
    expect(groupTags("#poem|#poetry|#verse")).toEqual(["poem", "poetry", "verse"]);
    expect(groupTags("(sketch|doodle)")).toEqual(["sketch", "doodle"]);
  });

  it("produces feed-ready hashtag literals", () => {
    expect(groupHashtagLiterals("#poem #poetry")).toEqual(["#poem", "#poetry"]);
  });
});

describe("extractHashtags", () => {
  it("finds and lowercases hashtags in OCR text", () => {
    expect(extractHashtags("My morning page #Journal #daily #JOURNAL")).toEqual([
      "#journal",
      "#daily",
    ]);
  });

  it("returns empty for text without hashtags", () => {
    expect(extractHashtags("no tags here")).toEqual([]);
  });
});
