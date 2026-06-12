import Tesseract from "tesseract.js";
import { extractHashtags } from "./tags";

export async function extractOcrFromImage(
  imageBuffer: Buffer
): Promise<{ text: string; hashtags: string[] }> {
  const {
    data: { text },
  } = await Tesseract.recognize(imageBuffer, "eng", {
    logger: () => {},
  });

  const cleanText = text.trim();

  return { text: cleanText, hashtags: extractHashtags(cleanText) };
}
