const TAG_RE = /^[a-z0-9_]+$/;
const MAX_TAGS_PER_GROUP = 10;

/**
 * Parses user input for a group's tag list ("#poem #poetry", "poem, poetry",
 * "poem|poetry") into normalized lowercase tags without the leading #.
 * Throws if any token isn't a plain hashtag — regex is never accepted.
 */
export function parseTagList(input: string): string[] {
  const tokens = input
    .split(/[\s,|]+/)
    .map((t) => t.trim().replace(/^#/, "").toLowerCase())
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    throw new Error("At least one hashtag is required");
  }
  if (tokens.length > MAX_TAGS_PER_GROUP) {
    throw new Error(`At most ${MAX_TAGS_PER_GROUP} hashtags per circle`);
  }
  for (const token of tokens) {
    if (!TAG_RE.test(token)) {
      throw new Error(
        `"${token}" is not a valid hashtag (letters, numbers, and _ only)`
      );
    }
  }
  return [...new Set(tokens)];
}

/**
 * Extracts literal tags from a stored tagPattern. Tolerates legacy values
 * that were saved as regex (e.g. "#(poem|poetry)") by pulling out the
 * alphanumeric tokens instead of compiling anything.
 */
export function groupTags(tagPattern: string): string[] {
  const tokens = tagPattern.toLowerCase().match(/[a-z0-9_]+/g) || [];
  return [...new Set(tokens)];
}

/** Hashtags as stored on posts ("#poem") for a group's tags. */
export function groupHashtagLiterals(tagPattern: string): string[] {
  return groupTags(tagPattern).map((t) => `#${t}`);
}

/** Pulls normalized lowercase hashtags out of OCR text. */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_]+/g) || [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}
