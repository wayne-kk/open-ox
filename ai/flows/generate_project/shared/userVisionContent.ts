import type { ChatMessageContent } from "@/ai/shared/llm/types";

/** Shown to the model when the user pasted only an image (no text). */
export const USER_IMAGE_ONLY_HINT =
  "（本轮仅附带参考截图，无额外文字说明。请结合图片理解用户想要的页面风格、布局与文案意图；如需澄清再用 yield_to_user 提问。）";

function asDataUrl(imageBase64OrDataUrl: string): string {
  const t = imageBase64OrDataUrl.trim();
  if (!t) return t;
  return t.startsWith("data:") ? t : `data:image/png;base64,${t}`;
}

/** Normalize pasted / stored reference image to a data URL for APIs and payloads. */
export function normalizeReferenceImageDataUrl(imageBase64OrDataUrl: string): string {
  return asDataUrl(imageBase64OrDataUrl);
}

/** User message for OpenAI-style multimodal `content` arrays. */
export function buildUserVisionContent(
  userText: string,
  imageDataUrl?: string | null
): ChatMessageContent {
  const text = userText.trim();
  const textBlock = text || (imageDataUrl?.trim() ? USER_IMAGE_ONLY_HINT : "");
  const img = imageDataUrl?.trim();
  if (!img) return textBlock;
  const url = asDataUrl(img);
  const parts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" } }
  > = [{ type: "image_url", image_url: { url, detail: "high" } }];
  if (textBlock) parts.push({ type: "text", text: textBlock });
  return parts;
}

/** Extract plain text from persisted user message content (string or vision parts). */
export function plainTextFromUserMessageContent(content: ChatMessageContent): string {
  if (content == null) return "";
  if (typeof content === "string") {
    return userTurnPlainTextForClassifier(content, false);
  }
  let text = "";
  let hasImage = false;
  for (const part of content) {
    if (part.type === "text" && part.text.trim()) {
      text = text ? `${text}\n${part.text.trim()}` : part.text.trim();
    }
    if (part.type === "image_url") hasImage = true;
  }
  return userTurnPlainTextForClassifier(text, hasImage);
}

/** Plain string for classifiers / merge logic (no binary). */
export function userTurnPlainTextForClassifier(userText: string, hasImage: boolean): string {
  const t = userText.trim();
  if (t) return t;
  if (hasImage) return USER_IMAGE_ONLY_HINT;
  return "";
}

/** Short label for traces / logs. */
export function visionTraceUserLabel(userText: string, hasImage: boolean): string {
  const t = userText.trim();
  if (hasImage) {
    return t ? `[vision+text] ${t.slice(0, 800)}` : "[vision] image only";
  }
  return t;
}
