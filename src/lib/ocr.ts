import Tesseract from "tesseract.js";

export async function extractOcrFromImage(
  imageBuffer: Buffer
): Promise<{ text: string; hashtags: string[] }> {
  const {
    data: { text },
  } = await Tesseract.recognize(imageBuffer, "eng", {
    logger: () => {},
  });

  const cleanText = text.trim();

  const hashtagRegex = /#[a-zA-Z0-9_]+/g;
  const hashtags = [...new Set(cleanText.match(hashtagRegex) || [])];

  return { text: cleanText, hashtags };
}
