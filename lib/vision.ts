// Validation helpers for POST /api/vision — shared by the route and tests.
// Accepts either a raw base64 string (+ optional mimeType) or a full
// data URL ("data:image/png;base64,..."). Caps input size so a huge upload
// cannot be forwarded to the provider unchecked.

export const MAX_IMAGE_BASE64_CHARS = 7_000_000; // ~5 MB of image bytes
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function parseDataUrl(value: string): { mimeType: string; data: string } | null {
  const m = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(value.trim());
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

export function validateVisionInput(input: {
  imageData?: unknown;
  dataUrl?: unknown;
  mimeType?: unknown;
  question?: unknown;
}): { ok: true; mimeType: string; data: string; question: string } | { ok: false; error: string } {
  let mimeType = "image/png";
  let data = "";
  if (typeof input.dataUrl === "string" && input.dataUrl.trim()) {
    const parsed = parseDataUrl(input.dataUrl);
    if (!parsed) return { ok: false, error: "dataUrl must be a valid image data URL (data:image/png;base64,...)." };
    mimeType = parsed.mimeType;
    data = parsed.data;
  } else if (typeof input.imageData === "string" && input.imageData.trim()) {
    data = input.imageData.trim();
    if (typeof input.mimeType === "string" && input.mimeType.trim()) mimeType = input.mimeType.trim().toLowerCase();
  } else {
    return { ok: false, error: "An image is required (imageData or dataUrl)." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return { ok: false, error: `Unsupported image type "${mimeType}". Use PNG, JPEG, WebP or GIF.` };
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return { ok: false, error: "imageData must be base64-encoded image data." };
  if (data.length > MAX_IMAGE_BASE64_CHARS) return { ok: false, error: "Image is too large (max about 5 MB)." };
  const question = typeof input.question === "string" && input.question.trim() ? input.question.trim() : "Describe this image in detail.";
  if (question.length > 1000) return { ok: false, error: "Question is too long (max 1000 characters)." };
  return { ok: true, mimeType, data, question };
}
