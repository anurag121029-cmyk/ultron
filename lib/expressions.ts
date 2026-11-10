export type Expression = "happy" | "neutral" | "sad" | "surprised" | "thinking" | "listening" | "speaking";
export type RoughEmotion = "happy" | "sad" | "surprised" | "neutral";

/** Simple, deterministic keyword/sentiment heuristic over an assistant reply.
 *  Deliberately transparent: it is a UI expression picker, not sentiment analysis. */
export function expressionFromReply(text: string): Expression {
  const t = text.toLowerCase();
  if (/(congratulations|great job|wonderful|awesome|fantastic|love that|brilliant|well done)/.test(t)) return "happy";
  if (/(sorry|unfortunately|that's tough|difficult|i understand this is hard)/.test(t)) return "sad";
  if (/(wow|incredible|surprising|unexpected|amazing)/.test(t)) return "surprised";
  if (/(let me think|hmm|considering|working through)/.test(t)) return "thinking";
  if (t.includes("?")) return "thinking";
  return "neutral";
}

/** Face-geometry heuristic used only as a fallback when no blendshape model is
 *  available. Inputs are normalised 0..1 measurements; output is a rough label. */
export function roughEmotionFromGeometry(input: {
  smileWidth: number; // mouth width relative to face width
  mouthOpen: number; // mouth height relative to face height
  browRaise: number; // brow height relative to face height
}): RoughEmotion {
  const { smileWidth, mouthOpen, browRaise } = input;
  if (mouthOpen > 0.12 && browRaise > 0.05) return "surprised";
  if (smileWidth > 0.42 && mouthOpen < 0.08) return "happy";
  if (smileWidth < 0.30 && mouthOpen < 0.05) return "sad";
  return "neutral";
}

/** Map MediaPipe-style blendshape scores (0..1, missing = 0) to a rough label. */
export function roughEmotionFromBlendshapes(scores: Record<string, number>): RoughEmotion {
  const s = (k: string) => scores[k] ?? 0;
  const smile = Math.max(s("mouthSmileLeft"), s("mouthSmileRight"));
  const jawOpen = s("jawOpen");
  const browUp = Math.max(s("browInnerUp"), s("browOuterUpLeft"), s("browOuterUpRight"));
  const frown = Math.max(s("browDownLeft"), s("browDownRight"));
  if (jawOpen > 0.45 && browUp > 0.3) return "surprised";
  if (smile > 0.5 && jawOpen < 0.4) return "happy";
  if (frown > 0.4 && smile < 0.2) return "sad";
  return "neutral";
}

export function expressionForEmotion(e: RoughEmotion): Expression {
  return e === "neutral" ? "neutral" : e;
}
